import { describe, expect, it } from "vitest";
import { DonationStatus } from "@prisma/client";
import {
  MAX_RECOVERABLE_RECEIPTS,
  RECEIPT_LOOKUP_NEUTRAL_MESSAGE,
  selectRecoverableReceipts,
} from "@/lib/receipt-lookup";

function row(status: DonationStatus, receiptToken = "tok_" + Math.random().toString(36).slice(2)) {
  return {
    receiptToken,
    targetTitle: "AINF overall",
    amountPaise: 50000,
    donorName: "Ada Lovelace",
    donorEmail: "ada@example.com",
    status,
  };
}

describe("selectRecoverableReceipts", () => {
  it("keeps only gifts whose receipt page actually resolves (PAID or REFUNDED)", () => {
    const rows = [
      row(DonationStatus.PAID),
      row(DonationStatus.REFUNDED),
      row(DonationStatus.CREATED),
      row(DonationStatus.FAILED),
    ];
    const out = selectRecoverableReceipts(rows);
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.status)).toEqual([DonationStatus.PAID, DonationStatus.REFUNDED]);
  });

  it("drops rows with an empty receipt token", () => {
    const out = selectRecoverableReceipts([row(DonationStatus.PAID, "")]);
    expect(out).toHaveLength(0);
  });

  it("caps how many receipts one lookup resends", () => {
    const rows = Array.from({ length: MAX_RECOVERABLE_RECEIPTS + 7 }, () => row(DonationStatus.PAID));
    expect(selectRecoverableReceipts(rows)).toHaveLength(MAX_RECOVERABLE_RECEIPTS);
  });

  it("carries through the fields the receipt email needs", () => {
    const [out] = selectRecoverableReceipts([row(DonationStatus.PAID, "tok_abc")]);
    expect(out).toMatchObject({
      receiptToken: "tok_abc",
      targetTitle: "AINF overall",
      amountPaise: 50000,
      donorName: "Ada Lovelace",
      donorEmail: "ada@example.com",
    });
  });

  it("keeps a single, non-revealing lookup message", () => {
    expect(RECEIPT_LOOKUP_NEUTRAL_MESSAGE).toMatch(/if that email/i);
    expect(RECEIPT_LOOKUP_NEUTRAL_MESSAGE).not.toMatch(/\d/);
  });
});
