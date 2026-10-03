import { AuditAction, recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { mapDiditStatus, verifyWebhookSignature } from "@/lib/didit";
import { isDatabaseConfigured, isDiditWebhookConfigured } from "@/lib/env";
import { applyDiditDecision } from "@/lib/kyc-apply";
import { checkRateLimit } from "@/lib/ratelimit";
import { contextFromRequest } from "@/lib/request-context";

/**
 * Didit verification webhook.
 *
 * Nothing from the request body reaches application logic before the signature
 * and timestamp are verified. The handler is idempotent on
 * (provider, session_id, status) so Didit's retries cannot double-promote or
 * double-notify, and role changes go through role-service so they are audited.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = contextFromRequest(request);

  if (!isDiditWebhookConfigured || !isDatabaseConfigured) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const throttle = await checkRateLimit("webhook", `didit:${context.ip}`);
  if (!throttle.success) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  // Exact bytes: the RAW signature scheme is computed over them, so parsing
  // first and re-serialising would break verification.
  const rawBody = Buffer.from(await request.arrayBuffer());

  const verification = verifyWebhookSignature({ rawBody, headers: request.headers });
  if (!verification.ok) {
    await recordAudit({
      action: AuditAction.KycWebhookRejected,
      success: false,
      context,
      metadata: { provider: "didit", reason: verification.reason },
    });
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const sessionId: string | undefined = payload?.session_id;
  const rawStatus: string | undefined = payload?.status;
  if (!sessionId || !rawStatus) {
    return Response.json({ error: "missing_session_or_status" }, { status: 400 });
  }

  const status = mapDiditStatus(rawStatus);
  const eventType = `${payload?.webhook_type ?? "status.updated"}:${status}`;

  try {
    await db.webhookEvent.create({
      data: {
        provider: "didit",
        externalId: sessionId,
        eventType,
        payload,
      },
    });
  } catch {
    return Response.json({ ok: true, deduplicated: true });
  }

  try {
    await applyDiditDecision({
      sessionId,
      status,
      decision: payload?.decision ?? null,
      scheme: verification.scheme,
      trustsPayload: verification.trustsPayload,
      context,
    });
    await db.webhookEvent.updateMany({
      where: { provider: "didit", externalId: sessionId, eventType },
      data: { processedAt: new Date() },
    });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.webhookEvent.updateMany({
      where: { provider: "didit", externalId: sessionId, eventType },
      data: { error: message },
    });
    console.error("[didit webhook] processing failed", error);
    return Response.json({ error: "processing_failed" }, { status: 500 });
  }
}
