import { Role, UserStatus, type User } from "@prisma/client";
import { AuditAction, recordAudit } from "../audit";
import { db } from "../db";
import type { RequestContext } from "../request-context";
import { mirrorRoleToClerk } from "./session";

/**
 * The single place roles change.
 *
 * Every mutation writes Postgres first (the authority), then mirrors to Clerk
 * publicMetadata, then audits. Callers never touch `db.user.update({ role })`
 * directly, which keeps the audit trail complete by construction.
 */

export type RoleChangeReason =
  | "kyc_approved"
  | "kyc_revoked"
  | "otp_verified"
  | "pan_verified"
  | "admin_manual"
  | "bootstrap"
  | "admin_demote";

export async function changeRole(params: {
  targetUserId: string;
  nextRole: Role;
  reason: RoleChangeReason;
  actor?: { userId: string; clerkId: string; role: Role } | null;
  context?: RequestContext | null;
  metadata?: Record<string, unknown>;
}): Promise<User> {
  const { targetUserId, nextRole, reason, actor, context, metadata } = params;

  const before = await db.user.findUnique({ where: { id: targetUserId } });
  if (!before) throw new Error(`User ${targetUserId} not found`);

  if (before.role === nextRole) {
    return before;
  }

  const after = await db.user.update({
    where: { id: targetUserId },
    data: { role: nextRole },
  });

  await mirrorRoleToClerk(after.clerkId, after);

  await recordAudit({
    action: AuditAction.RoleChanged,
    actorUserId: actor?.userId ?? after.id,
    actorClerkId: actor?.clerkId ?? after.clerkId,
    actorRole: actor?.role ?? null,
    targetType: "user",
    targetId: after.id,
    context: context ?? null,
    metadata: {
      from: before.role,
      to: nextRole,
      reason,
      selfInflicted: !actor || actor.userId === after.id,
      ...metadata,
    },
  });

  return after;
}

/**
 * Promotes a USER to VERIFIED_USER after a successful identity check.
 * Never demotes and never touches SUPER_ADMIN, so an approved KYC result
 * cannot strip an administrator's privileges.
 */
export async function promoteToVerified(params: {
  targetUserId: string;
  reason: RoleChangeReason;
  context?: RequestContext | null;
  metadata?: Record<string, unknown>;
}): Promise<User | null> {
  const user = await db.user.findUnique({ where: { id: params.targetUserId } });
  if (!user) return null;
  if (user.role !== Role.USER) return user;

  return changeRole({
    targetUserId: user.id,
    nextRole: Role.VERIFIED_USER,
    reason: params.reason,
    actor: null,
    context: params.context,
    metadata: params.metadata,
  });
}

/** Revokes verified standing, e.g. after a KYC decision is overturned. */
export async function revokeVerified(params: {
  targetUserId: string;
  reason: RoleChangeReason;
  actor?: { userId: string; clerkId: string; role: Role } | null;
  context?: RequestContext | null;
  metadata?: Record<string, unknown>;
}): Promise<User | null> {
  const user = await db.user.findUnique({ where: { id: params.targetUserId } });
  if (!user) return null;
  if (user.role !== Role.VERIFIED_USER) return user;
  return changeRole({ ...params, nextRole: Role.USER });
}

export async function setUserStatus(params: {
  targetUserId: string;
  status: UserStatus;
  reason?: string | null;
  actor: { userId: string; clerkId: string; role: Role };
  context?: RequestContext | null;
}): Promise<User> {
  const { targetUserId, status, reason, actor, context } = params;
  const suspended = status !== UserStatus.ACTIVE;

  const user = await db.user.update({
    where: { id: targetUserId },
    data: {
      status,
      suspendedAt: suspended ? new Date() : null,
      suspendedReason: suspended ? (reason ?? null) : null,
    },
  });

  await recordAudit({
    action: suspended ? AuditAction.UserSuspended : AuditAction.UserReinstated,
    actorUserId: actor.userId,
    actorClerkId: actor.clerkId,
    actorRole: actor.role,
    targetType: "user",
    targetId: user.id,
    context: context ?? null,
    metadata: { status, reason: reason ?? null },
  });

  return user;
}

export async function countSuperAdmins(): Promise<number> {
  return db.user.count({ where: { role: Role.SUPER_ADMIN } });
}
