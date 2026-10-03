import { Role } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { GIFT_MIN_PAISE } from "@/lib/donation-rules";
import { db } from "@/lib/db";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  minPaise: z.number().int().min(GIFT_MIN_PAISE).max(10_000_000),
  maxPaise: z.number().int().min(GIFT_MIN_PAISE).max(10_000_000),
  suggestedPaise: z.array(z.number().int().min(GIFT_MIN_PAISE).max(10_000_000)).min(1).max(6),
}).refine((value) => value.minPaise <= value.maxPaise, {
  message: "The minimum must be at or below the maximum.",
});

export async function PATCH(request: Request) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? (error.issues[0]?.message ?? "Invalid input.") : "Invalid input.";
    return Response.json({ error: "invalid_input", message }, { status: 400 });
  }

  const unique = [...new Set(input.suggestedPaise)].sort((a, b) => a - b);
  const row = await db.donationSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      minPaise: input.minPaise,
      maxPaise: input.maxPaise,
      suggestedPaise: unique,
      updatedByUserId: guard.ctx.user.id,
    },
    update: {
      minPaise: input.minPaise,
      maxPaise: input.maxPaise,
      suggestedPaise: unique,
      updatedByUserId: guard.ctx.user.id,
    },
  });

  await recordAudit({
    action: AuditAction.DonationSettingsUpdated,
    actorUserId: guard.ctx.user.id,
    actorClerkId: guard.ctx.clerkId,
    actorRole: guard.ctx.role,
    targetType: "donation_settings",
    targetId: row.id,
    context: contextFromRequest(request),
    metadata: { minPaise: row.minPaise, maxPaise: row.maxPaise },
  });

  return Response.json({
    ok: true,
    settings: { minPaise: row.minPaise, maxPaise: row.maxPaise, suggestedPaise: row.suggestedPaise },
  });
}
