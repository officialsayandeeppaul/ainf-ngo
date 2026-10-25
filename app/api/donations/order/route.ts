import { DonationKind, PaymentPurpose } from "@prisma/client";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth/session";
import { checkGiftRequest, createGiftOrder } from "@/lib/donations";
import { env, isDatabaseConfigured, isRazorpayConfigured } from "@/lib/env";
import { pausedPayload, recordPaymentInterest } from "@/lib/payment-interest";
import { getPaymentSettings, paymentsOpenFor } from "@/lib/payment-settings";
import { checkRateLimit, rateLimitResponse } from "@/lib/ratelimit";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["GENERAL", "MISSION", "PROJECT"]),
  slug: z.string().trim().max(80).optional(),
  amountPaise: z.number().int(),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(8).max(20),
  source: z.string().trim().max(40).optional(),
});

/** Starts a one-time Razorpay order. The amount is checked again on the server. */
export async function POST(request: Request) {
  if (!isDatabaseConfigured) {
    return Response.json({ error: "not_configured", message: "Gifts are temporarily unavailable." }, { status: 503 });
  }

  const context = contextFromRequest(request);
  const throttle = await checkRateLimit("donate", `donate:${context.ip}`);
  if (!throttle.success) return rateLimitResponse(throttle, "donate");

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return Response.json(
      { error: "invalid_input", message: "Name, email, phone, and a whole-rupee amount are required." },
      { status: 400 }
    );
  }

  const digits = input.phone.replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) {
    return Response.json({ error: "invalid_input", message: "Enter a phone number we can reach." }, { status: 400 });
  }

  const settings = await getPaymentSettings();
  if (!paymentsOpenFor(settings)) {
    const checked = await checkGiftRequest(input);
    if (!checked.ok) {
      return Response.json({ error: "rejected", message: checked.message }, { status: checked.status });
    }
    const viewer = await getAuthContext().catch(() => null);
    const { interest } = await recordPaymentInterest(
      {
        purpose: PaymentPurpose.DONATION,
        userId: viewer?.user.id ?? null,
        name: input.name,
        email: input.email,
        phone: input.phone,
        amountPaise: input.amountPaise,
        donationKind: checked.target.kind as DonationKind,
        targetSlug: checked.target.slug,
        targetTitle: checked.target.title,
        source: input.source ?? "site",
      },
      context
    );
    return Response.json(pausedPayload(settings, interest), { status: 409 });
  }
  if (!isRazorpayConfigured) {
    return Response.json({ error: "not_configured", message: "Gifts are temporarily unavailable." }, { status: 503 });
  }

  const created = await createGiftOrder({
    kind: input.kind,
    slug: input.slug,
    amountPaise: input.amountPaise,
    donorName: input.name,
    donorEmail: input.email.toLowerCase(),
    donorPhone: input.phone,
  });
  if (!created.ok) {
    return Response.json({ error: "rejected", message: created.message }, { status: created.status });
  }

  return Response.json({
    ok: true,
    keyId: env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    razorpayOrderId: created.razorpayOrderId,
    amountPaise: created.amountPaise,
    currency: created.currency,
    description: created.description,
  });
}
