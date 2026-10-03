import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { KycStatus, Role, UserStatus } from "@prisma/client";
import { AuditAction, recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/email";
import { isClerkConfigured, isDatabaseConfigured, env } from "@/lib/env";
import { checkRateLimit } from "@/lib/ratelimit";
import { contextFromRequest } from "@/lib/request-context";
import { indianMobile, mobileAccountEmail, e164India } from "@/lib/mobile-auth";

/**
 * Clerk user lifecycle webhook.
 *
 * Keeps the Postgres User table aligned with Clerk. Role is never taken from
 * this payload: Postgres owns role, and a create/update event only ever writes
 * profile fields. That prevents a spoofed or replayed Clerk event from
 * escalating anyone's privileges.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function primaryEmail(data: any): string | null {
  const list: any[] = data?.email_addresses ?? [];
  const primary = list.find((e) => e.id === data?.primary_email_address_id);
  return primary?.email_address ?? list[0]?.email_address ?? null;
}

function metadataPhone(data: any): string | null {
  const raw = data?.public_metadata?.phone;
  const local = indianMobile(typeof raw === "string" ? raw : "");
  return local ? e164India(local) : null;
}

function primaryPhone(data: any): string | null {
  const list: any[] = data?.phone_numbers ?? [];
  const primary = list.find((p) => p.id === data?.primary_phone_number_id);
  return primary?.phone_number ?? list[0]?.phone_number ?? null;
}

export async function POST(request: NextRequest) {
  if (!isClerkConfigured || !env.CLERK_WEBHOOK_SIGNING_SECRET) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }
  if (!isDatabaseConfigured) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const context = contextFromRequest(request);
  const throttle = await checkRateLimit("webhook", `clerk:${context.ip}`);
  if (!throttle.success) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let event: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    // Verifies the svix signature and timestamp against the signing secret.
    event = await verifyWebhook(request, {
      signingSecret: env.CLERK_WEBHOOK_SIGNING_SECRET,
    });
  } catch (error) {
    await recordAudit({
      action: AuditAction.KycWebhookRejected,
      success: false,
      context,
      metadata: { provider: "clerk", reason: "signature_verification_failed" },
    });
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }

  const type = event.type;
  const data = event.data as any;
  const svixId = request.headers.get("svix-id") ?? `${type}:${data?.id}`;

  // Idempotency: svix retries on any non-2xx, so the same id can arrive twice.
  try {
    await db.webhookEvent.create({
      data: { provider: "clerk", externalId: svixId, eventType: type, payload: data },
    });
  } catch {
    return Response.json({ ok: true, deduplicated: true });
  }

  try {
    if (type === "user.created" || type === "user.updated") {
      const clerkId: string = data.id;
      const localPhone = indianMobile(primaryPhone(data) ?? "");
      const email = primaryEmail(data) ?? (localPhone ? mobileAccountEmail(localPhone) : null);
      if (!email) {
        return Response.json({ ok: true, skipped: "no_email" });
      }

      const phone = primaryPhone(data) ?? metadataPhone(data);
      const profile = {
        firstName: data.first_name ?? null,
        lastName: data.last_name ?? null,
        imageUrl: data.image_url ?? null,
        ...(phone ? { phone } : {}),
        mfaEnabled: Boolean(data.two_factor_enabled),
      };

      const existing = await db.user.findUnique({ where: { clerkId } });
      let isNewAccount = false;
      if (existing) {
        await db.user.update({ where: { clerkId }, data: { ...profile, email } });
      } else {
        // A row may already exist by email (e.g. a mobile-first registration that
        // is now gaining a Clerk id). Welcome only a genuinely new account.
        const priorByEmail = await db.user.findUnique({ where: { email }, select: { id: true } });
        isNewAccount = !priorByEmail;
        await db.user.upsert({
          where: { email },
          update: { clerkId, ...profile },
          create: {
            clerkId,
            email,
            ...profile,
            role: Role.USER,
            status: UserStatus.ACTIVE,
            kycStatus: KycStatus.NOT_STARTED,
          },
        });
      }

      await recordAudit({
        action: type === "user.created" ? AuditAction.UserCreated : AuditAction.UserUpdated,
        actorClerkId: clerkId,
        targetType: "user",
        targetId: clerkId,
        context,
        metadata: { source: "clerk_webhook", type },
      });

      // Fire-and-forget: a bounced welcome must never fail the webhook.
      if (isNewAccount) {
        void sendWelcomeEmail({ email, firstName: profile.firstName }).catch(() => {});
      }
    }

    if (type === "user.deleted") {
      const clerkId: string = data.id;
      const user = await db.user.findUnique({ where: { clerkId } });
      if (user) {
        // Audit rows survive via ON DELETE SET NULL; the trigger installed in
        // migration 20260902000001 forbids deleting them outright.
        await db.user.delete({ where: { clerkId } });
        await recordAudit({
          action: AuditAction.UserDeleted,
          targetType: "user",
          targetId: user.id,
          context,
          metadata: { source: "clerk_webhook", email: user.email },
        });
      }
    }

    await db.webhookEvent.updateMany({
      where: { provider: "clerk", externalId: svixId },
      data: { processedAt: new Date() },
    });

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.webhookEvent.updateMany({
      where: { provider: "clerk", externalId: svixId },
      data: { error: message },
    });
    console.error("[clerk webhook] processing failed", error);
    // 500 asks svix to retry; the WebhookEvent row records the failure.
    return Response.json({ error: "processing_failed" }, { status: 500 });
  }
}
