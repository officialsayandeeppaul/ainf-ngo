import { describe, expect, it } from "vitest";
import { DonationStatus } from "@prisma/client";
import {
  normalizeDonorEmail,
  summarizeDonations,
  toDonationView,
  type DonationView,
} from "@/lib/user-donations";

function gift(partial: Partial<DonationView> & { amountPaise: number; status: DonationStatus; at: Date }): DonationView {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    targetTitle: partial.targetTitle ?? "AINF overall",
    amountPaise: partial.amountPaise,
    status: partial.status,
    receiptToken: partial.receiptToken ?? "tok_" + Math.random().toString(36).slice(2),
    at: partial.at,
    refundedAt: partial.refundedAt ?? null,
    paymentId: partial.paymentId ?? null,
  };
}

describe("normalizeDonorEmail", () => {
  it("lowercases and trims so it matches how orders store the email", () => {
    expect(normalizeDonorEmail("  Ada@Example.COM ")).toBe("ada@example.com");
    expect(normalizeDonorEmail("")).toBe("");
    expect(normalizeDonorEmail(null)).toBe("");
    expect(normalizeDonorEmail(undefined)).toBe("");
  });
});

describe("toDonationView", () => {
  const base = {
    id: "d1",
    targetTitle: "Clean water",
    amountPaise: 50000,
    status: DonationStatus.PAID,
    receiptToken: "tok_1",
    razorpayPaymentId: "pay_1",
  };

  it("uses paidAt as the timeline date when present", () => {
    const paidAt = new Date("2026-05-01T10:00:00Z");
    const view = toDonationView({ ...base, paidAt, refundedAt: null, createdAt: new Date("2026-04-30T00:00:00Z") });
    expect(view.at).toBe(paidAt);
    expect(view.paymentId).toBe("pay_1");
  });

  it("falls back to refundedAt, then createdAt", () => {
    const refundedAt = new Date("2026-06-01T10:00:00Z");
    const createdAt = new Date("2026-04-30T00:00:00Z");
    expect(toDonationView({ ...base, paidAt: null, refundedAt, createdAt }).at).toBe(refundedAt);
    expect(toDonationView({ ...base, paidAt: null, refundedAt: null, createdAt }).at).toBe(createdAt);
  });
});

describe("summarizeDonations", () => {
  const now = new Date("2026-10-03T12:00:00Z");

  it("returns zeroes for no gifts", () => {
    expect(summarizeDonations([], now)).toEqual({
      totalPaise: 0,
      giftCount: 0,
      refundedPaise: 0,
      refundedCount: 0,
      thisYearPaise: 0,
      lastGiftAt: null,
    });
  });

  it("sums only paid gifts into the total and count", () => {
    const rows = [
      gift({ amountPaise: 50000, status: DonationStatus.PAID, at: new Date("2026-01-10T00:00:00Z") }),
      gift({ amountPaise: 20000, status: DonationStatus.PAID, at: new Date("2026-09-20T00:00:00Z") }),
      gift({ amountPaise: 99999, status: DonationStatus.REFUNDED, at: new Date("2026-03-01T00:00:00Z") }),
    ];
    const summary = summarizeDonations(rows, now);
    expect(summary.totalPaise).toBe(70000);
    expect(summary.giftCount).toBe(2);
    expect(summary.refundedPaise).toBe(99999);
    expect(summary.refundedCount).toBe(1);
  });

  it("counts this-year gifts by calendar year of the settlement date", () => {
    // Mid-year, mid-day dates so the local-year rollup is unambiguous in any zone.
    const rows = [
      gift({ amountPaise: 10000, status: DonationStatus.PAID, at: new Date("2025-06-15T12:00:00Z") }),
      gift({ amountPaise: 30000, status: DonationStatus.PAID, at: new Date("2026-02-15T12:00:00Z") }),
      gift({ amountPaise: 40000, status: DonationStatus.PAID, at: new Date("2026-09-09T12:00:00Z") }),
    ];
    const summary = summarizeDonations(rows, now);
    expect(summary.totalPaise).toBe(80000);
    expect(summary.thisYearPaise).toBe(70000);
  });

  it("reports the most recent paid gift as lastGiftAt and ignores refunds for it", () => {
    const early = new Date("2026-02-01T00:00:00Z");
    const late = new Date("2026-08-01T00:00:00Z");
    const afterButRefunded = new Date("2026-09-01T00:00:00Z");
    const rows = [
      gift({ amountPaise: 10000, status: DonationStatus.PAID, at: early }),
      gift({ amountPaise: 20000, status: DonationStatus.PAID, at: late }),
      gift({ amountPaise: 50000, status: DonationStatus.REFUNDED, at: afterButRefunded }),
    ];
    const summary = summarizeDonations(rows, now);
    expect(summary.lastGiftAt).toEqual(late);
  });
});
