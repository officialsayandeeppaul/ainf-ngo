import {
  BillingInterval,
  MembershipChangeKind,
  MembershipOrderStatus,
  type MembershipOrder,
  type Role,
} from "@prisma/client";
import { AuditAction, recordAudit } from "./audit";
import { db } from "./db";
import { sendMembershipGrantedEmail } from "./email";
import { ensureMembershipCard } from "./membership-card";
import { addUtcMonths, membershipIsLive } from "./membership-state";
import { cancelRazorpaySubscription } from "./razorpay";
import type { RequestContext } from "./request-context";

/**
 * A super admin makes a signed-up account a member without payment or
 * identity checks. The grant is an ordinary PAID order for ₹0 marked with who
 * granted it, so the badge, card, CRM history, and expiry sweep all treat it
 * like any other term. A grant replaces whatever term the member had and stops
 * any auto-renew mandate, so nobody is charged for a plan they no longer hold.
 */

export const GRANT_LENGTHS = ["1m", "3m", "6m", "1y", "2y", "5y", "custom"] as const;
export type GrantLength = (typeof GRANT_LENGTHS)[number];

const MONTHS: Record<Exclude<GrantLength, "custom">, number> = {
  "1m": 1,
  "3m": 3,
  "6m": 6,
  "1y": 12,
  "2y": 24,
  "5y": 60,
};

const MAX_GRANT_MS = 10 * 366 * 86_400_000;

/** End of the granted term, or null when a custom date is missing, past, or too far out. */
export function grantEndDate(length: GrantLength, now = new Date(), customDay?: string | null): Date | null {
  if (length !== "custom") return addUtcMonths(now, MONTHS[length]);
  if (!customDay || !/^\d{4}-\d{2}-\d{2}$/.test(customDay)) return null;
  const end = new Date(`${customDay}T23:59:59.000Z`);
  if (Number.isNaN(end.getTime())) return null;
  if (end.getTime() <= now.getTime() + 3_600_000) return null;
  if (end.getTime() - now.getTime() > MAX_GRANT_MS) return null;
  return end;
}

/** Terms of a year or more read as yearly everywhere the cycle is shown. */
export function grantInterval(now: Date, end: Date): BillingInterval {
  return addUtcMonths(now, 12).getTime() <= end.getTime() + 86_400_000 ? BillingInterval.YEARLY : BillingInterval.MONTHLY;
}

export async function grantMembership(input: {
  userId: string;
  tierId: string;
  endsAt: Date;
  note?: string | null;
  notify: boolean;
  actor: { userId: string; clerkId: string; role: Role };
  context?: RequestContext | null;
}): Promise<
  | { ok: true; order: MembershipOrder; expiresAt: Date; cardRegNo: string | null; cancelledMandate: boolean }
  | { ok: false; status: number; message: string }
> {
  const [user, tier] = await Promise.all([
    db.user.findUnique({ where: { id: input.userId }, include: { membershipTier: true } }),
    db.membershipTier.findUnique({ where: { id: input.tierId } }),
  ]);
  if (!user) return { ok: false, status: 404, message: "That account was not found. They need to sign up first." };
  if (!tier) return { ok: false, status: 404, message: "That plan was not found." };

  const now = new Date();
  if (input.endsAt.getTime() <= now.getTime()) {
    return { ok: false, status: 400, message: "Choose an end date in the future." };
  }

  let cancelledMandate = false;
  if (user.membershipSubscriptionId) {
    try {
      await cancelRazorpaySubscription(user.membershipSubscriptionId, false);
      cancelledMandate = true;
    } catch {
      // Already gone at Razorpay; clearing it locally below is what matters.
      cancelledMandate = true;
    }
  }

  const live = membershipIsLive(user, now);
  const changeKind = !live
    ? MembershipChangeKind.NEW
    : user.membershipTierId === tier.id
      ? MembershipChangeKind.RENEWAL
      : tier.monthlyPaise >= (user.membershipTier?.monthlyPaise ?? 0)
        ? MembershipChangeKind.UPGRADE
        : MembershipChangeKind.DOWNGRADE;
  const interval = grantInterval(now, input.endsAt);
  const note = input.note?.trim() || null;

  const [order] = await db.$transaction([
    db.membershipOrder.create({
      data: {
        userId: user.id,
        tierId: tier.id,
        interval,
        amountPaise: 0,
        listPaise: 0,
        previousTierId: user.membershipTierId,
        changeKind,
        restartTerm: true,
        recurring: false,
        status: MembershipOrderStatus.PAID,
        paidAt: now,
        grantedByUserId: input.actor.userId,
        grantNote: note,
      },
    }),
    db.user.update({
      where: { id: user.id },
      data: {
        membershipTierId: tier.id,
        membershipInterval: interval,
        membershipExpiresAt: input.endsAt,
        membershipPeriodStartedAt: now,
        membershipTermPaise: 0,
        membershipSubscriptionId: null,
        membershipCancelAtPeriodEnd: false,
      },
    }),
  ]);

  const card = await ensureMembershipCard(user.id);

  await recordAudit({
    action: AuditAction.MembershipGranted,
    actorUserId: input.actor.userId,
    actorClerkId: input.actor.clerkId,
    actorRole: input.actor.role,
    targetType: "user",
    targetId: user.id,
    context: input.context ?? null,
    metadata: {
      tierName: tier.name,
      badge: tier.badge,
      until: input.endsAt.toISOString(),
      previousTier: user.membershipTier?.name ?? null,
      cancelledMandate,
      regNo: card?.regNo ?? null,
      note,
    },
  });

  if (input.notify) {
    try {
      await sendMembershipGrantedEmail({
        to: user.email,
        firstName: user.firstName,
        tierName: tier.name,
        expiresAt: input.endsAt,
      });
    } catch {
      // The grant stands even if the courtesy email bounces.
    }
  }

  return { ok: true, order, expiresAt: input.endsAt, cardRegNo: card?.regNo ?? null, cancelledMandate };
}
