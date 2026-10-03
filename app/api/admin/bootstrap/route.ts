import { Role } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { changeRole, countSuperAdmins } from "@/lib/auth/role-service";
import { getAuthContext, hasMfaEnrolled } from "@/lib/auth/session";
import { safeEqualSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env, isAdminMfaRequired, isBootstrapConfigured } from "@/lib/env";
import { sendAdminAlertEmail } from "@/lib/email";
import { checkRateLimit, rateLimitResponse } from "@/lib/ratelimit";
import { contextFromRequest } from "@/lib/request-context";

/**
 * Super admin bootstrap.
 *
 * Gates, all of which must pass:
 *   1. Signed in with a Clerk session (no anonymous promotion)
 *   2. TOTP enrolled, only when SUPER_ADMIN_REQUIRE_MFA is on (auto in production)
 *   3. Correct SUPER_ADMIN_BOOTSTRAP_KEY, compared in constant time
 *   4. No existing SUPER_ADMIN, unless SUPER_ADMIN_ALLOW_MULTIPLE is true
 *   5. Under 5 attempts per hour from this IP
 *
 * Every attempt is audited, successful or not, and every success emails the
 * security address. The rate limit is checked before the key comparison so a
 * brute-force attempt cannot be amplified by the work the comparison does.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ key: z.string().min(1).max(512) });

export async function POST(request: Request) {
  const context = contextFromRequest(request);

  if (!isBootstrapConfigured) {
    return Response.json(
      {
        error: "not_configured",
        message: "Super admin bootstrap is not configured.",
        keys: ["SUPER_ADMIN_BOOTSTRAP_KEY", "PAN_HASH_SALT"],
      },
      { status: 503 }
    );
  }

  const throttle = await checkRateLimit("bootstrap", `bootstrap:${context.ip}`);
  if (!throttle.success) {
    await recordAudit({
      action: AuditAction.BootstrapRejected,
      success: false,
      context,
      metadata: { reason: "rate_limited" },
    });
    return rateLimitResponse(throttle);
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    await recordAudit({
      action: AuditAction.BootstrapRejected,
      success: false,
      context,
      metadata: { reason: "unauthenticated" },
    });
    return Response.json(
      { error: "unauthenticated", message: "Sign in before requesting admin access." },
      { status: 401 }
    );
  }

  await recordAudit({
    action: AuditAction.BootstrapAttempted,
    actorUserId: ctx.user.id,
    actorClerkId: ctx.clerkId,
    actorRole: ctx.role,
    context,
  });

  if (ctx.role === Role.SUPER_ADMIN) {
    return Response.json({ ok: true, message: "You already have super admin access." });
  }

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_input", message: "Provide the admin key." }, { status: 400 });
  }

  const mfaEnrolled = await hasMfaEnrolled();
  await db.user.update({ where: { id: ctx.user.id }, data: { mfaEnabled: mfaEnrolled } });

  if (isAdminMfaRequired && !mfaEnrolled) {
    await recordAudit({
      action: AuditAction.BootstrapRejected,
      actorUserId: ctx.user.id,
      actorClerkId: ctx.clerkId,
      actorRole: ctx.role,
      success: false,
      context,
      metadata: { reason: "mfa_not_enrolled" },
    });
    return Response.json(
      {
        error: "mfa_required",
        message:
          "Enrol an authenticator app (TOTP) on your account before requesting admin access.",
      },
      { status: 403 }
    );
  }

  const existing = await countSuperAdmins();
  if (existing > 0 && !env.SUPER_ADMIN_ALLOW_MULTIPLE) {
    await recordAudit({
      action: AuditAction.BootstrapRejected,
      actorUserId: ctx.user.id,
      actorClerkId: ctx.clerkId,
      actorRole: ctx.role,
      success: false,
      context,
      metadata: { reason: "super_admin_exists", existing },
    });
    await sendAdminAlertEmail({
      subject: "AINF: blocked super admin bootstrap attempt",
      headline: "Someone tried to bootstrap a second super admin",
      lines: [
        `User: ${ctx.user.email} (${ctx.clerkId})`,
        `IP: ${context.ip}`,
        `User agent: ${context.userAgent}`,
        `Existing super admins: ${existing}`,
        "Rejected because SUPER_ADMIN_ALLOW_MULTIPLE is not enabled.",
      ],
    });
    return Response.json(
      {
        error: "already_bootstrapped",
        message: "A super admin already exists. Ask them to grant you access.",
      },
      { status: 409 }
    );
  }

  if (!safeEqualSecret(input.key, env.SUPER_ADMIN_BOOTSTRAP_KEY!)) {
    await recordAudit({
      action: AuditAction.BootstrapRejected,
      actorUserId: ctx.user.id,
      actorClerkId: ctx.clerkId,
      actorRole: ctx.role,
      success: false,
      context,
      metadata: { reason: "invalid_key" },
    });
    await sendAdminAlertEmail({
      subject: "AINF: failed super admin bootstrap attempt",
      headline: "An incorrect admin key was submitted",
      lines: [
        `User: ${ctx.user.email} (${ctx.clerkId})`,
        `IP: ${context.ip}`,
        `User agent: ${context.userAgent}`,
        `Attempts remaining this hour: ${throttle.remaining}`,
      ],
    });
    // Deliberately identical shape to other failures: no oracle for which gate failed.
    return Response.json(
      { error: "invalid_key", message: "That admin key is not valid." },
      { status: 403 }
    );
  }

  const promoted = await changeRole({
    targetUserId: ctx.user.id,
    nextRole: Role.SUPER_ADMIN,
    reason: "bootstrap",
    actor: { userId: ctx.user.id, clerkId: ctx.clerkId, role: ctx.role },
    context,
    metadata: { mfaEnrolled, mfaRequired: isAdminMfaRequired, priorSuperAdmins: existing },
  });

  await recordAudit({
    action: AuditAction.BootstrapSucceeded,
    actorUserId: promoted.id,
    actorClerkId: promoted.clerkId,
    actorRole: Role.SUPER_ADMIN,
    targetType: "user",
    targetId: promoted.id,
    context,
    metadata: { email: promoted.email },
  });

  await sendAdminAlertEmail({
    subject: "AINF: new super admin created",
    headline: "A super admin account was created",
    lines: [
      `User: ${promoted.email} (${promoted.clerkId})`,
      `IP: ${context.ip}`,
      `User agent: ${context.userAgent}`,
      `Time: ${new Date().toISOString()}`,
      "If this was not you, rotate SUPER_ADMIN_BOOTSTRAP_KEY immediately and demote the account.",
    ],
  });

  return Response.json({ ok: true, message: "Super admin access granted." });
}
