import { Role, YearlyDiscountKind } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { rupeesToPaise } from "@/lib/membership";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  yearlyDiscountKind: z.nativeEnum(YearlyDiscountKind),
  yearlyDiscountValue: z.number().min(0).max(10_000_000),
});

export async function PATCH(request: Request) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_input", message: "Invalid settings." }, { status: 400 });
  }

  if (input.yearlyDiscountKind === YearlyDiscountKind.PERCENT && input.yearlyDiscountValue > 90) {
    return Response.json(
      { error: "invalid_input", message: "Yearly percent discount cannot exceed 90%." },
      { status: 400 }
    );
  }

  const value =
    input.yearlyDiscountKind === YearlyDiscountKind.FLAT
      ? rupeesToPaise(input.yearlyDiscountValue)
      : Math.round(input.yearlyDiscountValue);

  await db.membershipSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      yearlyDiscountKind: input.yearlyDiscountKind,
      yearlyDiscountValue: value,
    },
    update: {
      yearlyDiscountKind: input.yearlyDiscountKind,
      yearlyDiscountValue: value,
    },
  });

  await recordAudit({
    action: AuditAction.MembershipSettingsUpdated,
    actorUserId: guard.ctx.user.id,
    actorClerkId: guard.ctx.clerkId,
    actorRole: guard.ctx.role,
    targetType: "membership_settings",
    targetId: "singleton",
    context: contextFromRequest(request),
    metadata: { yearlyDiscountKind: input.yearlyDiscountKind, yearlyDiscountValue: value },
  });

  return Response.json({ ok: true });
}
