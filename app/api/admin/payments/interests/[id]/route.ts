import { PaymentInterestStatus, Role } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["contacted", "dismiss", "reopen", "note"]),
  note: z.string().trim().max(1000).optional(),
});

/** Queue bookkeeping for one interest. Links have their own routes. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_input", message: "Choose an action." }, { status: 400 });
  }

  const interest = await db.paymentInterest.findUnique({ where: { id } });
  if (!interest) return Response.json({ error: "not_found", message: "Interest not found." }, { status: 404 });

  if (interest.status === PaymentInterestStatus.PAID && input.action !== "note") {
    return Response.json({ error: "paid", message: "This interest is already paid." }, { status: 409 });
  }
  if (input.action === "dismiss" && interest.status === PaymentInterestStatus.LINK_SENT) {
    return Response.json(
      { error: "link_out", message: "Cancel the open payment link before dismissing this interest." },
      { status: 409 }
    );
  }

  const next =
    input.action === "contacted"
      ? PaymentInterestStatus.CONTACTED
      : input.action === "dismiss"
        ? PaymentInterestStatus.DISMISSED
        : input.action === "reopen"
          ? PaymentInterestStatus.OPEN
          : interest.status;

  const updated = await db.paymentInterest.update({
    where: { id },
    data: {
      status: next,
      ...(input.note !== undefined ? { adminNote: input.note || null } : {}),
      ...(input.action === "note" ? {} : { handledAt: new Date(), handledByUserId: guard.ctx.user.id }),
    },
  });

  await recordAudit({
    action: AuditAction.PaymentInterestUpdated,
    actorUserId: guard.ctx.user.id,
    actorClerkId: guard.ctx.clerkId,
    actorRole: guard.ctx.role,
    targetType: interest.userId ? "user" : "payment_interest",
    targetId: interest.userId ?? interest.id,
    context: contextFromRequest(request),
    metadata: { interestId: id, action: input.action, from: interest.status, to: next },
  });

  return Response.json({ ok: true, status: updated.status, adminNote: updated.adminNote });
}
