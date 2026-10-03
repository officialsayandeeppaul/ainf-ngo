import { DonationStatus } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * A member's giving history.
 *
 * Gifts are deliberately not tied to a user account at the row level (see the
 * Donation model), so a member's history is matched by the email the gift was
 * made under. Order routes store that email lowercased, so we match the same
 * way and never show one person another person's gifts.
 */

export type DonationView = {
  id: string;
  targetTitle: string;
  amountPaise: number;
  status: DonationStatus;
  receiptToken: string;
  /** When the gift settled (paid), was returned, or — as a floor — was created. */
  at: Date;
  refundedAt: Date | null;
  paymentId: string | null;
};

export type DonationSummary = {
  /** Sum of gifts still standing (PAID, not returned). */
  totalPaise: number;
  /** Count of gifts still standing. */
  giftCount: number;
  /** Sum of gifts that were later returned. */
  refundedPaise: number;
  refundedCount: number;
  /** Standing gifts made in the same calendar year as `now`. */
  thisYearPaise: number;
  /** Most recent standing gift, or null when there are none. */
  lastGiftAt: Date | null;
};

/** Lowercase + trim, matching how donation order routes store the donor email. */
export function normalizeDonorEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

type DonationRow = {
  id: string;
  targetTitle: string;
  amountPaise: number;
  status: DonationStatus;
  receiptToken: string;
  paidAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  razorpayPaymentId: string | null;
};

/** Map a database row onto the view shape the UI renders. Pure. */
export function toDonationView(row: DonationRow): DonationView {
  return {
    id: row.id,
    targetTitle: row.targetTitle,
    amountPaise: row.amountPaise,
    status: row.status,
    receiptToken: row.receiptToken,
    at: row.paidAt ?? row.refundedAt ?? row.createdAt,
    refundedAt: row.refundedAt,
    paymentId: row.razorpayPaymentId,
  };
}

/** Roll a list of gifts into the headline numbers. Pure, so it is unit-tested. */
export function summarizeDonations(rows: DonationView[], now: Date): DonationSummary {
  const year = now.getFullYear();
  let totalPaise = 0;
  let giftCount = 0;
  let refundedPaise = 0;
  let refundedCount = 0;
  let thisYearPaise = 0;
  let lastGiftAt: Date | null = null;

  for (const row of rows) {
    if (row.status === DonationStatus.PAID) {
      totalPaise += row.amountPaise;
      giftCount += 1;
      if (row.at.getFullYear() === year) thisYearPaise += row.amountPaise;
      if (!lastGiftAt || row.at.getTime() > lastGiftAt.getTime()) lastGiftAt = row.at;
    } else if (row.status === DonationStatus.REFUNDED) {
      refundedPaise += row.amountPaise;
      refundedCount += 1;
    }
  }

  return { totalPaise, giftCount, refundedPaise, refundedCount, thisYearPaise, lastGiftAt };
}

/** Settled gifts (received or returned) made under this email, newest first. */
export async function listUserDonations(email: string): Promise<DonationView[]> {
  const donorEmail = normalizeDonorEmail(email);
  if (!donorEmail) return [];
  const rows = await db.donation.findMany({
    where: {
      donorEmail,
      status: { in: [DonationStatus.PAID, DonationStatus.REFUNDED] },
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  return rows.map(toDonationView);
}

/** Convenience: the history and its rolled-up summary in one call. */
export async function getUserGiving(
  email: string,
  now: Date = new Date()
): Promise<{ donations: DonationView[]; summary: DonationSummary }> {
  const donations = await listUserDonations(email);
  return { donations, summary: summarizeDonations(donations, now) };
}
