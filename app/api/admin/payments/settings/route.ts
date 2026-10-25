import { Role } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { noStore } from "@/lib/http";
import { getPaymentSettings, toPaymentSettingsView } from "@/lib/payment-settings";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  enabled: z.boolean(),
  pausedMessage: z.string().trim().max(600).default(""),
});

export const GET = noStore(async function GET() {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminRead" });
  if (!guard.ok) return guard.response;
  return Response.json({ settings: toPaymentSettingsView(await getPaymentSettings()) });
});

export async function PATCH(request: Request) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? (error.issues[0]?.message ?? "Invalid input.") : "Invalid input.";
    return Response.json({ error: "invalid_input", message }, { status: 400 });
  }

  const before = await getPaymentSettings();
  const switching = before.enabled !== input.enabled;
  const row = await db.paymentSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      enabled: input.enabled,
      pausedMessage: input.pausedMessage,
      pausedAt: input.enabled ? null : new Date(),
      updatedByUserId: guard.ctx.user.id,
    },
    update: {
      enabled: input.enabled,
      pausedMessage: input.pausedMessage,
      ...(switching ? { pausedAt: input.enabled ? null : new Date() } : {}),
      updatedByUserId: guard.ctx.user.id,
    },
  });

  await recordAudit({
    action: AuditAction.PaymentsSwitched,
    actorUserId: guard.ctx.user.id,
    actorClerkId: guard.ctx.clerkId,
    actorRole: guard.ctx.role,
    targetType: "payment_settings",
    targetId: "singleton",
    context: contextFromRequest(request),
    metadata: {
      enabled: row.enabled,
      switched: switching,
      customMessage: Boolean(row.pausedMessage.trim()),
    },
  });

  return Response.json({ ok: true, settings: toPaymentSettingsView(row) });
}
