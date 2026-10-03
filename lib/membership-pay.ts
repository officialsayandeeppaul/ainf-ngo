import { BillingInterval, MembershipChangeKind, MembershipOrderStatus, type MembershipOrder, type MembershipTier, type User } from "@prisma/client";
import { AuditAction, recordAudit } from "./audit";
import { db } from "./db";
import { quoteForUser } from "./membership-checkout";
import {
  classifyMembershipCapture,
  extendExpiry,
  membershipIsLive,
  nextExpiry,
  shouldStripBadge,
} from "./membership-state";
import { ensureMembershipCard } from "./membership-card";
import { sendMembershipReceiptEmail } from "./email";
import { cancelRazorpaySubscription, createRazorpaySubscription } from "./razorpay";

/** Best-effort payment confirmation. A bounce must never fail a capture. */
async function notifyMembershipPaid(order: MembershipOrder): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: order.userId },
      select: { email: true, firstName: true, membershipExpiresAt: true },
    });
    if (!user?.email || !user.membershipExpiresAt) return;
    const tier = await db.membershipTier.findUnique({
      where: { id: order.tierId },
      select: { name: true },
    });
    await sendMembershipReceiptEmail({
      to: user.email,
      firstName: user.firstName,
      tierName: tier?.name ?? "AINF membership",
      amountPaise: order.amountPaise,
      interval: order.interval === BillingInterval.YEARLY ? "YEARLY" : "MONTHLY",
      expiresAt: user.membershipExpiresAt,
    });
  } catch {
    // Local payment state is authoritative; email is a courtesy.
  }
}

export function membershipExpiry(from: Date, interval: BillingInterval): Date {
  return extendExpiry(null, interval === BillingInterval.YEARLY ? "YEARLY" : "MONTHLY", from);
}

export async function expireMembershipIfNeeded(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !shouldStripBadge(user)) return false;

  await db.user.update({
    where: { id: userId },
    data: {
      membershipTierId: null,
      membershipInterval: null,
      membershipExpiresAt: null,
      membershipSubscriptionId: null,
      membershipCancelAtPeriodEnd: false,
      membershipPeriodStartedAt: null,
      membershipTermPaise: null,
    },
  });
  await recordAudit({
    action: AuditAction.MembershipExpired,
    actorUserId: userId,
    targetType: "user",
    targetId: userId,
    metadata: { previousExpiresAt: user.membershipExpiresAt?.toISOString() ?? null },
  });
  return true;
}

/** Strip badges for every member whose term has already ended. */
export async function expireDueMemberships(limit = 80): Promise<number> {
  const now = new Date();
  const due = await db.user.findMany({
    where: {
      membershipTierId: { not: null },
      OR: [{ membershipExpiresAt: null }, { membershipExpiresAt: { lte: now } }],
    },
    select: { id: true },
    take: limit,
  });
  let stripped = 0;
  for (const row of due) {
    if (await expireMembershipIfNeeded(row.id)) stripped += 1;
  }
  return stripped;
}

async function findSeedOrder(input: {
  razorpayOrderId?: string | null;
  razorpaySubscriptionId?: string | null;
}): Promise<MembershipOrder | null> {
  if (input.razorpayOrderId) {
    const byOrder = await db.membershipOrder.findUnique({
      where: { razorpayOrderId: input.razorpayOrderId },
    });
    if (byOrder) return byOrder;
  }
  if (input.razorpaySubscriptionId) {
    return db.membershipOrder.findFirst({
      where: { razorpaySubscriptionId: input.razorpaySubscriptionId },
      orderBy: { createdAt: "asc" },
    });
  }
  return null;
}

type LiveUser = User & { membershipTier?: MembershipTier | null };

async function resolvePaidTerm(order: MembershipOrder, user: LiveUser, now: Date) {
  const interval = order.interval === BillingInterval.YEARLY ? "YEARLY" : "MONTHLY";
  if (order.restartTerm) {
    const tier = await db.membershipTier.findUnique({ where: { id: order.tierId } });
    if (tier) {
      const quote = await quoteForUser({ user, tier, interval: order.interval, now });
      return {
        expiresAt: quote.expiresAt,
        periodStartedAt: now,
        termPaise: quote.payablePaise,
      };
    }
    return {
      expiresAt: nextExpiry(now, interval),
      periodStartedAt: now,
      termPaise: order.listPaise ?? order.amountPaise,
    };
  }
  const expiresAt = extendExpiry(user.membershipExpiresAt ?? null, interval, now);
  const periodStartedAt =
    user.membershipExpiresAt && user.membershipExpiresAt.getTime() > now.getTime()
      ? user.membershipExpiresAt
      : now;
  return {
    expiresAt,
    periodStartedAt,
    termPaise: order.listPaise ?? order.amountPaise,
  };
}

async function startFutureSubscription(order: MembershipOrder, expiresAt: Date): Promise<string | null> {
  if (!order.razorpayPlanId) return null;
  const startAt = Math.floor(expiresAt.getTime() / 1000);
  if (startAt <= Math.floor(Date.now() / 1000) + 300) return null;
  try {
    const created = await createRazorpaySubscription({
      planId: order.razorpayPlanId,
      notes: { userId: order.userId, tierId: order.tierId, interval: String(order.interval) },
      startAt,
    });
    return created.id;
  } catch {
    return null;
  }
}

async function writeLiveMembership(
  order: MembershipOrder,
  user: LiveUser,
  now: Date,
  subscriptionId: string | null
) {
  const term = await resolvePaidTerm(order, user, now);
  let nextSub = subscriptionId;
  if (order.restartTerm) {
    const previous = user.membershipSubscriptionId;
    if (previous) {
      try {
        await cancelRazorpaySubscription(previous, false);
      } catch {
        // Local term is authoritative if Razorpay already dropped the old mandate.
      }
    }
    nextSub = (await startFutureSubscription(order, term.expiresAt)) ?? subscriptionId;
  }
  await db.user.update({
    where: { id: order.userId },
    data: {
      membershipTierId: order.tierId,
      membershipInterval: order.interval,
      membershipExpiresAt: term.expiresAt,
      membershipPeriodStartedAt: term.periodStartedAt,
      membershipTermPaise: term.termPaise,
      membershipSubscriptionId: nextSub,
      membershipCancelAtPeriodEnd: false,
    },
  });
  await ensureMembershipCard(order.userId);
}

export async function markOrderPaid(input: {
  razorpayOrderId?: string | null;
  razorpaySubscriptionId?: string | null;
  razorpayPaymentId?: string | null;
  razorpaySignature?: string | null;
}): Promise<{ ok: true; deduplicated: boolean } | { ok: false; reason: "unknown_order" }> {
  const existingPayment = input.razorpayPaymentId
    ? await db.membershipOrder.findUnique({
        where: { razorpayPaymentId: input.razorpayPaymentId },
      })
    : null;
  const seed = existingPayment ?? (await findSeedOrder(input));
  const kind = classifyMembershipCapture({
    paymentAlreadyRecorded: Boolean(existingPayment),
    seed,
    incomingOrderId: input.razorpayOrderId,
    incomingPaymentId: input.razorpayPaymentId,
  });
  if (kind === "unknown" || !seed) return { ok: false, reason: "unknown_order" };
  if (kind === "duplicate") return { ok: true, deduplicated: true };

  const now = new Date();
  const user = await db.user.findUnique({
    where: { id: seed.userId },
    include: { membershipTier: true },
  });
  if (!user) return { ok: false, reason: "unknown_order" };
  const subscriptionId =
    input.razorpaySubscriptionId ?? seed.razorpaySubscriptionId ?? user.membershipSubscriptionId ?? null;

  if (kind === "attach") {
    await db.membershipOrder.update({
      where: { id: seed.id },
      data: {
        razorpayOrderId: input.razorpayOrderId ?? seed.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId ?? seed.razorpayPaymentId,
        razorpaySignature: input.razorpaySignature ?? seed.razorpaySignature,
        razorpaySubscriptionId: subscriptionId,
      },
    });
    return { ok: true, deduplicated: true };
  }

  if (kind === "renewal") {
    const renewal = await db.membershipOrder.create({
      data: {
        userId: seed.userId,
        tierId: seed.tierId,
        interval: seed.interval,
        amountPaise: seed.amountPaise,
        listPaise: seed.listPaise ?? seed.amountPaise,
        recurring: true,
        changeKind: MembershipChangeKind.RENEWAL,
        status: MembershipOrderStatus.PAID,
        razorpayOrderId: input.razorpayOrderId || null,
        razorpaySubscriptionId: subscriptionId,
        razorpayPlanId: seed.razorpayPlanId,
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySignature: input.razorpaySignature,
        paidAt: now,
      },
    });
    await writeLiveMembership(renewal, user, now, subscriptionId);
    await notifyMembershipPaid(renewal);
    return { ok: true, deduplicated: false };
  }

  const paid = await db.membershipOrder.update({
    where: { id: seed.id },
    data: {
      status: MembershipOrderStatus.PAID,
      razorpayOrderId: input.razorpayOrderId ?? seed.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId ?? seed.razorpayPaymentId,
      razorpaySignature: input.razorpaySignature ?? seed.razorpaySignature,
      razorpaySubscriptionId: subscriptionId,
      paidAt: seed.paidAt ?? now,
    },
  });
  await writeLiveMembership(paid, user, now, subscriptionId);
  await notifyMembershipPaid(paid);
  return { ok: true, deduplicated: false };
}

export async function applyComplimentarySwitch(input: {
  user: LiveUser;
  tierId: string;
  interval: BillingInterval;
  quote: {
    kind: "new" | "same" | "upgrade" | "downgrade" | "interval";
    listPaise: number;
    payablePaise: number;
    creditPaise: number;
    duePaise: number;
    offerId: string | null;
  };
  changeKind: MembershipChangeKind;
  razorpayPlanId: string | null;
}): Promise<MembershipOrder> {
  const now = new Date();
  const order = await db.membershipOrder.create({
    data: {
      userId: input.user.id,
      tierId: input.tierId,
      interval: input.interval,
      amountPaise: 0,
      listPaise: input.quote.listPaise,
      creditPaise: input.quote.creditPaise,
      offerId: input.quote.offerId,
      previousTierId: input.user.membershipTierId,
      changeKind: input.changeKind,
      restartTerm: true,
      recurring: Boolean(input.razorpayPlanId),
      razorpayPlanId: input.razorpayPlanId,
      status: MembershipOrderStatus.PAID,
      paidAt: now,
    },
  });
  await writeLiveMembership(order, input.user, now, null);
  return order;
}

export async function cancelMembership(input: {
  userId: string;
  immediate: boolean;
  actorUserId?: string | null;
}): Promise<{ ok: true } | { ok: false; reason: "not_active" }> {
  const user = await db.user.findUnique({ where: { id: input.userId } });
  if (!user || !membershipIsLive(user)) return { ok: false, reason: "not_active" };

  const now = new Date();
  if (input.immediate) {
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          membershipTierId: null,
          membershipInterval: null,
          membershipExpiresAt: null,
          membershipSubscriptionId: null,
          membershipCancelAtPeriodEnd: false,
          membershipPeriodStartedAt: null,
          membershipTermPaise: null,
        },
      }),
      db.membershipOrder.updateMany({
        where: {
          userId: user.id,
          status: MembershipOrderStatus.PAID,
        },
        data: {
          status: MembershipOrderStatus.CANCELLED,
          cancelAtPeriodEnd: false,
          cancelledAt: now,
        },
      }),
    ]);
  } else {
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { membershipCancelAtPeriodEnd: true },
      }),
      db.membershipOrder.updateMany({
        where: {
          userId: user.id,
          status: MembershipOrderStatus.PAID,
        },
        data: { cancelAtPeriodEnd: true, cancelledAt: now },
      }),
    ]);
  }

  await recordAudit({
    action: input.immediate ? AuditAction.MembershipCancelled : AuditAction.MembershipCancelAtPeriodEnd,
    actorUserId: input.actorUserId ?? input.userId,
    targetType: "user",
    targetId: input.userId,
    metadata: { immediate: input.immediate },
  });
  return { ok: true };
}
