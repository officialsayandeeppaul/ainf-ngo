import { Role } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { GIFT_MIN_PAISE } from "@/lib/donation-rules";
import { db } from "@/lib/db";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug uses lowercase letters, numbers, and hyphens.");

const schema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(80),
  published: z.boolean(),
  sortOrder: z.number().int().min(0).max(99),
  minPaise: z.number().int().min(GIFT_MIN_PAISE).max(10_000_000).nullable(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? (error.issues[0]?.message ?? "Invalid input.") : "Invalid input.";
    return Response.json({ error: "invalid_input", message }, { status: 400 });
  }

  try {
    const row = await db.donationMission.update({
      where: { id },
      data: { ...input, updatedByUserId: guard.ctx.user.id },
    });
    await recordAudit({
      action: AuditAction.DonationMissionSaved,
      actorUserId: guard.ctx.user.id,
      actorClerkId: guard.ctx.clerkId,
      actorRole: guard.ctx.role,
      targetType: "donation_mission",
      targetId: row.id,
      context: contextFromRequest(request),
      metadata: { slug: row.slug, published: row.published },
    });
    return Response.json({ ok: true, mission: row });
  } catch {
    return Response.json(
      { error: "invalid_input", message: "Could not save that mission. The slug may already be used." },
      { status: 400 }
    );
  }
}
