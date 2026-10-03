import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { KycStatus, Role, UserStatus, type User } from "@prisma/client";
import { db } from "../db";
import { isClerkConfigured, isDatabaseConfigured } from "../env";
import { AuditAction, recordAudit } from "../audit";
import { requestContext } from "../request-context";
import { expireMembershipIfNeeded } from "../membership-pay";
import { indianMobile, e164India } from "../mobile-auth";
import { roleFromUnknown, type ClerkPublicMetadata } from "./roles";

/**
 * Bridges Clerk sessions to the Postgres user record.
 *
 * Postgres is authoritative for role. Clerk publicMetadata is a mirror kept in
 * sync on every write so `proxy.ts` can make a cheap first-pass decision, but
 * no privileged path trusts the mirror — server components and route handlers
 * re-read the database before allowing anything.
 */

export type AuthContext = {
  clerkId: string;
  user: User;
  role: Role;
};

/**
 * Clerk user id of the caller, or null when signed out.
 *
 * Returns null rather than propagating when Clerk is unconfigured: without keys
 * the proxy skips clerkMiddleware, and `auth()` then throws. Callers treat a
 * null here as "not signed in", which is the safe reading.
 */
export async function getClerkUserId(): Promise<string | null> {
  if (!isClerkConfigured) return null;
  try {
    const { userId } = await auth();
    return userId ?? null;
  } catch (error) {
    console.error("[auth] session lookup failed", error);
    return null;
  }
}

/**
 * Role as advertised by the session token, when the Clerk instance is
 * configured to expose public metadata as a claim. Only a hint — never the
 * basis for granting access.
 */
export async function getRoleHint(): Promise<Role | null> {
  if (!isClerkConfigured) return null;
  try {
    const { sessionClaims } = await auth();
    const claims = sessionClaims as
      | { metadata?: ClerkPublicMetadata; publicMetadata?: ClerkPublicMetadata }
      | null;
    return roleFromUnknown(claims?.metadata?.role ?? claims?.publicMetadata?.role);
  } catch {
    return null;
  }
}

function primaryEmail(clerkUser: Awaited<ReturnType<typeof currentUser>>): string | null {
  if (!clerkUser) return null;
  const primary = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  );
  return primary?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? null;
}

function primaryPhone(clerkUser: Awaited<ReturnType<typeof currentUser>>): string | null {
  if (!clerkUser) return null;
  const primary = clerkUser.phoneNumbers.find((p) => p.id === clerkUser.primaryPhoneNumberId);
  return primary?.phoneNumber ?? clerkUser.phoneNumbers[0]?.phoneNumber ?? null;
}

function storedPhone(clerkUser: Awaited<ReturnType<typeof currentUser>>): string | null {
  const fromClerk = primaryPhone(clerkUser);
  if (fromClerk) return fromClerk;
  const raw =
    clerkUser && clerkUser.publicMetadata && typeof clerkUser.publicMetadata === "object"
      ? (clerkUser.publicMetadata as { phone?: unknown }).phone
      : null;
  const local = indianMobile(typeof raw === "string" ? raw : "");
  return local ? e164India(local) : null;
}

/**
 * Resolves the signed-in user, provisioning the Postgres row on first sight.
 *
 * Lazy provisioning matters because webhook delivery is not guaranteed to land
 * before the user's first authenticated request.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const clerkId = await getClerkUserId();
  if (!clerkId) return null;
  if (!isDatabaseConfigured) return null;

  const existing = await db.user.findUnique({ where: { clerkId } });
  if (existing) {
    const expired = await expireMembershipIfNeeded(existing.id);
    const fresh = expired
      ? ((await db.user.findUnique({ where: { id: existing.id } })) ?? existing)
      : existing;
    const user = await touchLastSeen(fresh);
    return { clerkId, user, role: user.role };
  }

  const clerkUser = await currentUser();
  const email = primaryEmail(clerkUser);
  if (!clerkUser || !email) return null;

  const phone = storedPhone(clerkUser);
  const created = await db.user.upsert({
    where: { email },
    update: {
      clerkId,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      imageUrl: clerkUser.imageUrl,
      ...(phone ? { phone } : {}),
      mfaEnabled: clerkUser.twoFactorEnabled ?? false,
    },
    create: {
      clerkId,
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      imageUrl: clerkUser.imageUrl,
      phone,
      mfaEnabled: clerkUser.twoFactorEnabled ?? false,
      role: Role.USER,
      status: UserStatus.ACTIVE,
      kycStatus: KycStatus.NOT_STARTED,
    },
  });

  await recordAudit({
    action: AuditAction.UserCreated,
    actorUserId: created.id,
    actorClerkId: clerkId,
    actorRole: created.role,
    targetType: "user",
    targetId: created.id,
    context: await requestContext(),
    metadata: { provisionedBy: "lazy-session" },
  });

  await mirrorRoleToClerk(clerkId, created);
  const user = await touchLastSeen(created);
  return { clerkId, user, role: user.role };
}

const LAST_SEEN_MS = 2 * 60 * 1000;

async function touchLastSeen(user: User): Promise<User> {
  const seen = user.lastSeenAt?.getTime() ?? 0;
  if (Date.now() - seen < LAST_SEEN_MS) return user;
  return db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
}

/**
 * Pushes role and verification state into Clerk publicMetadata.
 * Failures are logged but never block the database write that preceded them.
 */
export async function mirrorRoleToClerk(
  clerkId: string,
  user: Pick<User, "role" | "kycStatus" | "panVerified">
): Promise<void> {
  try {
    const client = await clerkClient();
    const metadata: ClerkPublicMetadata = {
      role: user.role,
      kycStatus: user.kycStatus,
      panVerified: user.panVerified,
    };
    await client.users.updateUserMetadata(clerkId, { publicMetadata: metadata });
  } catch (error) {
    console.error(`[auth] failed to mirror metadata for ${clerkId}`, error);
  }
}

/** True when the caller has completed TOTP/second-factor enrollment in Clerk. */
export async function hasMfaEnrolled(): Promise<boolean> {
  const clerkUser = await currentUser();
  if (!clerkUser) return false;
  return Boolean(clerkUser.twoFactorEnabled);
}

export async function refreshMfaFlag(clerkId: string, userId: string): Promise<boolean> {
  const enrolled = await hasMfaEnrolled();
  await db.user.update({ where: { id: userId }, data: { mfaEnabled: enrolled } });
  return enrolled;
}
