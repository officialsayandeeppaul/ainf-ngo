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
  name: z.string().trim().min(2).max(80).optional(),
  kind: z.nativeEnum(OfferKind).optional(),
  value: z.number().min(0).max(10_000_000).optional(),
  interval: z.nativeEnum(BillingInterval).nullable().optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  active: z.boolean().optional(),
  firstCycleOnly: z.boolean().optional(),
  tierIds: z.array(z.string().min(1)).min(1).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_input", message: "Invalid offer." }, { status: 400 });
  }

  const existing = await db.membershipOffer.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "not_found", message: "Offer not found." }, { status: 404 });
  }

  const kind = input.kind ?? existing.kind;
  let value = existing.value;
  if (input.value != null) {
    value = kind === OfferKind.PERCENT ? Math.min(90, Math.round(input.value)) : rupeesToPaise(input.value);
  }

  if (input.tierIds) {
    const tiers = await db.membershipTier.findMany({
      where: { id: { in: input.tierIds } },
      select: { id: true },
    });
    if (tiers.length !== input.tierIds.length) {
      return Response.json({ error: "not_found", message: "One of those plans no longer exists." }, { status: 404 });
    }
    await db.membershipOfferOnTier.deleteMany({ where: { offerId: id } });
    await db.membershipOfferOnTier.createMany({
      data: input.tierIds.map((tierId) => ({ offerId: id, tierId })),
    });
  }

  await db.membershipOffer.update({
    where: { id },
    data: {
      name: input.name,
      kind,
      value,
      interval: input.interval === undefined ? undefined : input.interval,
      startsAt: input.startsAt === undefined ? undefined : input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt === undefined ? undefined : input.endsAt ? new Date(input.endsAt) : null,
      active: input.active,
      firstCycleOnly: input.firstCycleOnly,
    },
  });

  await recordAudit({
    action: AuditAction.MembershipOfferUpdated,
    actorUserId: guard.ctx.user.id,
    actorClerkId: guard.ctx.clerkId,
    actorRole: guard.ctx.role,
    targetType: "membership_offer",
    targetId: id,
    context: contextFromRequest(request),
  });

  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const existing = await db.membershipOffer.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "not_found", message: "Offer not found." }, { status: 404 });
  }
  await db.membershipOffer.delete({ where: { id } });
  await recordAudit({
    action: AuditAction.MembershipOfferDeleted,
    actorUserId: guard.ctx.user.id,
    actorClerkId: guard.ctx.clerkId,
    actorRole: guard.ctx.role,
    targetType: "membership_offer",
    targetId: id,
  });
  return Response.json({ ok: true });
}
