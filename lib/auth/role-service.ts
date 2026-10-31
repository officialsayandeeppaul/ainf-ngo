import { Role, UserStatus, type User } from "@prisma/client";
import { AuditAction, recordAudit } from "../audit";
import { db } from "../db";
import type { RequestContext } from "../request-context";
import { DASHBOARD_NOTICE_CHANNEL, suspensionHasEnded, type ManualNoticeChannel } from "../suspension";
import { sendSuspensionNotice, type SuspensionNoticeResult } from "../suspension-notice";
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
  | "admin_identity"
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

/**
 * Suspends, bans or reinstates an account and tells the member (email, or SMS
 * for mobile-number accounts). A null actor is the automatic lift when a timed
 * suspension runs out.
 */
export async function setUserStatus(params: Parameters<typeof setUserStatusWithNotice>[0]): Promise<User> {
  return (await setUserStatusWithNotice(params)).user;
}

/** setUserStatus, plus what happened to the automatic notice (for the admin screen). */
export async function setUserStatusWithNotice(params: {
  targetUserId: string;
  status: UserStatus;
  reason?: string | null;
  /** When the suspension lifts by itself; null = until an admin reinstates. */
  until?: Date | null;
  actor: { userId: string; clerkId: string; role: Role } | null;
  context?: RequestContext | null;
}): Promise<{ user: User; notice: SuspensionNoticeResult | null }> {
  const { targetUserId, status, reason, actor, context } = params;
  const suspended = status !== UserStatus.ACTIVE;
  const until = suspended && status === UserStatus.SUSPENDED ? (params.until ?? null) : null;
  const before = await db.user.findUnique({ where: { id: targetUserId } });
  const wasActive = !before || before.status === UserStatus.ACTIVE;

  let user = await db.user.update({
    where: { id: targetUserId },
    data: {
      status,
      suspendedAt: suspended ? new Date() : null,
      suspendedReason: suspended ? (reason ?? null) : null,
      suspendedUntil: until,
      suspendedByUserId: suspended ? (actor?.userId ?? null) : null,
      suspensionNoticeChannel: null,
      suspensionNoticeSentAt: null,
    },
  });

  // Only tell the member when something changed for them.
  const notice =
    suspended
      ? await sendSuspensionNotice(user, { kind: "suspended", reason: reason ?? "", until })
      : wasActive
        ? null
        : await sendSuspensionNotice(user, { kind: "reinstated" });
  if (suspended && notice) {
    user = await db.user.update({
      where: { id: user.id },
      data: {
        suspensionNoticeChannel: notice.sent ? notice.channel : null,
        suspensionNoticeSentAt: notice.sent ? new Date() : null,
      },
    });
  }

  await recordAudit({
    action: suspended ? AuditAction.UserSuspended : AuditAction.UserReinstated,
    actorUserId: actor?.userId ?? null,
    actorClerkId: actor?.clerkId ?? null,
    actorRole: actor?.role ?? null,
    targetType: "user",
    targetId: user.id,
    context: context ?? null,
    metadata: {
      status,
      reason: reason ?? null,
      until: until ? until.toISOString() : null,
      automatic: actor === null,
      notice: notice ? { channel: notice.channel, sent: notice.sent, error: notice.error } : null,
    },
  });

  return { user, notice };
}

type Actor = { userId: string; clerkId: string; role: Role };

/** Tries the automatic suspension email / SMS again for a suspended account. */
export async function resendSuspensionNotice(params: {
  user: User;
  actor: Actor;
  context?: RequestContext | null;
}): Promise<{ user: User; notice: SuspensionNoticeResult }> {
  const { actor, context } = params;
  const notice = await sendSuspensionNotice(params.user, {
    kind: "suspended",
    reason: params.user.suspendedReason ?? "",
    until: params.user.suspendedUntil,
  });
  const user = notice.sent
    ? await db.user.update({
        where: { id: params.user.id },
        data: { suspensionNoticeChannel: notice.channel, suspensionNoticeSentAt: new Date() },
      })
    : params.user;
  await recordAudit({
    action: AuditAction.SuspensionNoticeSent,
    actorUserId: actor.userId,
    actorClerkId: actor.clerkId,
    actorRole: actor.role,
    success: notice.sent,
    targetType: "user",
    targetId: user.id,
    context: context ?? null,
    metadata: { channel: notice.channel, sent: notice.sent, error: notice.error, manual: false },
  });
  return { user, notice };
}

/** The admin told the member themselves (WhatsApp, a call…). Recorded and audited. */
export async function recordManualSuspensionNotice(params: {
  user: User;
  channel: ManualNoticeChannel;
  actor: Actor;
  context?: RequestContext | null;
}): Promise<User> {
  const { actor, context, channel } = params;
  const user = await db.user.update({
    where: { id: params.user.id },
    data: { suspensionNoticeChannel: channel, suspensionNoticeSentAt: new Date() },
  });
  await recordAudit({
    action: AuditAction.SuspensionNoticeSent,
    actorUserId: actor.userId,
    actorClerkId: actor.clerkId,
    actorRole: actor.role,
    targetType: "user",
    targetId: user.id,
    context: context ?? null,
    metadata: { channel, sent: true, manual: true },
  });
  return user;
}

/**
 * The member opened the suspended page, so they have seen the reason and end
 * date. Recorded once, and only when nobody had told them yet, so the admin
 * sees "Seen at sign-in" without needing WhatsApp or email.
 */
export async function recordSuspensionSeen(params: {
  user: User;
  context?: RequestContext | null;
}): Promise<boolean> {
  const { user, context } = params;
  if (user.status === UserStatus.ACTIVE || user.suspensionNoticeSentAt) return false;
  const { count } = await db.user.updateMany({
    where: { id: user.id, status: { not: UserStatus.ACTIVE }, suspensionNoticeSentAt: null },
    data: { suspensionNoticeChannel: DASHBOARD_NOTICE_CHANNEL, suspensionNoticeSentAt: new Date() },
  });
  if (count === 0) return false;
  await recordAudit({
    action: AuditAction.SuspensionNoticeSent,
    actorUserId: user.id,
    actorClerkId: user.clerkId,
    actorRole: user.role,
    targetType: "user",
    targetId: user.id,
    context: context ?? null,
    metadata: { channel: DASHBOARD_NOTICE_CHANNEL, sent: true, manual: false },
  });
  return true;
}

/** Lifts a timed suspension whose end has passed. Returns the fresh user, or the same one. */
export async function liftEndedSuspension(user: User): Promise<User> {
  if (!suspensionHasEnded(user)) return user;
  return setUserStatus({ targetUserId: user.id, status: UserStatus.ACTIVE, actor: null });
}

export async function countSuperAdmins(): Promise<number> {
  return db.user.count({ where: { role: Role.SUPER_ADMIN } });
}
