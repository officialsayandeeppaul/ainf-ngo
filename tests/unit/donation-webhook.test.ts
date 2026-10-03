import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  owns: vi.fn(),
  markPaid: vi.fn(),
  markFailed: vi.fn(),
  markRefunded: vi.fn(),
  markOrderPaid: vi.fn(),
  cancelMembership: vi.fn(),
  verify: vi.fn(),
  getPayment: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  limit: vi.fn(async () => ({ success: true, limit: 100, remaining: 99, reset: Date.now() + 1000, degraded: false })),
  audit: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  isDatabaseConfigured: true,
  isRazorpayWebhookConfigured: true,
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: h.limit,
}));

vi.mock("@/lib/request-context", () => ({
  contextFromRequest: () => ({ ip: "127.0.0.1", userAgent: "test" }),
}));

vi.mock("@/lib/audit", () => ({
  AuditAction: { RazorpayWebhookRejected: "rejected", DonationCaptured: "donation", MembershipPaymentCaptured: "member" },
  recordAudit: h.audit,
}));

vi.mock("@/lib/razorpay", () => ({
  verifyWebhookSignature: h.verify,
  getRazorpayPayment: h.getPayment,
}));

vi.mock("@/lib/donations", () => ({
  donationOwnsPayment: h.owns,
  markGiftPaidFromPayment: h.markPaid,
  markGiftFailed: h.markFailed,
  markGiftRefunded: h.markRefunded,
}));

vi.mock("@/lib/membership-pay", () => ({
  markOrderPaid: h.markOrderPaid,
  cancelMembership: h.cancelMembership,
}));

vi.mock("@/lib/db", () => ({
  db: {
    webhookEvent: {
      create: h.createEvent,
      updateMany: h.updateEvent,
    },
    membershipOrder: {
      findFirst: vi.fn(async () => null),
    },
  },
}));

import { POST } from "@/app/api/webhooks/razorpay/route";

function post(body: unknown, signature = "sig") {
  return POST(
    new Request("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      headers: { "x-razorpay-signature": signature, "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  h.owns.mockReset();
  h.markPaid.mockReset();
  h.markFailed.mockReset();
  h.markRefunded.mockReset();
  h.markOrderPaid.mockReset();
  h.cancelMembership.mockReset();
  h.verify.mockReset();
  h.getPayment.mockReset();
  h.createEvent.mockReset();
  h.updateEvent.mockReset();
  h.audit.mockReset();
  h.verify.mockReturnValue(true);
  h.createEvent.mockResolvedValue({ id: "evt" });
  h.updateEvent.mockResolvedValue({ count: 1 });
  h.markPaid.mockResolvedValue({ ok: true, deduplicated: false, receiptPath: "/donate/receipt/tok" });
  h.markOrderPaid.mockResolvedValue({ ok: true, deduplicated: false });
});

describe("razorpay webhook routing", () => {
  it("rejects a bad signature before any payment is recorded", async () => {
    h.verify.mockReturnValue(false);
    const response = await post({ event: "payment.captured" });
    expect(response.status).toBe(401);
    expect(h.markPaid).not.toHaveBeenCalled();
    expect(h.markOrderPaid).not.toHaveBeenCalled();
  });

  it("treats a repeated event as already handled", async () => {
    h.createEvent.mockRejectedValueOnce(new Error("unique"));
    const response = await post({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1" } } } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.deduplicated).toBe(true);
    expect(h.markPaid).not.toHaveBeenCalled();
    expect(h.markOrderPaid).not.toHaveBeenCalled();
  });

  it("marks a donation paid and does not start a membership", async () => {
    h.owns.mockResolvedValue(true);
    const response = await post({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_1",
            order_id: "order_1",
            amount: 50000,
            currency: "INR",
            status: "captured",
            notes: { purpose: "donation" },
          },
        },
      },
    });
    expect(response.status).toBe(200);
    expect(h.markPaid).toHaveBeenCalledWith(
      expect.objectContaining({ razorpayOrderId: "order_1", razorpayPaymentId: "pay_1", amountPaise: 50000 })
    );
    expect(h.markOrderPaid).not.toHaveBeenCalled();
  });

  it("marks a membership payment paid and does not touch a gift", async () => {
    h.owns.mockResolvedValue(false);
    const response = await post({
      event: "payment.captured",
      payload: {
        payment: {
          entity: { id: "pay_m", order_id: "order_m", amount: 10000, currency: "INR", status: "captured" },
        },
      },
    });
    expect(response.status).toBe(200);
    expect(h.markOrderPaid).toHaveBeenCalled();
    expect(h.markPaid).not.toHaveBeenCalled();
  });

  it("records a failed gift and a processed refund on the gift path only", async () => {
    h.owns.mockResolvedValue(true);
    await post({
      event: "payment.failed",
      payload: { payment: { entity: { id: "pay_1", order_id: "order_1", notes: { purpose: "donation" } } } },
    });
    await post({
      event: "refund.processed",
      payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_1" } } },
    });
    expect(h.markFailed).toHaveBeenCalledWith("order_1");
    expect(h.markRefunded).toHaveBeenCalledWith(expect.objectContaining({ razorpayRefundId: "rfnd_1" }));
    expect(h.markOrderPaid).not.toHaveBeenCalled();
  });
});
