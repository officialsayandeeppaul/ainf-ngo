import { Role } from "@prisma/client";
import { guardApi } from "@/lib/auth/guard";
import { isRazorpayConfigured } from "@/lib/env";
import { formatDayTime } from "@/lib/format-date";
import { getRazorpayPayment, razorpayPaymentDashboardUrl } from "@/lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAYMENT_ID = /^pay_[A-Za-z0-9]+$/;

/** Super-admin live lookup of a Razorpay payment for testing / support. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminRead" });
  if (!guard.ok) return guard.response;

  if (!isRazorpayConfigured) {
    return Response.json(
      { error: "not_configured", message: "Razorpay keys are not configured." },
      { status: 503 }
    );
  }

  const { id: raw } = await params;
  const paymentId = decodeURIComponent(raw ?? "").trim();
  if (!PAYMENT_ID.test(paymentId)) {
    return Response.json(
      { error: "invalid_id", message: "That does not look like a Razorpay payment id." },
      { status: 400 }
    );
  }

  try {
    const payment = await getRazorpayPayment(paymentId);
    return Response.json({
      payment: {
        id: payment.id,
        status: payment.status,
        amountPaise: payment.amount,
        currency: payment.currency,
        method: payment.method,
        email: payment.email,
        contact: payment.contact,
        orderId: payment.order_id,
        captured: Boolean(payment.captured),
        refundedPaise: payment.amount_refunded ?? 0,
        errorCode: payment.error_code,
        errorDescription: payment.error_description,
        createdAt: payment.created_at
          ? formatDayTime(new Date(payment.created_at * 1000))
          : null,
        dashboardUrl: razorpayPaymentDashboardUrl(payment.id),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Razorpay lookup failed.";
    return Response.json({ error: "razorpay_failed", message }, { status: 502 });
  }
}
