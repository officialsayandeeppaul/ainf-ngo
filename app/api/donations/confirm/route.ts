import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { confirmGiftPayment } from "@/lib/donations";
import { isDatabaseConfigured, isRazorpayConfigured } from "@/lib/env";
import { verifyCheckoutSignature } from "@/lib/razorpay";
import { checkRateLimit, rateLimitResponse } from "@/lib/ratelimit";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

/** Browser return from Razorpay. The payment is re-read from Razorpay before it is marked paid. */
export async function POST(request: Request) {
  if (!isDatabaseConfigured || !isRazorpayConfigured) {
    return Response.json({ error: "not_configured", message: "Gifts are temporarily unavailable." }, { status: 503 });
  }

  const context = contextFromRequest(request);
  const throttle = await checkRateLimit("donate", `donate-confirm:${context.ip}`);
  if (!throttle.success) return rateLimitResponse(throttle, "donate");

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_input", message: "Missing payment details." }, { status: 400 });
  }

  const signatureOk = verifyCheckoutSignature(
    input.razorpay_order_id,
    input.razorpay_payment_id,
    input.razorpay_signature
  );
  if (!signatureOk) {
    await recordAudit({
      action: AuditAction.RazorpayWebhookRejected,
      success: false,
      context,
      metadata: { reason: "invalid_donation_signature" },
    });
  }

  const result = await confirmGiftPayment({
    razorpayOrderId: input.razorpay_order_id,
    razorpayPaymentId: input.razorpay_payment_id,
    razorpaySignature: input.razorpay_signature,
    signatureOk,
  });
  if (!result.ok) {
    return Response.json({ error: "rejected", message: result.message }, { status: result.status });
  }
  if (!result.deduplicated) {
    await recordAudit({
      action: AuditAction.DonationCaptured,
      context,
      targetType: "donation",
      targetId: input.razorpay_order_id,
      metadata: { source: "checkout", razorpayPaymentId: input.razorpay_payment_id },
    });
  }
  return Response.json({ ok: true, receiptPath: result.receiptPath });
}
