import { KycStatus, Role, type User } from "@prisma/client";
import { AuditAction, recordAudit } from "./audit";
import { changeRole, revokeVerified } from "./auth/role-service";
import { db } from "./db";
import { identityReadyForMembership } from "./donation-rules";
import { sendKycApprovedEmail } from "./email";
import type { RequestContext } from "./request-context";
import { getVerificationPolicy, type VerificationPolicy } from "./verification-policy";

/**
 * Super admin identity override: mark a member verified without Didit, PAN,
 * or OTP, and take that back later.
 *
 * Verifying sets the same fields the real checks set (kycStatus APPROVED,
 * panVerified) so every gate — membership checkout, the verify page, the
 * VERIFIED_USER role — opens without special cases, and stamps who did it.
 * Removing it rebuilds those fields from the member's own records, so someone
 * who had genuinely passed a check keeps that standing.
 */

type Actor = { userId: string; clerkId: string; role: Role };

export type OwnRecords = {
  /** Didit sessions, newest first. */
  kyc: Array<{ status: KycStatus }>;
  pan: Array<{ status: string }>;
  otpVerified: boolean;
};

/** What the member's identity fields are without the admin override. */
export function identityFromOwnRecords(
  records: OwnRecords,
  policy: Pick<VerificationPolicy, "didit">
): { kycStatus: KycStatus; panVerified: boolean } {
  const panVerified = records.pan.some((row) => row.status === "VERIFIED");
  const latest = records.kyc[0]?.status ?? null;
  const approved =
    latest === KycStatus.APPROVED ||
    records.kyc.some((row) => row.status === KycStatus.APPROVED) ||
    records.otpVerified ||
    (!policy.didit && panVerified);
  if (approved) return { kycStatus: KycStatus.APPROVED, panVerified };
  return { kycStatus: latest ?? KycStatus.NOT_STARTED, panVerified };
}

export async function verifyIdentityByAdmin(input: {
  userId: string;
  note?: string | null;
  notify: boolean;
  actor: Actor;
  context?: RequestContext | null;
}): Promise<{ ok: true; user: User } | { ok: false; status: number; message: string }> {
  const user = await db.user.findUnique({ where: { id: input.userId } });
  if (!user) return { ok: false, status: 404, message: "User not found." };

  const note = input.note?.trim() || null;
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      kycStatus: KycStatus.APPROVED,
      panVerified: true,
      identityVerifiedByAdminAt: new Date(),
      identityVerifiedByUserId: input.actor.userId,
      identityVerifiedNote: note,
    },
  });

  const promoted =
    user.role === Role.USER
      ? await changeRole({
          targetUserId: user.id,
          nextRole: Role.VERIFIED_USER,
          reason: "admin_identity",
          actor: input.actor,
          context: input.context ?? null,
        })
      : updated;

  await recordAudit({
    action: AuditAction.IdentityVerifiedByAdmin,
    actorUserId: input.actor.userId,
    actorClerkId: input.actor.clerkId,
    actorRole: input.actor.role,
    targetType: "user",
    targetId: user.id,
    context: input.context ?? null,
    metadata: {
      previousKyc: user.kycStatus,
      previousPan: user.panVerified,
      note,
    },
  });

  if (input.notify && !user.identityVerifiedByAdminAt && user.kycStatus !== KycStatus.APPROVED) {
    try {
      await sendKycApprovedEmail(user);
    } catch {
      // Standing is granted either way.
    }
  }

  return { ok: true, user: { ...updated, role: promoted.role } };
}

export async function removeIdentityOverride(input: {
  userId: string;
  actor: Actor;
  context?: RequestContext | null;
}): Promise<{ ok: true; user: User; stillVerified: boolean } | { ok: false; status: number; message: string }> {
  const user = await db.user.findUnique({ where: { id: input.userId } });
  if (!user) return { ok: false, status: 404, message: "User not found." };
  if (!user.identityVerifiedByAdminAt) {
    return { ok: false, status: 409, message: "This member was not verified by an admin." };
  }

  const [kyc, pan, otp] = await Promise.all([
    db.kycVerification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { status: true },
      take: 20,
    }),
    db.panVerification.findMany({ where: { userId: user.id }, select: { status: true }, take: 20 }),
    db.auditLog.count({ where: { actorUserId: user.id, action: AuditAction.OtpVerified } }),
  ]);
  const policy = getVerificationPolicy();
  const own = identityFromOwnRecords({ kyc, pan, otpVerified: otp > 0 }, policy);

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      kycStatus: own.kycStatus,
      panVerified: own.panVerified,
      identityVerifiedByAdminAt: null,
      identityVerifiedByUserId: null,
      identityVerifiedNote: null,
    },
  });

  const stillVerified = identityReadyForMembership(own, policy);
  let role = updated.role;
  if (!stillVerified && user.role === Role.VERIFIED_USER) {
    const demoted = await revokeVerified({
      targetUserId: user.id,
      reason: "kyc_revoked",
      actor: input.actor,
      context: input.context ?? null,
      metadata: { source: "admin_verification_removed" },
    });
    role = demoted?.role ?? role;
  }

  await recordAudit({
    action: AuditAction.IdentityAdminVerificationRemoved,
    actorUserId: input.actor.userId,
    actorClerkId: input.actor.clerkId,
    actorRole: input.actor.role,
    targetType: "user",
    targetId: user.id,
    context: input.context ?? null,
    metadata: {
      kycStatus: own.kycStatus,
      panVerified: own.panVerified,
      stillVerified,
    },
  });

  return { ok: true, user: { ...updated, role }, stillVerified };
}

/**
 * An admin made this account a plain Member again: their identity standing goes
 * with it, so the verify page offers every step afresh. Their Didit and PAN
 * history stays on file; an active membership is not ended.
 */
export async function clearIdentityForMember(input: {
  userId: string;
  actor: Actor;
  context?: RequestContext | null;
}): Promise<User | null> {
  const user = await db.user.findUnique({ where: { id: input.userId } });
  if (!user) return null;
  if (user.kycStatus === KycStatus.NOT_STARTED && !user.panVerified && !user.identityVerifiedByAdminAt) return user;

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      kycStatus: KycStatus.NOT_STARTED,
      panVerified: false,
      identityVerifiedByAdminAt: null,
      identityVerifiedByUserId: null,
      identityVerifiedNote: null,
    },
  });
  await recordAudit({
    action: AuditAction.IdentityAdminVerificationRemoved,
    actorUserId: input.actor.userId,
    actorClerkId: input.actor.clerkId,
    actorRole: input.actor.role,
    targetType: "user",
    targetId: user.id,
    context: input.context ?? null,
    metadata: { source: "made_member", previousKyc: user.kycStatus, previousPan: user.panVerified },
  });
  return updated;
}

/**
 * Verified members whose identity fields never caught up (an admin gave them the
 * role before the role change also marked the identity) are treated as verified
 * by the team, so they are not asked to verify again or blocked from a plan.
 */
export async function healVerifiedRole(user: User): Promise<User> {
  if (user.role !== Role.VERIFIED_USER) return user;
  if (identityReadyForMembership(user, getVerificationPolicy())) return user;
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      kycStatus: KycStatus.APPROVED,
      panVerified: true,
      identityVerifiedByAdminAt: user.identityVerifiedByAdminAt ?? new Date(),
      identityVerifiedNote: user.identityVerifiedNote ?? "Given the verified member role by an admin",
    },
  });
  await recordAudit({
    action: AuditAction.IdentityVerifiedByAdmin,
    targetType: "user",
    targetId: user.id,
    metadata: { source: "verified_role", previousKyc: user.kycStatus, previousPan: user.panVerified },
  });
  return updated;
}
