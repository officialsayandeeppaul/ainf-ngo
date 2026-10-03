import { Role, UserStatus } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { changeRole, countSuperAdmins, setUserStatus } from "@/lib/auth/role-service";
import { db } from "@/lib/db";
import { contextFromRequest } from "@/lib/request-context";

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
    reason: z.string().trim().max(400).optional(),
  }),
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

  const updated = await setUserStatus({
    targetUserId: target.id,
    status: input.status,
    reason: input.reason ?? null,
    actor,
    context,
  });

  return Response.json({ ok: true, status: updated.status });
}
