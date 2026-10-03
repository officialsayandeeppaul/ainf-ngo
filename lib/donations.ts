import { randomBytes } from "node:crypto";
import { DonationKind, DonationStatus, type Donation, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/env";
import { sendDonationReceiptEmail, sendDonationRefundEmail } from "@/lib/email";
import {
  DEFAULT_GIFT_MAX_PAISE,
  DEFAULT_GIFT_MIN_PAISE,
  DEFAULT_SUGGESTED_PAISE,
  isDonationNote,
  paymentMatchesGift,
  resolvedFloor,
  visibleSuggestions,
  type GiftKind,
} from "@/lib/donation-rules";
import { createRazorpayOrder, getRazorpayPayment, refundRazorpayPayment } from "@/lib/razorpay";

export type GiftTarget = {
  kind: GiftKind;
  id: string;
  slug: string;
  title: string;
  minPaise: number;
};

export type GiftSettingsView = {
  minPaise: number;
  maxPaise: number;
  suggestedPaise: number[];
};

const SETTINGS_ID = "singleton";

export function newReceiptToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function getGiftSettings(): Promise<GiftSettingsView> {
  const row = await db.donationSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (!row) {
    return {
      minPaise: DEFAULT_GIFT_MIN_PAISE,
      maxPaise: DEFAULT_GIFT_MAX_PAISE,
      suggestedPaise: DEFAULT_SUGGESTED_PAISE,
    };
  }
  return {
    minPaise: row.minPaise,
    maxPaise: row.maxPaise,
    suggestedPaise: row.suggestedPaise.length ? row.suggestedPaise : DEFAULT_SUGGESTED_PAISE,
  };
}

export async function listGiftTargets(): Promise<{ settings: GiftSettingsView; targets: GiftTarget[] }> {
  const settings = await getGiftSettings();
  const [missions, projects] = await Promise.all([
    db.donationMission.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
    db.fieldProject.findMany({
      where: { published: true, acceptDonations: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
  ]);

  const targets: GiftTarget[] = [
    {
      kind: "GENERAL",
      id: "general",
      slug: "ainf",
      title: "AINF overall",
      minPaise: resolvedFloor(settings.minPaise, null),
    },
    ...missions.map((row) => ({
      kind: "MISSION" as const,
      id: row.id,
      slug: row.slug,
      title: row.title,
      minPaise: resolvedFloor(settings.minPaise, row.minPaise),
    })),
    ...projects.map((row) => ({
      kind: "PROJECT" as const,
      id: row.id,
      slug: row.slug,
      title: row.title,
      minPaise: resolvedFloor(settings.minPaise, row.donateMinPaise),
    })),
  ];

  return { settings, targets };
}

export function suggestionsFor(settings: GiftSettingsView, floor: number): number[] {
  return visibleSuggestions(settings.suggestedPaise, floor, settings.maxPaise);
}

type Resolved =
  | { ok: true; kind: DonationKind; missionId: string | null; projectId: string | null; title: string; floor: number }
  | { ok: false; message: string };

export async function resolveGiftTarget(input: {
  kind: GiftKind;
  slug?: string | null;
}): Promise<Resolved> {
  const settings = await getGiftSettings();
  if (input.kind === "GENERAL") {
    return {
      ok: true,
      kind: DonationKind.GENERAL,
      missionId: null,
      projectId: null,
      title: "AINF overall",
      floor: resolvedFloor(settings.minPaise, null),
    };
  }

  const slug = (input.slug ?? "").trim().toLowerCase();
  if (!slug) return { ok: false, message: "Choose where this gift goes." };

  if (input.kind === "MISSION") {
    const row = await db.donationMission.findUnique({ where: { slug } });
    if (!row || !row.published) return { ok: false, message: "That mission is not accepting gifts." };
    return {
      ok: true,
      kind: DonationKind.MISSION,
      missionId: row.id,
      projectId: null,
      title: row.title,
      floor: resolvedFloor(settings.minPaise, row.minPaise),
    };
  }

  const row = await db.fieldProject.findUnique({ where: { slug } });
  if (!row || !row.published || !row.acceptDonations) {
    return { ok: false, message: "That project is not accepting gifts." };
  }
  return {
    ok: true,
    kind: DonationKind.PROJECT,
    missionId: null,
    projectId: row.id,
    title: row.title,
    floor: resolvedFloor(settings.minPaise, row.donateMinPaise),
  };
}

export async function createGiftOrder(input: {
  kind: GiftKind;
  slug?: string | null;
  amountPaise: number;
  donorName: string;
  donorEmail: string;
  donorPhone: string;
}): Promise<
  | {
      ok: true;
      donationId: string;
      razorpayOrderId: string;
      amountPaise: number;
      currency: "INR";
      description: string;
    }
  | { ok: false; status: number; message: string }
> {
  const settings = await getGiftSettings();
  const target = await resolveGiftTarget({ kind: input.kind, slug: input.slug });
  if (!target.ok) return { ok: false, status: 400, message: target.message };
  if (target.floor > settings.maxPaise) {
    return { ok: false, status: 409, message: "Gifts are paused until the minimum is below the maximum." };
  }
  if (!Number.isInteger(input.amountPaise) || input.amountPaise < target.floor) {
    return { ok: false, status: 400, message: "That amount is below the minimum for this gift." };
  }
  if (input.amountPaise > settings.maxPaise) {
    return { ok: false, status: 400, message: "That amount is above the maximum for a gift." };
  }

  const donation = await db.donation.create({
    data: {
      kind: target.kind,
      missionId: target.missionId,
      projectId: target.projectId,
      targetTitle: target.title,
      amountPaise: input.amountPaise,
      donorName: input.donorName,
      donorEmail: input.donorEmail,
      donorPhone: input.donorPhone,
      receiptToken: newReceiptToken(),
      status: DonationStatus.CREATED,
    },
  });

  try {
    const order = await createRazorpayOrder({
      amountPaise: donation.amountPaise,
      receipt: `gift_${donation.id}`.slice(0, 40),
      notes: {
        purpose: "donation",
        donationId: donation.id,
        targetKind: target.kind,
        targetTitle: target.title.slice(0, 80),
      },
    });
    await db.donation.update({
      where: { id: donation.id },
      data: { razorpayOrderId: order.id },
    });
    return {
      ok: true,
      donationId: donation.id,
      razorpayOrderId: order.id,
      amountPaise: donation.amountPaise,
      currency: "INR",
      description: `Gift to ${target.title}`,
    };
  } catch (error) {
    await db.donation.update({
      where: { id: donation.id },
      data: { status: DonationStatus.FAILED },
    });
    const message = error instanceof Error ? error.message : "Razorpay could not start this gift.";
    return { ok: false, status: 502, message };
  }
}

async function emailReceiptOnce(row: Donation): Promise<void> {
  const claim = await db.donation.updateMany({
    where: { id: row.id, status: DonationStatus.PAID, receiptEmailedAt: null },
    data: { receiptEmailedAt: new Date() },
  });
  if (claim.count !== 1) return;
  const result = await sendDonationReceiptEmail({
    to: row.donorEmail,
    name: row.donorName,
    amountPaise: row.amountPaise,
    targetTitle: row.targetTitle,
    receiptUrl: absoluteUrl(`/donate/receipt/${row.receiptToken}`),
  });
  if (!result.sent) {
    await db.donation.update({ where: { id: row.id }, data: { receiptEmailedAt: null } });
  }
}

export async function markGiftPaidFromPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amountPaise: number;
  currency: string | null | undefined;
  status: string | null | undefined;
  captured?: boolean;
}): Promise<
  | { ok: true; receiptPath: string; deduplicated: boolean }
  | { ok: false; status: number; message: string }
> {
  const row = await db.donation.findUnique({ where: { razorpayOrderId: input.razorpayOrderId } });
  if (!row) return { ok: false, status: 404, message: "Gift not found." };

  if (row.status === DonationStatus.REFUNDED) {
    return { ok: false, status: 409, message: "This gift was returned." };
  }
  if (row.status === DonationStatus.PAID) {
    await emailReceiptOnce(row);
    return { ok: true, receiptPath: `/donate/receipt/${row.receiptToken}`, deduplicated: true };
  }

  const check = paymentMatchesGift({
    storedPaise: row.amountPaise,
    paidPaise: input.amountPaise,
    currency: input.currency,
    status: input.status,
    captured: input.captured,
  });
  if (!check.ok) {
    return {
      ok: false,
      status: 409,
      message:
        check.reason === "amount"
          ? "The paid amount does not match this gift."
          : "This payment is not a captured gift.",
    };
  }

  let updatedCount = 0;
  try {
    const updated = await db.donation.updateMany({
      where: {
        id: row.id,
        status: { in: [DonationStatus.CREATED, DonationStatus.FAILED] },
      },
      data: {
        status: DonationStatus.PAID,
        razorpayPaymentId: input.razorpayPaymentId,
        paidAt: new Date(),
      },
    });
    updatedCount = updated.count;
  } catch {
    updatedCount = 0;
  }
  if (updatedCount !== 1) {
    const again = await db.donation.findUnique({ where: { id: row.id } });
    if (again?.status === DonationStatus.PAID) {
      return { ok: true, receiptPath: `/donate/receipt/${again.receiptToken}`, deduplicated: true };
    }
    return { ok: false, status: 409, message: "This gift could not be marked paid." };
  }

  const paid = await db.donation.findUnique({ where: { id: row.id } });
  if (!paid) return { ok: false, status: 500, message: "Gift record missing after payment." };
  await emailReceiptOnce(paid);
  return { ok: true, receiptPath: `/donate/receipt/${paid.receiptToken}`, deduplicated: false };
}

export async function confirmGiftPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  signatureOk: boolean;
}): Promise<
  | { ok: true; receiptPath: string; deduplicated: boolean }
  | { ok: false; status: number; message: string }
> {
  if (!input.signatureOk) {
    return { ok: false, status: 401, message: "Payment signature did not match." };
  }
  const payment = await getRazorpayPayment(input.razorpayPaymentId);
  if (payment.order_id && payment.order_id !== input.razorpayOrderId) {
    return { ok: false, status: 409, message: "This payment is for a different order." };
  }
  const marked = await markGiftPaidFromPayment({
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: payment.id,
    amountPaise: payment.amount,
    currency: payment.currency,
    status: payment.status,
    captured: payment.captured,
  });
  if (!marked.ok) return marked;
  return marked;
}

export async function markGiftFailed(razorpayOrderId: string | null): Promise<boolean> {
  if (!razorpayOrderId) return false;
  const result = await db.donation.updateMany({
    where: { razorpayOrderId, status: DonationStatus.CREATED },
    data: { status: DonationStatus.FAILED },
  });
  return result.count > 0;
}

async function emailRefundOnce(row: Donation): Promise<void> {
  const claim = await db.donation.updateMany({
    where: { id: row.id, status: DonationStatus.REFUNDED, refundEmailedAt: null },
    data: { refundEmailedAt: new Date() },
  });
  if (claim.count !== 1) return;
  const result = await sendDonationRefundEmail({
    to: row.donorEmail,
    name: row.donorName,
    amountPaise: row.amountPaise,
    targetTitle: row.targetTitle,
  });
  if (!result.sent) {
    await db.donation.update({ where: { id: row.id }, data: { refundEmailedAt: null } });
  }
}

export async function markGiftRefunded(input: {
  razorpayPaymentId?: string | null;
  razorpayRefundId?: string | null;
  donationId?: string | null;
}): Promise<Donation | null> {
  const where: Prisma.DonationWhereInput = input.donationId
    ? { id: input.donationId }
    : input.razorpayPaymentId
      ? { razorpayPaymentId: input.razorpayPaymentId }
      : { id: "__none__" };
  const row = await db.donation.findFirst({ where });
  if (!row) return null;
  if (row.status === DonationStatus.REFUNDED) return row;
  if (row.status !== DonationStatus.PAID) return null;
  const updated = await db.donation.update({
    where: { id: row.id },
    data: {
      status: DonationStatus.REFUNDED,
      razorpayRefundId: input.razorpayRefundId ?? row.razorpayRefundId,
      refundedAt: new Date(),
    },
  });
  await emailRefundOnce(updated);
  return updated;
}

export async function refundGift(donationId: string): Promise<
  | { ok: true; donation: Donation }
  | { ok: false; status: number; message: string }
> {
  const row = await db.donation.findUnique({ where: { id: donationId } });
  if (!row) return { ok: false, status: 404, message: "Gift not found." };
  if (row.status === DonationStatus.REFUNDED) {
    return { ok: false, status: 409, message: "This gift is already returned." };
  }
  if (row.status !== DonationStatus.PAID || !row.razorpayPaymentId) {
    return { ok: false, status: 409, message: "Only a paid gift can be returned." };
  }
  let refundId: string;
  try {
    const refund = await refundRazorpayPayment(row.razorpayPaymentId, row.amountPaise);
    refundId = refund.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Razorpay could not return this gift.";
    return { ok: false, status: 502, message };
  }
  const updated = await markGiftRefunded({
    donationId: row.id,
    razorpayPaymentId: row.razorpayPaymentId,
    razorpayRefundId: refundId,
  });
  if (!updated) return { ok: false, status: 409, message: "This gift could not be marked returned." };
  return { ok: true, donation: updated };
}

export async function donationOwnsPayment(input: {
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  notes: unknown;
}): Promise<boolean> {
  if (isDonationNote(input.notes)) return true;
  if (input.razorpayOrderId) {
    const row = await db.donation.findUnique({
      where: { razorpayOrderId: input.razorpayOrderId },
      select: { id: true },
    });
    if (row) return true;
  }
  if (input.razorpayPaymentId) {
    const row = await db.donation.findFirst({
      where: { razorpayPaymentId: input.razorpayPaymentId },
      select: { id: true },
    });
    if (row) return true;
  }
  return false;
}
