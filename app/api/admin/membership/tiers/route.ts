import { Role, YearlyDiscountKind } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { slugifyTierName, rupeesToPaise } from "@/lib/membership";
import { normalizePlanBenefits } from "@/lib/plan-benefits";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  badge: z.string().trim().min(1).max(24),
  badgeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  description: z.string().trim().max(280).default(""),
  benefits: z
    .array(z.object({ label: z.string(), included: z.boolean() }))
    .max(16)
    .optional(),
  monthlyRupees: z.number().positive().max(1_000_000),
  yearlyDiscountKind: z.nativeEnum(YearlyDiscountKind),
  yearlyDiscountValue: z.number().min(0).max(10_000_000),
  active: z.boolean().default(true),
});

async function uniqueSlug(base: string) {
  let slug = slugifyTierName(base);
  for (let i = 2; i < 50; i += 1) {
    const taken = await db.membershipTier.findUnique({ where: { slug } });
    if (!taken) return slug;
    slug = `${slugifyTierName(base)}-${i}`;
  }
  return `${slugifyTierName(base)}-${Date.now()}`;
}

export async function POST(request: Request) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;

  let input: z.infer<typeof createSchema>;
  try {
    input = createSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError ? (error.issues[0]?.message ?? "Invalid plan.") : "Invalid plan.";
    return Response.json({ error: "invalid_input", message }, { status: 400 });
  }

  if (input.yearlyDiscountKind === YearlyDiscountKind.PERCENT && input.yearlyDiscountValue > 90) {
    return Response.json(
      { error: "invalid_input", message: "Yearly percent discount cannot exceed 90%." },
      { status: 400 }
    );
  }

  const last = await db.membershipTier.findFirst({ orderBy: { sortOrder: "desc" } });
  const tier = await db.membershipTier.create({
    data: {
      slug: await uniqueSlug(input.name),
      name: input.name,
      badge: input.badge,
      badgeColor: input.badgeColor,
      description: input.description,
      benefits: normalizePlanBenefits(input.benefits),
      monthlyPaise: rupeesToPaise(input.monthlyRupees),
      yearlyDiscountKind: input.yearlyDiscountKind,
      yearlyDiscountValue:
        input.yearlyDiscountKind === YearlyDiscountKind.FLAT
          ? rupeesToPaise(input.yearlyDiscountValue)
          : Math.round(input.yearlyDiscountValue),
      active: input.active,
      sortOrder: (last?.sortOrder ?? 0) + 10,
    },
  });

  await recordAudit({
    action: AuditAction.MembershipTierCreated,
    actorUserId: guard.ctx.user.id,
    actorClerkId: guard.ctx.clerkId,
    actorRole: guard.ctx.role,
    targetType: "membership_tier",
    targetId: tier.id,
    context: contextFromRequest(request),
    metadata: { name: tier.name, monthlyPaise: tier.monthlyPaise },
  });

  return Response.json({ ok: true, id: tier.id });
}
