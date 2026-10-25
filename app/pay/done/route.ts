import { PaymentLinkStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { paymentNoticeHtml } from "@/lib/donate-document";
import { isDatabaseConfigured, isRazorpayConfigured } from "@/lib/env";
import { findPaymentLink, settleFromPaymentId } from "@/lib/payment-links";
import { verifyPaymentLinkSignature } from "@/lib/razorpay";
import { checkRateLimit } from "@/lib/ratelimit";
import { contextFromRequest } from "@/lib/request-context";

/**
 * Where Razorpay sends the payer after an admin-issued payment link.
 *
 * The query string is signed with our key secret. A valid paid signature lets
 * us settle immediately (the webhook may still be on its way) and send the
 * payer to their receipt or membership page. Anything else gets a calm page:
 * the webhook remains the source of truth for money that did move.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" };

function notice(status: number, body: Parameters<typeof paymentNoticeHtml>[0]): Response {
  return new Response(paymentNoticeHtml(body), { status, headers: HEADERS });
}

const PENDING = {
  eyebrow: "Payment received?",
  title: "We are confirming your payment",
  lead: "If money left your account, it is safe: we confirm every payment with Razorpay and email you as soon as it is matched. You can close this page.",
};

export async function GET(request: Request) {
  if (!isDatabaseConfigured || !isRazorpayConfigured) return notice(503, PENDING);

  const context = contextFromRequest(request);
  const throttle = await checkRateLimit("webhook", `paydone:${context.ip}`);
  if (!throttle.success) return notice(429, PENDING);

  const params = new URL(request.url).searchParams;
  const linkId = params.get("razorpay_payment_link_id") ?? "";
  const referenceId = params.get("razorpay_payment_link_reference_id") ?? "";
  const status = params.get("razorpay_payment_link_status") ?? "";
  const paymentId = params.get("razorpay_payment_id") ?? "";
  const signature = params.get("razorpay_signature") ?? "";

  if (!verifyPaymentLinkSignature({ linkId, referenceId, status, paymentId, signature })) {
    return notice(400, {
      eyebrow: "Link check",
      title: "This payment page could not be verified",
      lead: "Open the payment link from your email again. If you already paid, you will receive a confirmation email once Razorpay reports it.",
    });
  }

  const link = await findPaymentLink({ razorpayLinkId: linkId, referenceId });
  if (!link) return notice(404, PENDING);

  if (status !== "paid") {
    return notice(200, {
      eyebrow: "Not completed",
      title: "The payment did not go through",
      lead: "Nothing was charged. You can open the same link again to try once more while it is valid.",
    });
  }

  let settled = link.status === PaymentLinkStatus.PAID;
  if (!settled) {
    try {
      const result = await settleFromPaymentId(link, paymentId, "redirect", context);
      settled = result.ok;
    } catch (error) {
      console.error("[pay/done] settle failed", error);
      settled = false;
    }
  }
  if (!settled) return notice(202, PENDING);

  if (link.donationId) {
    const gift = await db.donation.findUnique({ where: { id: link.donationId }, select: { receiptToken: true } });
    if (gift) return Response.redirect(new URL(`/donate/receipt/${gift.receiptToken}`, request.url), 303);
  }
  if (link.membershipOrderId) {
    return Response.redirect(new URL("/account/membership?paid=link", request.url), 303);
  }
  return notice(200, {
    eyebrow: "Paid",
    title: "Thank you",
    lead: "Your payment is confirmed. A confirmation email is on its way.",
  });
}
