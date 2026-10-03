import { z } from "zod";
import { sendTextOtp } from "@/lib/apitxt";
import { AuditAction, recordAudit } from "@/lib/audit";
import { isClerkConfigured, isDatabaseConfigured, isTextOtpConfigured } from "@/lib/env";
import { beginMobileRegistration, indianMobile, newOtpCode } from "@/lib/mobile-auth";
import { findMobileAccount } from "@/lib/mobile-user";
import { checkRateLimit, rateLimitResponse } from "@/lib/ratelimit";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().trim().min(10).max(16),
  firstName: z.string().trim().max(40).optional(),
});

export async function POST(request: Request) {
  if (!isClerkConfigured || !isDatabaseConfigured || !isTextOtpConfigured) {
    return Response.json(
      { error: "not_configured", message: "Mobile registration needs Clerk and the text OTP key." },
      { status: 503 }
    );
  }

  const context = contextFromRequest(request);
  const ipLimit = await checkRateLimit("otpSend", `mobile-reg:${context.ip}`);
  if (!ipLimit.success) return rateLimitResponse(ipLimit, "otpSend");

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_input", message: "Enter a mobile number." }, { status: 400 });
  }

  const phone = indianMobile(input.phone);
  if (!phone) {
    return Response.json(
      { error: "invalid_input", message: "Enter a 10-digit Indian mobile number starting with 6–9." },
      { status: 400 }
    );
  }

  const phoneLimit = await checkRateLimit("otpSend", `mobile-reg:${phone}`);
  if (!phoneLimit.success) return rateLimitResponse(phoneLimit, "otpSend");

  const existing = await findMobileAccount(phone);
  if (existing) {
    return Response.json(
      { error: "taken", message: "That mobile number already has an account. Sign in instead." },
      { status: 409 }
    );
  }

  const code = newOtpCode();
  const sms = await sendTextOtp({ mobile: phone, otp: code });
  if (!sms.sent) {
    return Response.json(
      { error: "sms_failed", message: "The code could not be sent. Try again in a moment." },
      { status: 502 }
    );
  }

  await beginMobileRegistration({
    phone10: phone,
    firstName: input.firstName?.trim() || null,
    code,
  });

  await recordAudit({
    action: AuditAction.UserCreated,
    success: true,
    context,
    metadata: { source: "mobile_otp_sent", phoneLast4: phone.slice(-4) },
  });

  return Response.json({ ok: true, phoneLast4: phone.slice(-4) });
}
