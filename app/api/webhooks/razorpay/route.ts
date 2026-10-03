import { AuditAction, recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  donationOwnsPayment,
  markGiftFailed,
  markGiftPaidFromPayment,
  markGiftRefunded,
} from "@/lib/donations";
import { isDatabaseConfigured, isRazorpayWebhookConfigured } from "@/lib/env";
import { cancelMembership, markOrderPaid } from "@/lib/membership-pay";
import { getRazorpayPayment, verifyWebhookSignature } from "@/lib/razorpay";
import { notesRecord } from "@/lib/donation-rules";
import { checkRateLimit } from "@/lib/ratelimit";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Entity = {
  id?: string;
  order_id?: string;
  subscription_id?: string;
  status?: string;
  customer_id?: string;
  amount?: number;
  currency?: string;
  captured?: boolean;
  notes?: unknown;
  payment_id?: string;
};
type RazorpayEnvelope = {
  event?: string;
  payload?: {
    payment?: { entity?: Entity };
    order?: { entity?: Entity };
    subscription?: { entity?: Entity };
    refund?: { entity?: Entity };
  };
};

export async function POST(request: Request) {
  const context = contextFromRequest(request);

  if (!isRazorpayWebhookConfigured || !isDatabaseConfigured) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const throttle = await checkRateLimit("webhook", `razorpay:${context.ip}`);
  if (!throttle.success) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const rawBody = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(rawBody, signature)) {
    await recordAudit({
      action: AuditAction.RazorpayWebhookRejected,
      success: false,
      context,
      metadata: { reason: "invalid_signature" },
    });
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: RazorpayEnvelope;
  try {
    payload = JSON.parse(rawBody.toString("utf8")) as RazorpayEnvelope;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const eventType = payload.event ?? "unknown";
  const payment = payload.payload?.payment?.entity;
  const order = payload.payload?.order?.entity;
  const subscription = payload.payload?.subscription?.entity;
  const refund = payload.payload?.refund?.entity;
  const razorpayOrderId = payment?.order_id ?? order?.id ?? null;
  const razorpaySubscriptionId = subscription?.id ?? payment?.subscription_id ?? null;
  const razorpayPaymentId = payment?.id ?? refund?.payment_id ?? null;
  const notes = notesRecord(payment?.notes);
  const externalId = payment?.id ?? refund?.id ?? subscription?.id ?? order?.id ?? eventType;

  try {
    await db.webhookEvent.create({
      data: {
        provider: "razorpay",
        externalId,
        eventType,
        payload: payload as object,
      },
    });
  } catch {
    return Response.json({ ok: true, deduplicated: true });
  }

  const shouldCapture =
    eventType === "payment.captured" ||
    eventType === "order.paid" ||
    eventType === "subscription.charged" ||
    payment?.status === "captured" ||
    order?.status === "paid";

  try {
    const ownsDonation = await donationOwnsPayment({
      razorpayOrderId,
      razorpayPaymentId,
      notes,
    });

    if (ownsDonation && eventType === "payment.failed") {
      await markGiftFailed(razorpayOrderId);
    }

    if (ownsDonation && eventType === "refund.processed") {
      await markGiftRefunded({
        razorpayPaymentId,
        razorpayRefundId: refund?.id ?? null,
      });
    }

    if (ownsDonation && shouldCapture && razorpayOrderId && razorpayPaymentId) {
      let amountPaise = payment?.amount;
      let currency = payment?.currency;
      let status = payment?.status;
      let captured = payment?.captured;
      if (amountPaise == null || !currency) {
        const live = await getRazorpayPayment(razorpayPaymentId);
        amountPaise = live.amount;
        currency = live.currency;
        status = live.status;
        captured = live.captured;
      }
      const marked = await markGiftPaidFromPayment({
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: amountPaise ?? 0,
        currency,
        status,
        captured,
      });
      if (marked.ok && !marked.deduplicated) {
        await recordAudit({
          action: AuditAction.DonationCaptured,
          context,
          targetType: "donation",
          targetId: razorpayOrderId,
          metadata: { source: "razorpay_webhook", eventType, razorpayPaymentId },
        });
      }
    }

    if (!ownsDonation && shouldCapture && (razorpayOrderId || razorpaySubscriptionId)) {
      const result = await markOrderPaid({
        razorpayOrderId,
        razorpaySubscriptionId,
        razorpayPaymentId,
      });
      if (result.ok && !result.deduplicated) {
        await recordAudit({
          action: AuditAction.MembershipPaymentCaptured,
          context,
          targetType: "membership_order",
          targetId: razorpayOrderId ?? razorpaySubscriptionId,
          metadata: { source: "razorpay_webhook", eventType, razorpayPaymentId },
        });
      }
    }

    if (
      eventType === "subscription.cancelled" ||
      eventType === "subscription.completed" ||
      eventType === "subscription.halted"
    ) {
      const local = razorpaySubscriptionId
        ? await db.membershipOrder.findFirst({
            where: { razorpaySubscriptionId },
            select: { userId: true },
            orderBy: { createdAt: "desc" },
          })
        : null;
      if (local) {
        await cancelMembership({
          userId: local.userId,
          immediate: false,
        });
      }
    }

    await db.webhookEvent.updateMany({
      where: { provider: "razorpay", externalId, eventType },
      data: { processedAt: new Date() },
    });
  } catch (error) {
    await db.webhookEvent.updateMany({
      where: { provider: "razorpay", externalId, eventType },
      data: { error: error instanceof Error ? error.message : "processing_failed" },
    });
    console.error("[razorpay webhook] processing failed", error);
    return Response.json({ error: "processing_failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
