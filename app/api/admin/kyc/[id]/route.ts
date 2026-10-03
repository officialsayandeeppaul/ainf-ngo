import { KycStatus, Role } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { promoteToVerified, revokeVerified } from "@/lib/auth/role-service";
import { db } from "@/lib/db";
import { sendKycApprovedEmail, sendKycDeclinedEmail } from "@/lib/email";
import { contextFromRequest } from "@/lib/request-context";
import { getVerificationPolicy } from "@/lib/verification-policy";

/**
 * Manual review of a verification that Didit left IN_REVIEW.
 *
 * A human decision here carries the same weight as a signed webhook decision,
 * so it goes through the same role-service path and is audited with the
 * reviewer's identity and note attached.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  decision: z.enum(["approve", "decline"]),
  note: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;

  const { ctx } = guard;
  const context = contextFromRequest(request);
  const { id } = await params;

  if (!getVerificationPolicy().didit) {
    return Response.json(
      { error: "not_enabled", message: "Didit verification is off on this instance." },
      { status: 404 }
    );
  }

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_input", message: "Invalid request." }, { status: 400 });
  }

  const record = await db.kycVerification.findUnique({ where: { id }, include: { user: true } });
  if (!record) {
    return Response.json({ error: "not_found", message: "Verification not found." }, { status: 404 });
  }

  const nextStatus = input.decision === "approve" ? KycStatus.APPROVED : KycStatus.DECLINED;

  await db.kycVerification.update({
    where: { id },
    data: {
      status: nextStatus,
      reviewedByUserId: ctx.user.id,
      reviewNote: input.note ?? null,
      reviewedAt: new Date(),
      completedAt: new Date(),
    },
  });

  await db.user.update({ where: { id: record.userId }, data: { kycStatus: nextStatus } });

  await recordAudit({
    action: AuditAction.KycManualReview,
    actorUserId: ctx.user.id,
    actorClerkId: ctx.clerkId,
    actorRole: ctx.role,
    targetType: "kyc_verification",
    targetId: record.id,
    context,
    metadata: {
      decision: input.decision,
      note: input.note ?? null,
      subjectUserId: record.userId,
      previousStatus: record.status,
    },
  });

  if (nextStatus === KycStatus.APPROVED) {
    await promoteToVerified({
      targetUserId: record.userId,
      reason: "kyc_approved",
      context,
      metadata: { manualReviewBy: ctx.user.email, kycId: record.id },
    });
    void sendKycApprovedEmail(record.user).catch(() => {});
  } else {
    if (record.user.role === Role.VERIFIED_USER) {
      await revokeVerified({
        targetUserId: record.userId,
        reason: "kyc_revoked",
        actor: { userId: ctx.user.id, clerkId: ctx.clerkId, role: ctx.role },
        context,
        metadata: { manualReviewBy: ctx.user.email, kycId: record.id },
      });
    }
    void sendKycDeclinedEmail(record.user, input.note ?? null).catch(() => {});
  }

  return Response.json({ ok: true, status: nextStatus });
}
