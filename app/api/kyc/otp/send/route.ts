import { KycStatus, Role } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { sendSms } from "@/lib/apitxt";
import { guardApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { sendOtpEmail } from "@/lib/email";
import { issueOtp, isValidIndianMobile, normalisePhone } from "@/lib/otp";
import { contextFromRequest } from "@/lib/request-context";
import { getVerificationPolicy } from "@/lib/verification-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  phone: z.string().trim().min(10).max(16),
});

export async function POST(request: Request) {
  const guard = await guardApi({ required: Role.USER, limiter: "otpSend" });
  if (!guard.ok) return guard.response;

  const policy = getVerificationPolicy();
  if (!policy.otp) {
    return Response.json({ error: "not_enabled", message: "Mobile OTP is not enabled." }, { status: 404 });
  }
  if (policy.otpChannel === "none") {
    return Response.json(
      {
        error: "not_configured",
        message: "OTP is on, but neither SMS (APITXT_SENDER_ID) nor email (RESEND_API_KEY) can deliver a code.",
        keys: ["APITXT_SENDER_ID", "RESEND_API_KEY"],
      },
      { status: 503 }
    );
  }

  const { ctx } = guard;
  const context = contextFromRequest(request);

  if (
    ctx.user.kycStatus === KycStatus.APPROVED ||
    ctx.user.role === Role.VERIFIED_USER ||
    ctx.user.role === Role.SUPER_ADMIN
  ) {
    return Response.json({ error: "already_verified", message: "Your identity is already verified." }, { status: 409 });
  }

  let phone: string;
  try {
    phone = normalisePhone(bodySchema.parse(await request.json()).phone);
  } catch {
    return Response.json({ error: "invalid_input", message: "Enter a valid Indian mobile number." }, { status: 400 });
  }

  if (!isValidIndianMobile(phone)) {
    return Response.json(
      { error: "invalid_input", message: "Enter a 10-digit Indian mobile number starting with 6–9." },
      { status: 400 }
    );
  }

  const { code, last4 } = await issueOtp(ctx.user.id, phone);
  await db.user.update({ where: { id: ctx.user.id }, data: { phone } });

  let delivered = false;
  let channel = policy.otpChannel;

  if (policy.otpChannel === "sms") {
    const sms = await sendSms({
      to: phone,
      message: `AINF: Your verification code is ${code}. It expires in 10 minutes. Do not share it.`,
    });
    delivered = sms.sent;
    if (!sms.sent) {
      const email = await sendOtpEmail({ to: ctx.user.email, firstName: ctx.user.firstName, code });
      delivered = email.sent;
      channel = "email";
    }
  } else {
    const email = await sendOtpEmail({ to: ctx.user.email, firstName: ctx.user.firstName, code });
    delivered = email.sent;
  }

  await recordAudit({
    action: AuditAction.OtpSent,
    actorUserId: ctx.user.id,
    actorClerkId: ctx.clerkId,
    actorRole: ctx.role,
    success: delivered,
    context,
    metadata: { channel, last4 },
  });

  if (!delivered) {
    return Response.json(
      { error: "delivery_failed", message: "Could not send a verification code. Please try again shortly." },
      { status: 502 }
    );
  }

  return Response.json({
    ok: true,
    channel,
    last4,
    message:
      channel === "sms"
        ? `A code was sent to the number ending ${last4}.`
        : "A code was emailed to the address on this account.",
  });
}
