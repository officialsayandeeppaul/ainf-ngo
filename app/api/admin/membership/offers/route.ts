import { BillingInterval, OfferKind, Role } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { rupeesToPaise } from "@/lib/membership";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  kind: z.nativeEnum(OfferKind),
  value: z.number().min(0).max(10_000_000),
  interval: z.nativeEnum(BillingInterval).nullable().optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  active: z.boolean().default(true),
  firstCycleOnly: z.boolean().default(true),
  tierIds: z.array(z.string().min(1)).min(1),
});

function discountValue(kind: OfferKind, value: number) {
  if (kind === OfferKind.PERCENT) return Math.min(90, Math.round(value));
  return rupeesToPaise(value);
}

function parseOptionalDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError ? (error.issues[0]?.message ?? "Invalid offer.") : "Invalid offer.";
    return Response.json({ error: "invalid_input", message }, { status: 400 });
  }

  const tiers = await db.membershipTier.findMany({
    where: { id: { in: input.tierIds } },
    select: { id: true },
  });
  if (tiers.length !== input.tierIds.length) {
    return Response.json({ error: "not_found", message: "One of those plans no longer exists." }, { status: 404 });
  }

  const offer = await db.membershipOffer.create({
    data: {
      name: input.name,
      kind: input.kind,
      value: discountValue(input.kind, input.value),
      interval: input.interval ?? null,
      startsAt: parseOptionalDate(input.startsAt),
      endsAt: parseOptionalDate(input.endsAt),
      active: input.active,
      firstCycleOnly: input.firstCycleOnly,
      plans: { create: input.tierIds.map((tierId) => ({ tierId })) },
    },
  });

  await recordAudit({
    action: AuditAction.MembershipOfferCreated,
    actorUserId: guard.ctx.user.id,
    actorClerkId: guard.ctx.clerkId,
    actorRole: guard.ctx.role,
    targetType: "membership_offer",
    targetId: offer.id,
    context: contextFromRequest(request),
    metadata: { name: offer.name, tierIds: input.tierIds },
  });

  return Response.json({ ok: true, id: offer.id });
}
