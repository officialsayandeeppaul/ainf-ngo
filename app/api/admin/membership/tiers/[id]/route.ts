import { Role, YearlyDiscountKind } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { rupeesToPaise } from "@/lib/membership";
import { normalizePlanBenefits } from "@/lib/plan-benefits";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  badge: z.string().trim().min(1).max(24).optional(),
  badgeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  description: z.string().trim().max(280).optional(),
  benefits: z.array(z.object({ label: z.string(), included: z.boolean() })).max(16).optional(),
  monthlyRupees: z.number().positive().max(1_000_000).optional(),
  yearlyDiscountKind: z.nativeEnum(YearlyDiscountKind).optional(),
  yearlyDiscountValue: z.number().min(0).max(10_000_000).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let input: z.infer<typeof patchSchema>;
  try {
    input = patchSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError ? (error.issues[0]?.message ?? "Invalid plan.") : "Invalid plan.";
    return Response.json({ error: "invalid_input", message }, { status: 400 });
  }

  const existing = await db.membershipTier.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "not_found", message: "Plan not found." }, { status: 404 });
  }

  const kind = input.yearlyDiscountKind ?? existing.yearlyDiscountKind;
  const rawValue = input.yearlyDiscountValue;
  if (kind === YearlyDiscountKind.PERCENT && rawValue != null && rawValue > 90) {
    return Response.json(
      { error: "invalid_input", message: "Yearly percent discount cannot exceed 90%." },
      { status: 400 }
    );
  }

  const yearlyDiscountValue =
    rawValue == null
      ? undefined
      : kind === YearlyDiscountKind.FLAT
        ? rupeesToPaise(rawValue)
        : Math.round(rawValue);

  const tier = await db.membershipTier.update({
    where: { id },
    data: {
      name: input.name,
      badge: input.badge,
      badgeColor: input.badgeColor,
      description: input.description,
      benefits: input.benefits != null ? normalizePlanBenefits(input.benefits) : undefined,
      monthlyPaise: input.monthlyRupees != null ? rupeesToPaise(input.monthlyRupees) : undefined,
      yearlyDiscountKind: input.yearlyDiscountKind,
      yearlyDiscountValue,
      active: input.active,
      sortOrder: input.sortOrder,
    },
  });

  await recordAudit({
    action: AuditAction.MembershipTierUpdated,
    actorUserId: guard.ctx.user.id,
    actorClerkId: guard.ctx.clerkId,
    actorRole: guard.ctx.role,
    targetType: "membership_tier",
    targetId: tier.id,
    context: contextFromRequest(request),
    metadata: { name: tier.name },
  });

  return Response.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const existing = await db.membershipTier.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "not_found", message: "Plan not found." }, { status: 404 });
  }

  await db.membershipTier.delete({ where: { id } });
  await recordAudit({
    action: AuditAction.MembershipTierDeleted,
    actorUserId: guard.ctx.user.id,
    actorClerkId: guard.ctx.clerkId,
    actorRole: guard.ctx.role,
    targetType: "membership_tier",
    targetId: id,
    context: contextFromRequest(request),
    metadata: { name: existing.name },
  });

  return Response.json({ ok: true });
}
