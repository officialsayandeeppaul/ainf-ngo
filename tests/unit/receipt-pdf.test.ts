import { describe, expect, it } from "vitest";
import { receiptPageHtml } from "@/lib/donate-document";
import { NON_REFUNDABLE_RECEIPT } from "@/lib/payment-policy";
import { buildReceiptPdf, receiptPdfFilename } from "@/lib/receipt-pdf";
import type { ReceiptView } from "@/lib/receipt-view";

const view: ReceiptView = {
  token: "tok_abcdefghijklmnopqrstuvwx",
  name: "Mina Das",
  email: "mina@example.com",
  phone: "9876543210",
  amountPaise: 250000,
  amount: "₹2,500",
  target: "Education — Shiksha",
  when: "31 Oct 2026, 12:08",
  status: "Received",
  paymentId: "pay_RX12ab34CD56ef",
  refundId: "",
  returned: false,
  emailed: true,
  verified: true,
  seal: "AB12 CD34",
  verifyUrl: "https://beta.theainf.in/donate/verify?seal=ABCDEF0123456789",
};

describe("receipt PDF", () => {
  it("is a one-page PDF, encrypted so it cannot be edited, with link annotations", async () => {
    const pdf = await buildReceiptPdf(view, new Date("2026-10-31T06:38:00.000Z"));
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-")).toBe(true);
    expect(text).toContain("/Encrypt");
    // Owner password only: anyone can open it, nobody can change the permissions.
    expect(text).toMatch(/\/P -\d+/);
    expect(text).toContain("/Subtype /Link");
    expect((text.match(/\/Type \/Page\b/g) || []).length).toBe(1);
  });

  it("names the download after the payment", () => {
    expect(receiptPdfFilename(view)).toBe("AINF-donation-receipt-pay_RX12ab34CD56ef.pdf");
    expect(receiptPdfFilename({ paymentId: "../../etc" })).toBe("AINF-donation-receipt-etc.pdf");
  });
});

describe("receipt page", () => {
  it("offers the locked PDF and says donations are non-refundable", () => {
    const html = receiptPageHtml(view);
    expect(html).toContain(`href="/donate/receipt/${view.token}/pdf"`);
    expect(html).toContain("Download PDF");
    expect(html).toContain(NON_REFUNDABLE_RECEIPT);
    expect(html).toContain("Your donation of");
    expect(html).not.toMatch(/\bgift\b/i);
  });

  it("drops the policy line once a donation was returned", () => {
    const html = receiptPageHtml({ ...view, returned: true, status: "Returned", refundId: "rfnd_1" });
    expect(html).toContain("Donation returned");
    expect(html).not.toContain(NON_REFUNDABLE_RECEIPT);
  });
});
