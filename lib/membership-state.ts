export const PENDING_ORDER_MS = 45 * 60 * 1000;

export type MembershipSnapshot = {
  membershipTierId: string | null;
  membershipExpiresAt: Date | null;
};

export function membershipIsLive(input: MembershipSnapshot, now = new Date()): boolean {
  return Boolean(
    input.membershipTierId &&
      input.membershipExpiresAt &&
      input.membershipExpiresAt.getTime() > now.getTime()
  );
}

/** True when a stored badge should be cleared (expired or missing an end date). */
export function shouldStripBadge(input: MembershipSnapshot, now = new Date()): boolean {
  if (!input.membershipTierId) return false;
  if (!input.membershipExpiresAt) return true;
  return input.membershipExpiresAt.getTime() <= now.getTime();
}

export function nextExpiry(from: Date, interval: "MONTHLY" | "YEARLY"): Date {
  if (interval === "YEARLY") {
    const expires = new Date(from.getTime());
    expires.setUTCFullYear(expires.getUTCFullYear() + 1);
    return expires;
  }
  return addUtcMonths(from, 1);
}

export function addUtcMonths(from: Date, months: number): Date {
  const expires = new Date(from.getTime());
  const day = expires.getUTCDate();
  expires.setUTCDate(1);
  expires.setUTCMonth(expires.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(expires.getUTCFullYear(), expires.getUTCMonth() + 1, 0)).getUTCDate();
  expires.setUTCDate(Math.min(day, lastDay));
  return expires;
}

export function extendExpiry(
  current: Date | null,
  interval: "MONTHLY" | "YEARLY",
  now = new Date()
): Date {
  const base = current && current.getTime() > now.getTime() ? current : now;
  return nextExpiry(base, interval);
}

export function canStartPayment(input: {
  live: boolean;
  pendingCreatedAt: Date | null;
  now?: Date;
  switching?: boolean;
}): { ok: true } | { ok: false; reason: "active" | "pending" } {
  const now = input.now ?? new Date();
  if (
    input.pendingCreatedAt &&
    now.getTime() - input.pendingCreatedAt.getTime() < PENDING_ORDER_MS
  ) {
    return { ok: false, reason: "pending" };
  }
  if (input.live && !input.switching) return { ok: false, reason: "active" };
  return { ok: true };
}

export function paymentBlockMessage(reason: "active" | "pending" | "same"): string {
  if (reason === "active") {
    return "This account already has an active membership. Upgrade or downgrade from Your plan, or wait until the current term expires.";
  }
  if (reason === "same") {
    return "You are already on this plan and billing cycle.";
  }
  return "A Razorpay checkout is already open for this account. Finish it or wait 45 minutes.";
}

export type CaptureKind = "unknown" | "duplicate" | "first" | "attach" | "renewal";

/**
 * Decide how an inbound Razorpay capture should land on local orders.
 * `attach` is the same first payment arriving twice (order.paid then payment.captured).
 * `renewal` is a later subscription charge and must become its own payment row.
 */
export function classifyMembershipCapture(input: {
  paymentAlreadyRecorded: boolean;
  seed: {
    status: string;
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
  } | null;
  incomingOrderId?: string | null;
  incomingPaymentId?: string | null;
}): CaptureKind {
  if (input.paymentAlreadyRecorded) return "duplicate";
  if (!input.seed) return "unknown";
  if (input.seed.status === "CREATED" || input.seed.status === "FAILED") return "first";
  if (input.seed.status === "PAID") {
    const sameOrder = Boolean(
      input.incomingOrderId && input.incomingOrderId === input.seed.razorpayOrderId
    );
    const attachPayment = !input.seed.razorpayPaymentId && Boolean(input.incomingPaymentId);
    if (sameOrder || attachPayment) return "attach";
    if (input.incomingPaymentId) return "renewal";
    return "duplicate";
  }
  if (input.incomingPaymentId) return "renewal";
  return "unknown";
}
