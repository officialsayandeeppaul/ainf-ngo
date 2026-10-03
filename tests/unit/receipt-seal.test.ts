import { describe, expect, it } from "vitest";
import {
  formatSeal,
  giftSealPayload,
  openReceiptSeal,
  sealMatchesGift,
  sealReceipt,
  type GiftSealSource,
} from "@/lib/receipt-seal";

const secret = "test-receipt-secret";

function row(overrides: Partial<GiftSealSource> = {}): GiftSealSource {
  return {
    id: "gift_1",
    amountPaise: 10000,
    donorName: "Sayandeep",
    donorEmail: "sayandeep775@gmail.com",
    donorPhone: "7679329685",
    targetTitle: "AINF overall",
    status: "PAID",
    razorpayPaymentId: "pay_Tix7nB3GTDmjvS",
    razorpayRefundId: null,
    at: new Date("2026-10-02T07:11:00.000Z"),
    ...overrides,
  };
}

describe("receipt seal", () => {
  it("opens only with the same secret and matches the gift", () => {
    const source = row();
    const payload = giftSealPayload(source);
    expect(payload).not.toBeNull();
    const seal = sealReceipt(payload!, secret);
    const opened = openReceiptSeal(seal, secret);
    expect(opened).toEqual(payload);
    expect(sealMatchesGift(opened!, source)).toBe(true);
    expect(openReceiptSeal(seal, "other-secret")).toBeNull();
    expect(openReceiptSeal(formatSeal(seal), secret)).toEqual(payload);
  });

  it("rejects a changed seal", () => {
    const payload = giftSealPayload(row())!;
    const seal = sealReceipt(payload, secret);
    const flipped = seal.slice(0, -1) + (seal.endsWith("a") ? "b" : "a");
    expect(openReceiptSeal(flipped, secret)).toBeNull();
  });

  it("does not seal a gift that has no payment id", () => {
    expect(giftSealPayload(row({ razorpayPaymentId: null }))).toBeNull();
  });

  it("groups the printed seal", () => {
    expect(formatSeal("abcdefghij")).toBe("abcd efgh ij");
  });
});
