import { Role } from "@prisma/client";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { refundGift } from "@/lib/donations";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const result = await refundGift(id);
  if (!result.ok) {
    return Response.json({ error: "rejected", message: result.message }, { status: result.status });
  }
  await recordAudit({
    action: AuditAction.DonationRefunded,
    actorUserId: guard.ctx.user.id,
    actorClerkId: guard.ctx.clerkId,
    actorRole: guard.ctx.role,
    targetType: "donation",
    targetId: result.donation.id,
    context: contextFromRequest(request),
    metadata: { amountPaise: result.donation.amountPaise, refundId: result.donation.razorpayRefundId },
  });
  return Response.json({ ok: true, status: result.donation.status });
}
