import { KycStatus, Role } from "@prisma/client";
import { AuditAction, recordAudit } from "./audit";
import { sendKycOutcomeSms } from "./apitxt";
import { db } from "./db";
import { fetchSessionDecision } from "./didit";
import { promoteToVerified, revokeVerified } from "./auth/role-service";
import { sendKycApprovedEmail, sendKycDeclinedEmail } from "./email";
import type { RequestContext } from "./request-context";

/**
 * Applies an already-authenticated Didit decision to our records.
 *
 * Callers must have established the status from a trusted source: a verified
 * webhook signature, or a live fetch from Didit's API with our key. Query
 * string values from the browser return URL are never a trusted source.
 */
export async function applyDiditDecision(params: {
  sessionId: string;
  status: KycStatus;
  decision?: unknown;
  scheme: string;
  trustsPayload: boolean;
  expectedUserId?: string;
  context: RequestContext;
}): Promise<{ applied: boolean; reason?: string }> {
  const { sessionId, status, scheme, trustsPayload, expectedUserId, context } = params;

  const record = await db.kycVerification.findUnique({
    where: { diditSessionId: sessionId },
    include: { user: true },
  });

  if (!record) {
    await recordAudit({
      action: AuditAction.KycWebhookRejected,
      success: false,
      context,
      metadata: { provider: "didit", reason: "unknown_session", sessionId, scheme },
    });
    return { applied: false, reason: "unknown_session" };
  }

  if (expectedUserId && record.userId !== expectedUserId) {
    await recordAudit({
      action: AuditAction.KycWebhookRejected,
      success: false,
      context,
      metadata: { provider: "didit", reason: "session_user_mismatch", sessionId, scheme },
    });
    return { applied: false, reason: "session_user_mismatch" };
  }

  let decision = params.decision ?? null;
  if (!trustsPayload) {
    try {
      decision = await fetchSessionDecision(sessionId);
    } catch (error) {
      console.error("[kyc] decision re-fetch failed", error);
      decision = null;
    }
  }

  const previousStatus = record.status;
  if (
    (previousStatus === KycStatus.APPROVED || record.user.kycStatus === KycStatus.APPROVED) &&
    status !== KycStatus.APPROVED &&
    status !== KycStatus.DECLINED
  ) {
    return { applied: false, reason: "already_approved" };
  }
  const isTerminal = status === KycStatus.APPROVED || status === KycStatus.DECLINED;

  await db.kycVerification.update({
    where: { diditSessionId: sessionId },
    data: {
      status,
      decision: decision ?? undefined,
      signatureScheme: scheme,
      completedAt: isTerminal ? new Date() : null,
    },
  });

  await db.user.update({
    where: { id: record.userId },
    data: { kycStatus: status },
  });

  await recordAudit({
    action: AuditAction.KycStatusChanged,
    actorUserId: record.userId,
    actorClerkId: record.user.clerkId,
    targetType: "kyc_verification",
    targetId: record.id,
    context,
    metadata: {
      sessionId,
      from: previousStatus,
      to: status,
      scheme,
      payloadTrusted: trustsPayload,
    },
  });

  if (status === KycStatus.APPROVED) {
    await promoteToVerified({
      targetUserId: record.userId,
      reason: "kyc_approved",
      context,
      metadata: { sessionId, scheme },
    });
    await notify(() => sendKycApprovedEmail(record.user));
    await notify(() => sendKycOutcomeSms(record.user, "approved"));
  }

  if (status === KycStatus.DECLINED && record.user.role === Role.VERIFIED_USER) {
    await revokeVerified({
      targetUserId: record.userId,
      reason: "kyc_revoked",
      context,
      metadata: { sessionId },
    });
  }

  if (status === KycStatus.DECLINED) {
    const reason =
      typeof (params.decision as { reason?: string } | null)?.reason === "string"
        ? (params.decision as { reason: string }).reason
        : null;
    await notify(() => sendKycDeclinedEmail(record.user, reason));
    await notify(() => sendKycOutcomeSms(record.user, "declined"));
  }

  return { applied: true };
}

async function notify(action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (error) {
    console.error("[kyc] notification failed", error);
  }
}
