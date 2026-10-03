import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { isRazorpayConfigured } from "@/lib/env";
import { markOrderPaid } from "@/lib/membership-pay";
import { verifyCheckoutSignature, verifySubscriptionSignature } from "@/lib/razorpay";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
    razorpay_order_id: z.string().min(1).optional(),
    razorpay_subscription_id: z.string().min(1).optional(),
  })
  .refine((value) => value.razorpay_order_id || value.razorpay_subscription_id, {
    message: "Missing Razorpay order or subscription.",
  });

export async function POST(request: Request) {
  const guard = await guardApi({ limiter: "checkout" });
  if (!guard.ok) return guard.response;

  if (!isRazorpayConfigured) {
    return Response.json(
      { error: "not_configured", message: "Razorpay keys are not set." },
      { status: 503 }
    );
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_input", message: "Missing payment details." }, { status: 400 });
  }

  const owned = await db.membershipOrder.findFirst({
    where: {
      userId: guard.ctx.user.id,
      OR: [
        input.razorpay_order_id ? { razorpayOrderId: input.razorpay_order_id } : undefined,
        input.razorpay_subscription_id
          ? { razorpaySubscriptionId: input.razorpay_subscription_id }
          : undefined,
      ].filter(Boolean) as Array<{ razorpayOrderId: string } | { razorpaySubscriptionId: string }>,
    },
  });
  if (!owned) {
    return Response.json({ error: "not_found", message: "Order not found." }, { status: 404 });
  }

  const signed = input.razorpay_subscription_id
    ? verifySubscriptionSignature(
        input.razorpay_payment_id,
        input.razorpay_subscription_id,
        input.razorpay_signature
      )
    : verifyCheckoutSignature(
        input.razorpay_order_id ?? "",
        input.razorpay_payment_id,
        input.razorpay_signature
      );

  if (!signed) {
    await recordAudit({
      action: AuditAction.RazorpayWebhookRejected,
      actorUserId: guard.ctx.user.id,
      actorClerkId: guard.ctx.clerkId,
      actorRole: guard.ctx.role,
      success: false,
      context: contextFromRequest(request),
      metadata: { reason: "invalid_checkout_signature" },
    });
    return Response.json({ error: "invalid_signature", message: "Payment signature did not match." }, { status: 401 });
  }

  const result = await markOrderPaid({
    razorpayOrderId: input.razorpay_order_id,
    razorpaySubscriptionId: input.razorpay_subscription_id,
    razorpayPaymentId: input.razorpay_payment_id,
    razorpaySignature: input.razorpay_signature,
  });
  if (!result.ok) {
    return Response.json({ error: "not_found", message: "Order not found." }, { status: 404 });
  }

  if (!result.deduplicated) {
    await recordAudit({
      action: AuditAction.MembershipPaymentCaptured,
      actorUserId: guard.ctx.user.id,
      actorClerkId: guard.ctx.clerkId,
      actorRole: guard.ctx.role,
      targetType: "membership_order",
      targetId: owned.id,
      context: contextFromRequest(request),
      metadata: { source: "checkout", razorpayPaymentId: input.razorpay_payment_id },
    });
  }

  return Response.json({ ok: true });
}
