import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyCheckoutSignature, verifySubscriptionSignature, verifyWebhookSignature } from "@/lib/razorpay";

const KEY_SECRET = "test_razorpay_key_secret";
const WEBHOOK_SECRET = "test_razorpay_webhook_secret";

describe("razorpay signatures", () => {
  it("accepts a valid checkout HMAC and rejects a tampered one", () => {
    const orderId = "order_test";
    const paymentId = "pay_test";
    const signature = createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    expect(verifyCheckoutSignature(orderId, paymentId, signature)).toBe(true);
    expect(verifyCheckoutSignature(orderId, paymentId, "0".repeat(64))).toBe(false);
  });

  it("accepts a valid webhook HMAC over the raw body", () => {
    const body = Buffer.from(JSON.stringify({ event: "payment.captured" }));
    const signature = createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
    expect(verifyWebhookSignature(body, signature)).toBe(true);
    expect(verifyWebhookSignature(body, "0".repeat(64))).toBe(false);
    expect(verifyWebhookSignature(body, null)).toBe(false);
  });

  it("accepts a valid subscription checkout HMAC", () => {
    const paymentId = "pay_sub";
    const subscriptionId = "sub_test";
    const signature = createHmac("sha256", KEY_SECRET)
      .update(`${paymentId}|${subscriptionId}`)
      .digest("hex");
    expect(verifySubscriptionSignature(paymentId, subscriptionId, signature)).toBe(true);
    expect(verifySubscriptionSignature(paymentId, subscriptionId, "0".repeat(64))).toBe(false);
  });
});
