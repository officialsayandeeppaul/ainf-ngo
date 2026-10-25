import { DonationStatus, Role } from "@prisma/client";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { sendDonationReceiptEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/env";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Emails one received gift's receipt again (for example after a bounce or a sandbox-only mailer). */
export async function POST(request: Request, ctx: Ctx) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;

  const gift = await db.donation.findUnique({ where: { id } });
  if (!gift) return Response.json({ error: "not_found", message: "Gift not found." }, { status: 404 });
  if (gift.status !== DonationStatus.PAID) {
    return Response.json({ error: "not_paid", message: "Only a received gift has a receipt." }, { status: 409 });
  }

  const result = await sendDonationReceiptEmail({
    to: gift.donorEmail,
    name: gift.donorName,
    amountPaise: gift.amountPaise,
    targetTitle: gift.targetTitle,
    receiptUrl: absoluteUrl(`/donate/receipt/${gift.receiptToken}`),
  });
  if (result.sent) {
    await db.donation.update({ where: { id: gift.id }, data: { receiptEmailedAt: new Date() } });
  }

  await recordAudit({
    action: AuditAction.DonationReceiptSent,
    actorUserId: guard.ctx.user.id,
    actorClerkId: guard.ctx.clerkId,
    actorRole: guard.ctx.role,
    targetType: "donation",
    targetId: gift.id,
    success: result.sent,
    context: contextFromRequest(request),
    metadata: { sent: result.sent, error: result.sent ? null : (result.error ?? null) },
  });

  if (!result.sent) {
    return Response.json(
      { error: "not_sent", message: result.error ?? "The receipt email could not be sent." },
      { status: 502 }
    );
  }
  return Response.json({ ok: true });
}
