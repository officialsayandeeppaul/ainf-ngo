import { KycStatus, Role } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { promoteToVerified } from "@/lib/auth/role-service";
import { db } from "@/lib/db";
import { consumeOtp } from "@/lib/otp";
import { contextFromRequest } from "@/lib/request-context";
import { getVerificationPolicy } from "@/lib/verification-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export async function POST(request: Request) {
  const guard = await guardApi({ required: Role.USER, limiter: "otpVerify" });
  if (!guard.ok) return guard.response;

  const policy = getVerificationPolicy();
  if (!policy.otp) {
    return Response.json({ error: "not_enabled" }, { status: 404 });
  }

  const { ctx } = guard;
  const context = contextFromRequest(request);

  let code: string;
  try {
    code = bodySchema.parse(await request.json()).code;
  } catch (error) {
    const message =
      error instanceof z.ZodError ? (error.issues[0]?.message ?? "Invalid code.") : "Invalid request.";
    return Response.json({ error: "invalid_input", message }, { status: 400 });
  }

  const result = await consumeOtp(ctx.user.id, code);
  if (!result.ok) {
    await recordAudit({
      action: AuditAction.OtpFailed,
      actorUserId: ctx.user.id,
      actorClerkId: ctx.clerkId,
      actorRole: ctx.role,
      success: false,
      context,
      metadata: { reason: result.reason },
    });
    const message =
      result.reason === "locked"
        ? "Too many incorrect attempts. Request a new code."
        : result.reason === "missing"
          ? "That code has expired. Request a new one."
          : "That code is not correct.";
    return Response.json({ error: result.reason, message }, { status: 401 });
  }

  await db.user.update({
    where: { id: ctx.user.id },
    data: { kycStatus: KycStatus.APPROVED },
  });

  await promoteToVerified({
    targetUserId: ctx.user.id,
    reason: "otp_verified",
    context,
  });

  await recordAudit({
    action: AuditAction.OtpVerified,
    actorUserId: ctx.user.id,
    actorClerkId: ctx.clerkId,
    actorRole: ctx.role,
    context,
  });

  return Response.json({ ok: true, message: "Your phone number is verified." });
}
