import {
  BillingInterval,
  DonationStatus,
  MembershipChangeKind,
  MembershipOrderStatus,
  PaymentInterestStatus,
  PaymentLinkStatus,
  PaymentPurpose,
  type PaymentLink,
  type Role,
} from "@prisma/client";
import { AuditAction, recordAudit } from "./audit";
import { db } from "./db";
import { paymentMatchesGift, type GiftKind } from "./donation-rules";
import { getGiftSettings, markGiftPaidFromPayment, newReceiptToken, resolveGiftTarget } from "./donations";
import { sendPaymentLinkEmail, type EmailResult } from "./email";
import { absoluteUrl } from "./env";
import { markOrderPaid } from "./membership-pay";
import { membershipIsLive } from "./membership-state";
import { interestLabel } from "./payment-interest";
import {
  cancelRazorpayPaymentLink,
  checkRazorpayKeys,
  createRazorpayPaymentLink,
  explainRazorpayError,
  fetchRazorpayPaymentLink,
  getRazorpayPayment,
  notifyRazorpayPaymentLink,
} from "./razorpay";
import type { RequestContext } from "./request-context";

/**
 * Razorpay payment links an admin sends to people who registered interest
 * while payments were paused.
 *
 * Each link is tied to exactly one local record created with it: a Donation
 * row for a gift, a MembershipOrder for a plan. Paying the link settles that
 * record through the same code a normal checkout uses (receipt email, badge,
 * card), so a link payment is indistinguishable downstream from a checkout.
 * Settlement can arrive three ways — the payer's redirect, the webhook, or an
 * admin "check status" — and is idempotent across all of them.
 */

export const LINK_EXPIRY_DAYS = [1, 3, 7, 14, 30] as const;
export const LINK_MIN_PAISE = 100;
export const MEMBERSHIP_LINK_MAX_PAISE = 10_000_000;

export type Actor = { userId: string; clerkId: string; role: Role };

type Failure = { ok: false; status: number; message: string };

/** Razorpay wants E.164. Indian mobiles are 10 digits starting 6–9. */
export function normalizeIndianContact(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) return `+${digits}`;
  if (trimmed.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function linkExpiry(days: number, now = new Date()): Date {
  const allowed = (LINK_EXPIRY_DAYS as readonly number[]).includes(days) ? days : 7;
  return new Date(now.getTime() + allowed * 86_400_000);
}

/** Which way a paid plan moves the member, judged when the link is made. */
export function membershipChangeFor(input: {
  live: boolean;
  currentTierId: string | null;
  currentMonthlyPaise: number | null;
  nextTierId: string;
  nextMonthlyPaise: number;
}): { changeKind: MembershipChangeKind; restartTerm: boolean } {
  if (!input.live || !input.currentTierId) return { changeKind: MembershipChangeKind.NEW, restartTerm: false };
  if (input.currentTierId === input.nextTierId) return { changeKind: MembershipChangeKind.RENEWAL, restartTerm: false };
  const up = input.nextMonthlyPaise >= (input.currentMonthlyPaise ?? 0);
  return { changeKind: up ? MembershipChangeKind.UPGRADE : MembershipChangeKind.DOWNGRADE, restartTerm: true };
}

function linkDescription(input: { purpose: PaymentPurpose; targetTitle: string; interval: BillingInterval | null }) {
  if (input.purpose === PaymentPurpose.MEMBERSHIP) {
    const cycle = input.interval === BillingInterval.YEARLY ? "yearly" : "monthly";
    return `AINF ${input.targetTitle} membership (${cycle})`;
  }
  return `Gift to AINF — ${input.targetTitle}`;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createLinkForInterest(input: {
  interestId: string;
  amountPaise: number;
  expiresInDays: number;
  notifySms: boolean;
  notifyEmail: boolean;
  sendAinfEmail: boolean;
  actor: Actor;
  context?: RequestContext | null;
}): Promise<{ ok: true; link: PaymentLink; email: EmailResult | null } | Failure> {
  const interest = await db.paymentInterest.findUnique({
    where: { id: input.interestId },
    include: { tier: true, links: { where: { status: PaymentLinkStatus.CREATED } } },
  });
  if (!interest) return { ok: false, status: 404, message: "Interest not found." };
  if (interest.status === PaymentInterestStatus.PAID) {
    return { ok: false, status: 409, message: "This interest is already paid." };
  }
  if (interest.status === PaymentInterestStatus.DISMISSED) {
    return { ok: false, status: 409, message: "Reopen this interest before sending a link." };
  }
  if (interest.links.length > 0) {
    return {
      ok: false,
      status: 409,
      message: "A payment link is already out for this interest. Resend it, or cancel it before making a new one.",
    };
  }
  if (!Number.isInteger(input.amountPaise) || input.amountPaise < LINK_MIN_PAISE) {
    return { ok: false, status: 400, message: "Enter an amount of at least ₹1." };
  }

  // Known-bad keys would only leave a failed gift or order row behind; stop before writing anything.
  if ((await checkRazorpayKeys()) === "rejected") {
    return { ok: false, status: 502, message: `Razorpay refused the link: ${explainRazorpayError("Authentication failed")}` };
  }

  const now = new Date();
  const expiresAt = linkExpiry(input.expiresInDays, now);
  const contact = normalizeIndianContact(interest.phone);
  const description = linkDescription(interest);

  let donationId: string | null = null;
  let membershipOrderId: string | null = null;

  if (interest.purpose === PaymentPurpose.DONATION) {
    const settings = await getGiftSettings();
    if (input.amountPaise > settings.maxPaise) {
      return { ok: false, status: 400, message: "That amount is above the maximum for a gift." };
    }
    const kind = (interest.donationKind ?? "GENERAL") as GiftKind;
    const resolved = await resolveGiftTarget({ kind, slug: interest.targetSlug });
    const donation = await db.donation.create({
      data: {
        kind,
        missionId: resolved.ok ? resolved.missionId : null,
        projectId: resolved.ok ? resolved.projectId : null,
        targetTitle: interest.targetTitle,
        amountPaise: input.amountPaise,
        donorName: interest.name,
        donorEmail: interest.email,
        donorPhone: interest.phone ?? "",
        receiptToken: newReceiptToken(),
        status: DonationStatus.CREATED,
      },
    });
    donationId = donation.id;
  } else {
    if (input.amountPaise > MEMBERSHIP_LINK_MAX_PAISE) {
      return { ok: false, status: 400, message: "That amount is above the membership link limit." };
    }
    if (!interest.userId || !interest.tierId || !interest.tier) {
      return { ok: false, status: 409, message: "This interest no longer points at a member and a plan." };
    }
    const user = await db.user.findUnique({
      where: { id: interest.userId },
      include: { membershipTier: true },
    });
    if (!user) return { ok: false, status: 404, message: "That member account no longer exists." };
    const change = membershipChangeFor({
      live: membershipIsLive(user),
      currentTierId: user.membershipTierId,
      currentMonthlyPaise: user.membershipTier?.monthlyPaise ?? null,
      nextTierId: interest.tier.id,
      nextMonthlyPaise: interest.tier.monthlyPaise,
    });
    const order = await db.membershipOrder.create({
      data: {
        userId: user.id,
        tierId: interest.tier.id,
        interval: interest.interval ?? BillingInterval.MONTHLY,
        amountPaise: input.amountPaise,
        listPaise: input.amountPaise,
        previousTierId: user.membershipTierId,
        changeKind: change.changeKind,
        restartTerm: change.restartTerm,
        recurring: false,
      },
    });
    membershipOrderId = order.id;
  }

  let link = await db.paymentLink.create({
    data: {
      purpose: interest.purpose,
      interestId: interest.id,
      amountPaise: input.amountPaise,
      description,
      customerName: interest.name,
      customerEmail: interest.email,
      customerPhone: contact,
      donationId,
      membershipOrderId,
      expiresAt,
      notifySms: input.notifySms && Boolean(contact),
      notifyEmail: input.notifyEmail,
      createdByUserId: input.actor.userId,
    },
  });

  try {
    const created = await createRazorpayPaymentLink({
      amountPaise: input.amountPaise,
      description,
      referenceId: link.id,
      customer: {
        name: interest.name.slice(0, 120),
        email: interest.email,
        ...(contact ? { contact } : {}),
      },
      notify: { sms: link.notifySms, email: link.notifyEmail },
      expireBy: Math.floor(expiresAt.getTime() / 1000),
      callbackUrl: absoluteUrl("/pay/done"),
      notes: {
        purpose: "payment_link",
        ainfLinkId: link.id,
        kind: interest.purpose.toLowerCase(),
        ...(donationId ? { donationId } : {}),
        ...(membershipOrderId ? { membershipOrderId } : {}),
      },
    });
    link = await db.paymentLink.update({
      where: { id: link.id },
      data: {
        razorpayLinkId: created.id,
        shortUrl: created.short_url,
        expiresAt: created.expire_by ? new Date(created.expire_by * 1000) : expiresAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Razorpay could not create the link.";
    await db.paymentLink.update({
      where: { id: link.id },
      data: { status: PaymentLinkStatus.FAILED, lastError: message.slice(0, 500) },
    });
    if (donationId) {
      await db.donation.update({ where: { id: donationId }, data: { status: DonationStatus.FAILED } });
    }
    if (membershipOrderId) {
      await db.membershipOrder.update({
        where: { id: membershipOrderId },
        data: { status: MembershipOrderStatus.FAILED },
      });
    }
    return { ok: false, status: 502, message: `Razorpay refused the link: ${explainRazorpayError(message)}` };
  }

  await db.paymentInterest.update({
    where: { id: interest.id },
    data: {
      status: PaymentInterestStatus.LINK_SENT,
      handledAt: now,
      handledByUserId: input.actor.userId,
    },
  });

  const email = input.sendAinfEmail ? await emailLink(link, interestLabel(interest)) : null;
  if (email?.sent) {
    link = await db.paymentLink.update({ where: { id: link.id }, data: { emailedAt: new Date() } });
  }

  await recordAudit({
    action: AuditAction.PaymentLinkCreated,
    actorUserId: input.actor.userId,
    actorClerkId: input.actor.clerkId,
    actorRole: input.actor.role,
    targetType: interest.userId ? "user" : "payment_interest",
    targetId: interest.userId ?? interest.id,
    context: input.context ?? null,
    metadata: {
      linkId: link.id,
      interestId: interest.id,
      purpose: interest.purpose,
      amountPaise: input.amountPaise,
      expiresAt: expiresAt.toISOString(),
      emailed: Boolean(email?.sent),
      sms: link.notifySms,
    },
  });

  return { ok: true, link, email };
}

async function emailLink(link: PaymentLink, what: string): Promise<EmailResult> {
  if (!link.shortUrl) return { sent: false, error: "no_url" };
  try {
    return await sendPaymentLinkEmail({
      to: link.customerEmail,
      name: link.customerName,
      what,
      amountPaise: link.amountPaise,
      url: link.shortUrl,
      expiresAt: link.expiresAt,
    });
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "email_failed" };
  }
}

// ---------------------------------------------------------------------------
// Settle
// ---------------------------------------------------------------------------

export type LinkPayment = {
  id: string;
  amount: number;
  currency: string | null | undefined;
  status: string | null | undefined;
  captured?: boolean;
  order_id?: string | null;
};

export type SettleResult =
  | { ok: true; deduplicated: boolean; link: PaymentLink }
  | { ok: false; reason: "amount" | "status" | "currency" | "fulfil"; message: string };

/**
 * Applies a captured payment to its link. The link is claimed first, so two
 * deliveries of the same payment cannot both fulfil; if fulfilment fails the
 * claim is released and the next delivery retries it.
 */
export async function settlePaymentLink(
  link: PaymentLink,
  payment: LinkPayment,
  source: "redirect" | "webhook" | "sync",
  context?: RequestContext | null
): Promise<SettleResult> {
  if (link.status === PaymentLinkStatus.PAID) return { ok: true, deduplicated: true, link };

  const check = paymentMatchesGift({
    storedPaise: link.amountPaise,
    paidPaise: payment.amount,
    currency: payment.currency,
    status: payment.status,
    captured: payment.captured,
  });
  if (!check.ok) {
    return {
      ok: false,
      reason: check.reason,
      message: check.reason === "amount" ? "The paid amount does not match this link." : "This payment is not captured.",
    };
  }

  const previous = link.status;
  const now = new Date();
  const claim = await db.paymentLink.updateMany({
    where: { id: link.id, status: { not: PaymentLinkStatus.PAID } },
    data: {
      status: PaymentLinkStatus.PAID,
      razorpayPaymentId: payment.id,
      razorpayOrderId: payment.order_id ?? link.razorpayOrderId,
      paidAt: now,
      lastError: null,
    },
  });
  if (claim.count !== 1) {
    const again = await db.paymentLink.findUnique({ where: { id: link.id } });
    if (again?.status === PaymentLinkStatus.PAID) return { ok: true, deduplicated: true, link: again };
    return { ok: false, reason: "fulfil", message: "This link could not be claimed." };
  }

  try {
    await fulfil(link, payment);
  } catch (error) {
    const message = error instanceof Error ? error.message : "fulfilment_failed";
    await db.paymentLink.updateMany({
      where: { id: link.id, razorpayPaymentId: payment.id },
      data: { status: previous, razorpayPaymentId: null, paidAt: null, lastError: message.slice(0, 500) },
    });
    throw error;
  }

  if (link.interestId) {
    await db.paymentInterest.update({
      where: { id: link.interestId },
      data: { status: PaymentInterestStatus.PAID, handledAt: now },
    });
  }

  const settled = (await db.paymentLink.findUnique({ where: { id: link.id } })) ?? link;
  await recordAudit({
    action: AuditAction.PaymentLinkPaid,
    targetType: "payment_link",
    targetId: link.id,
    context: context ?? null,
    metadata: {
      source,
      purpose: link.purpose,
      amountPaise: link.amountPaise,
      razorpayPaymentId: payment.id,
      interestId: link.interestId,
    },
  });
  return { ok: true, deduplicated: false, link: settled };
}

async function fulfil(link: PaymentLink, payment: LinkPayment): Promise<void> {
  if (link.donationId) {
    const marked = await markGiftPaidFromPayment({
      donationId: link.donationId,
      razorpayOrderId: payment.order_id ?? null,
      razorpayPaymentId: payment.id,
      amountPaise: payment.amount,
      currency: payment.currency,
      status: payment.status,
      captured: payment.captured,
    });
    if (!marked.ok) throw new Error(marked.message);
    return;
  }
  if (link.membershipOrderId) {
    const order = await db.membershipOrder.findUnique({ where: { id: link.membershipOrderId } });
    if (!order) throw new Error("The membership order for this link is gone.");
    if (order.status !== MembershipOrderStatus.PAID) {
      // A cancelled link that was paid anyway is still money taken: settle it as a first payment.
      await db.membershipOrder.update({
        where: { id: order.id },
        data: {
          status: MembershipOrderStatus.CREATED,
          cancelledAt: null,
          ...(!order.razorpayOrderId && payment.order_id ? { razorpayOrderId: payment.order_id } : {}),
        },
      });
    }
    const result = await markOrderPaid({
      membershipOrderId: order.id,
      razorpayOrderId: payment.order_id ?? order.razorpayOrderId,
      razorpayPaymentId: payment.id,
    });
    if (!result.ok) throw new Error("The membership order for this link could not be marked paid.");
    return;
  }
  throw new Error("This link is not tied to a gift or a membership.");
}

/** Finds the local link for a Razorpay link id, our reference id, or the note we attach. */
export async function findPaymentLink(input: {
  razorpayLinkId?: string | null;
  referenceId?: string | null;
}): Promise<PaymentLink | null> {
  if (input.razorpayLinkId) {
    const byRazorpay = await db.paymentLink.findUnique({ where: { razorpayLinkId: input.razorpayLinkId } });
    if (byRazorpay) return byRazorpay;
  }
  if (input.referenceId) {
    return db.paymentLink.findUnique({ where: { id: input.referenceId } });
  }
  return null;
}

/** Settles from a payment id alone, reading amount and status from Razorpay. */
export async function settleFromPaymentId(
  link: PaymentLink,
  paymentId: string,
  source: "redirect" | "webhook" | "sync",
  context?: RequestContext | null
): Promise<SettleResult> {
  const payment = await getRazorpayPayment(paymentId);
  return settlePaymentLink(
    link,
    {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      captured: payment.captured,
      order_id: payment.order_id,
    },
    source,
    context
  );
}

// ---------------------------------------------------------------------------
// Admin actions on an existing link
// ---------------------------------------------------------------------------

async function closeLocally(link: PaymentLink, status: "EXPIRED" | "CANCELLED", now = new Date()) {
  await db.paymentLink.updateMany({
    where: { id: link.id, status: PaymentLinkStatus.CREATED },
    data: { status, ...(status === "CANCELLED" ? { cancelledAt: now } : {}) },
  });
  if (link.donationId) {
    await db.donation.updateMany({
      where: { id: link.donationId, status: DonationStatus.CREATED },
      data: { status: DonationStatus.FAILED },
    });
  }
  if (link.membershipOrderId) {
    await db.membershipOrder.updateMany({
      where: { id: link.membershipOrderId, status: MembershipOrderStatus.CREATED },
      data: { status: MembershipOrderStatus.CANCELLED, cancelledAt: now },
    });
  }
  if (link.interestId) {
    // The person was reached, but the money did not come through: back to the queue for a new link.
    await db.paymentInterest.updateMany({
      where: { id: link.interestId, status: PaymentInterestStatus.LINK_SENT },
      data: { status: PaymentInterestStatus.CONTACTED },
    });
  }
}

/** Reads the link from Razorpay and brings the local record up to date. */
export async function syncPaymentLink(
  linkId: string,
  context?: RequestContext | null
): Promise<{ ok: true; link: PaymentLink; changed: boolean } | Failure> {
  const link = await db.paymentLink.findUnique({ where: { id: linkId } });
  if (!link) return { ok: false, status: 404, message: "Link not found." };
  if (!link.razorpayLinkId) return { ok: true, link, changed: false };

  const remote = await fetchRazorpayPaymentLink(link.razorpayLinkId);
  if (remote.status === "paid" && link.status !== PaymentLinkStatus.PAID) {
    const captured = (remote.payments ?? []).find((row) => row.status === "captured") ?? remote.payments?.[0];
    if (!captured) return { ok: false, status: 409, message: "Razorpay says paid but lists no payment yet. Try again shortly." };
    const result = await settleFromPaymentId(link, captured.payment_id, "sync", context);
    if (!result.ok) return { ok: false, status: 409, message: result.message };
    return { ok: true, link: result.link, changed: !result.deduplicated };
  }
  if ((remote.status === "expired" || remote.status === "cancelled") && link.status === PaymentLinkStatus.CREATED) {
    await closeLocally(link, remote.status === "expired" ? "EXPIRED" : "CANCELLED");
    const fresh = (await db.paymentLink.findUnique({ where: { id: link.id } })) ?? link;
    return { ok: true, link: fresh, changed: true };
  }
  return { ok: true, link, changed: false };
}

export async function cancelPaymentLink(
  linkId: string,
  actor: Actor,
  context?: RequestContext | null
): Promise<{ ok: true; link: PaymentLink } | Failure> {
  const link = await db.paymentLink.findUnique({ where: { id: linkId } });
  if (!link) return { ok: false, status: 404, message: "Link not found." };
  if (link.status === PaymentLinkStatus.PAID) return { ok: false, status: 409, message: "This link is already paid." };
  if (link.status !== PaymentLinkStatus.CREATED) return { ok: true, link };

  if (link.razorpayLinkId) {
    try {
      await cancelRazorpayPaymentLink(link.razorpayLinkId);
    } catch (error) {
      // Razorpay refuses to cancel a link that was paid a moment ago: find out before closing it here.
      const synced = await syncPaymentLink(link.id, context);
      if (synced.ok && synced.link.status === PaymentLinkStatus.PAID) {
        return { ok: false, status: 409, message: "This link was just paid, so it was not cancelled." };
      }
      if (!synced.ok || synced.link.status === PaymentLinkStatus.CREATED) {
        const message = error instanceof Error ? error.message : "Razorpay could not cancel the link.";
        return { ok: false, status: 502, message };
      }
    }
  }
  await closeLocally(link, "CANCELLED");
  await recordAudit({
    action: AuditAction.PaymentLinkClosed,
    actorUserId: actor.userId,
    actorClerkId: actor.clerkId,
    actorRole: actor.role,
    targetType: "payment_link",
    targetId: link.id,
    context: context ?? null,
    metadata: { reason: "cancelled", interestId: link.interestId, amountPaise: link.amountPaise },
  });
  const fresh = (await db.paymentLink.findUnique({ where: { id: link.id } })) ?? link;
  return { ok: true, link: fresh };
}

export async function resendPaymentLink(
  linkId: string,
  actor: Actor,
  context?: RequestContext | null
): Promise<{ ok: true; link: PaymentLink; email: EmailResult; sms: boolean } | Failure> {
  const link = await db.paymentLink.findUnique({
    where: { id: linkId },
    include: { interest: true },
  });
  if (!link) return { ok: false, status: 404, message: "Link not found." };
  if (link.status !== PaymentLinkStatus.CREATED || !link.shortUrl) {
    return { ok: false, status: 409, message: "Only an open link can be resent." };
  }
  if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
    return { ok: false, status: 409, message: "This link has expired. Cancel it and send a new one." };
  }

  const what = link.interest ? interestLabel(link.interest) : link.description;
  const email = await emailLink(link, what);
  let sms = false;
  if (link.customerPhone && link.razorpayLinkId) {
    try {
      await notifyRazorpayPaymentLink(link.razorpayLinkId, "sms");
      sms = true;
    } catch {
      sms = false;
    }
  }
  const updated = email.sent
    ? await db.paymentLink.update({ where: { id: link.id }, data: { emailedAt: new Date() } })
    : link;

  await recordAudit({
    action: AuditAction.PaymentLinkResent,
    actorUserId: actor.userId,
    actorClerkId: actor.clerkId,
    actorRole: actor.role,
    targetType: "payment_link",
    targetId: link.id,
    context: context ?? null,
    metadata: { emailed: email.sent, sms },
  });
  return { ok: true, link: updated, email, sms };
}

/** Webhook entry for payment_link.* events and captures that carry our link note. */
export async function handlePaymentLinkEvent(input: {
  eventType: string;
  razorpayLinkId?: string | null;
  referenceId?: string | null;
  payment?: LinkPayment | null;
  context?: RequestContext | null;
}): Promise<"settled" | "duplicate" | "closed" | "ignored"> {
  const link = await findPaymentLink({ razorpayLinkId: input.razorpayLinkId, referenceId: input.referenceId });
  if (!link) return "ignored";

  if (input.eventType === "payment_link.expired" || input.eventType === "payment_link.cancelled") {
    if (link.status !== PaymentLinkStatus.CREATED) return "ignored";
    await closeLocally(link, input.eventType === "payment_link.expired" ? "EXPIRED" : "CANCELLED");
    await recordAudit({
      action: AuditAction.PaymentLinkClosed,
      targetType: "payment_link",
      targetId: link.id,
      context: input.context ?? null,
      metadata: { reason: input.eventType, interestId: link.interestId },
    });
    return "closed";
  }

  const captureEvent =
    input.eventType === "payment_link.paid" ||
    input.eventType === "payment.captured" ||
    input.eventType === "order.paid";
  if (!captureEvent || !input.payment?.id) return "ignored";

  const complete = input.payment.amount > 0 && Boolean(input.payment.currency) && Boolean(input.payment.status);
  const result = complete
    ? await settlePaymentLink(link, input.payment, "webhook", input.context)
    : await settleFromPaymentId(link, input.payment.id, "webhook", input.context);
  if (!result.ok) {
    await db.paymentLink.update({ where: { id: link.id }, data: { lastError: result.message } });
    return "ignored";
  }
  return result.deduplicated ? "duplicate" : "settled";
}
