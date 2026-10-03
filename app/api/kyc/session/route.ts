import { KycStatus, Role } from "@prisma/client";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { DiditError, createVerificationSession } from "@/lib/didit";
import { getVerificationPolicy } from "@/lib/verification-policy";
import { MissingConfigError, absoluteUrl, isDiditConfigured } from "@/lib/env";
import { contextFromRequest } from "@/lib/request-context";

/**
 * Starts a Didit verification session for the signed-in user.
 *
 * Rate limited to 3 per hour per user: each session is a billable vendor
 * operation, and a tighter loop would let one account exhaust the quota.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await guardApi({ required: Role.USER, limiter: "kycSession" });
  if (!guard.ok) return guard.response;

  const { ctx } = guard;
  const context = contextFromRequest(request);

  const policy = getVerificationPolicy();
  if (!policy.didit || !isDiditConfigured) {
    return Response.json(
      {
        error: policy.didit ? "not_configured" : "not_enabled",
        message: "Identity document verification is not enabled on this instance.",
        keys: policy.didit ? ["DIDIT_API_KEY", "DIDIT_WORKFLOW_ID"] : undefined,
      },
      { status: policy.didit ? 503 : 404 }
    );
  }

  if (ctx.user.kycStatus === KycStatus.APPROVED) {
    return Response.json(
      { error: "already_verified", message: "Your identity is already verified." },
      { status: 409 }
    );
  }

  // Reuse a session that is still open rather than burning another credit.
  const open = await db.kycVerification.findFirst({
    where: {
      userId: ctx.user.id,
      status: { in: [KycStatus.NOT_STARTED, KycStatus.IN_PROGRESS] },
      createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });

  try {
    const session = await createVerificationSession({
      vendorData: ctx.user.id,
      callbackUrl: absoluteUrl("/account/verify?from=didit"),
      contactEmail: ctx.user.email,
    });

    await db.kycVerification.upsert({
      where: { diditSessionId: session.sessionId },
      update: { status: session.status },
      create: {
        userId: ctx.user.id,
        diditSessionId: session.sessionId,
        workflowId: process.env.DIDIT_WORKFLOW_ID ?? "unknown",
        sessionNumber: session.sessionNumber,
        status: session.status,
      },
    });

    await db.user.update({
      where: { id: ctx.user.id },
      data: {
        kycStatus:
          session.status === KycStatus.NOT_STARTED ? KycStatus.IN_PROGRESS : session.status,
      },
    });

    await recordAudit({
      action: AuditAction.KycSessionCreated,
      actorUserId: ctx.user.id,
      actorClerkId: ctx.clerkId,
      actorRole: ctx.role,
      targetType: "kyc_verification",
      targetId: session.sessionId,
      context,
      metadata: { reusedOpenSession: Boolean(open), sessionNumber: session.sessionNumber },
    });

    return Response.json({ url: session.url, sessionId: session.sessionId });
  } catch (error) {
    if (error instanceof MissingConfigError) {
      return Response.json({ error: "not_configured", keys: error.keys }, { status: 503 });
    }

    const isDidit = error instanceof DiditError;
    await recordAudit({
      action: AuditAction.KycSessionCreated,
      actorUserId: ctx.user.id,
      actorClerkId: ctx.clerkId,
      actorRole: ctx.role,
      success: false,
      context,
      metadata: {
        provider: "didit",
        status: isDidit ? error.status : null,
        message: error instanceof Error ? error.message : String(error),
      },
    });

    console.error("[kyc/session] failed", error);
    return Response.json(
      {
        error: "session_failed",
        message: isDidit
          ? error.message
          : "Could not start verification right now. Please try again shortly.",
      },
      { status: 502 }
    );
  }
}
