import { Role, UserStatus } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import {
  changeRole,
  countSuperAdmins,
  recordManualSuspensionNotice,
  resendSuspensionNotice,
  setUserStatusWithNotice,
} from "@/lib/auth/role-service";
import { db } from "@/lib/db";
import { contextFromRequest } from "@/lib/request-context";
import {
  MANUAL_NOTICE_CHANNELS,
  SUSPENSION_PERIOD_VALUES,
  SUSPENSION_REASON_MAX,
  SUSPENSION_REASON_MIN,
  suspendedUntilFor,
} from "@/lib/suspension";

/**
 * Super admin user mutations.
 *
 * Guard rails that matter more than the happy path:
 *  - An admin cannot change their own role or status (no self-lockout, no
 *    self-escalation loop).
 *  - The last remaining SUPER_ADMIN cannot be demoted, which would leave the
 *    instance with no way back in except a bootstrap-key rotation.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setRole"), role: z.nativeEnum(Role) }),
  z.object({
    action: z.literal("setStatus"),
    status: z.nativeEnum(UserStatus),
    reason: z.string().trim().max(SUSPENSION_REASON_MAX).optional(),
    period: z.enum(SUSPENSION_PERIOD_VALUES).optional(),
  }),
  // Try the automatic email / SMS again.
  z.object({ action: z.literal("resendNotice") }),
  // The admin told the member themselves (WhatsApp, a call…).
  z.object({ action: z.literal("recordNotice"), channel: z.enum(MANUAL_NOTICE_CHANNELS) }),
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;

  const { ctx } = guard;
  const context = contextFromRequest(request);
  const { id: targetUserId } = await params;

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError ? (error.issues[0]?.message ?? "Invalid request.") : "Invalid request.";
    return Response.json({ error: "invalid_input", message }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    return Response.json({ error: "not_found", message: "User not found." }, { status: 404 });
  }

  if (target.id === ctx.user.id) {
    await recordAudit({
      action: AuditAction.AccessDenied,
      actorUserId: ctx.user.id,
      actorClerkId: ctx.clerkId,
      actorRole: ctx.role,
      success: false,
      targetType: "user",
      targetId: target.id,
      context,
      metadata: { reason: "self_mutation_blocked", attempted: input.action },
    });
    return Response.json(
      {
        error: "self_mutation",
        message: "Use another super admin account to change your own role or status.",
      },
      { status: 403 }
    );
  }

  const actor = { userId: ctx.user.id, clerkId: ctx.clerkId, role: ctx.role };

  if (input.action === "setRole") {
    if (target.role === Role.SUPER_ADMIN && input.role !== Role.SUPER_ADMIN) {
      const admins = await countSuperAdmins();
      if (admins <= 1) {
        return Response.json(
          {
            error: "last_super_admin",
            message: "Cannot demote the only super admin. Promote someone else first.",
          },
          { status: 409 }
        );
      }
    }

    const updated = await changeRole({
      targetUserId: target.id,
      nextRole: input.role,
      reason: input.role === Role.SUPER_ADMIN ? "admin_manual" : "admin_demote",
      actor,
      context,
    });

    return Response.json({ ok: true, role: updated.role });
  }

  if (input.action === "resendNotice" || input.action === "recordNotice") {
    if (target.status === UserStatus.ACTIVE) {
      return Response.json(
        { error: "not_suspended", message: "This account is active, so there is nothing to tell them." },
        { status: 409 }
      );
    }
    if (input.action === "recordNotice") {
      const told = await recordManualSuspensionNotice({ user: target, channel: input.channel, actor, context });
      return Response.json({ ok: true, notice: noticeJson(told, null) });
    }
    const { user, notice } = await resendSuspensionNotice({ user: target, actor, context });
    return Response.json({ ok: true, notice: noticeJson(user, notice.sent ? null : notice.error, notice.channel) });
  }

  // The member is told why and for how long, so both are required to suspend.
  const suspending = input.status !== UserStatus.ACTIVE;
  if (suspending && (input.reason ?? "").length < SUSPENSION_REASON_MIN) {
    return Response.json(
      {
        error: "reason_required",
        message: `Write the reason the member will see (at least ${SUSPENSION_REASON_MIN} characters).`,
      },
      { status: 400 }
    );
  }
  if (input.status === UserStatus.SUSPENDED && !input.period) {
    return Response.json(
      { error: "period_required", message: "Choose how long the suspension lasts." },
      { status: 400 }
    );
  }

  const { user: updated, notice } = await setUserStatusWithNotice({
    targetUserId: target.id,
    status: input.status,
    reason: suspending ? (input.reason ?? null) : null,
    until: input.status === UserStatus.SUSPENDED && input.period ? suspendedUntilFor(input.period) : null,
    actor,
    context,
  });

  return Response.json({
    ok: true,
    status: updated.status,
    suspendedUntil: updated.suspendedUntil ? updated.suspendedUntil.toISOString() : null,
    notice: suspending ? noticeJson(updated, notice && !notice.sent ? notice.error : null, notice?.channel ?? null) : null,
  });
}

/** What the admin screen shows after a notice attempt. */
function noticeJson(
  user: { suspensionNoticeChannel: string | null; suspensionNoticeSentAt: Date | null },
  error: string | null,
  tried: string | null = null
) {
  return {
    channel: user.suspensionNoticeChannel ?? tried,
    sent: Boolean(user.suspensionNoticeSentAt),
    sentAt: user.suspensionNoticeSentAt ? user.suspensionNoticeSentAt.toISOString() : null,
    error,
  };
}
