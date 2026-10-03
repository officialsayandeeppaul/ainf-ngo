import { ContactMessageStatus, Role } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { isResendConfigured } from "@/lib/env";
import { sendContactReplyEmail } from "@/lib/email";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("markReviewed"),
  }),
  z.object({
    action: z.literal("archive"),
  }),
  z.object({
    action: z.literal("reopen"),
  }),
  z.object({
    action: z.literal("reply"),
    body: z.string().trim().min(5).max(6000),
    sendEmail: z.boolean().default(true),
  }),
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;

  const { ctx } = guard;
  const context = contextFromRequest(request);
  const { id } = await params;

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError ? (error.issues[0]?.message ?? "Invalid request.") : "Invalid request.";
    return Response.json({ error: "invalid_input", message }, { status: 400 });
  }

  const row = await db.contactMessage.findUnique({ where: { id } });
  if (!row) {
    return Response.json({ error: "not_found", message: "Message not found." }, { status: 404 });
  }

  if (input.action === "markReviewed") {
    const updated = await db.contactMessage.update({
      where: { id },
      data: {
        status: row.status === ContactMessageStatus.REPLIED ? row.status : ContactMessageStatus.REVIEWED,
        reviewedAt: row.reviewedAt ?? new Date(),
        reviewedByUserId: row.reviewedByUserId ?? ctx.user.id,
      },
    });
    await recordAudit({
      action: AuditAction.ContactMessageReviewed,
      actorUserId: ctx.user.id,
      actorClerkId: ctx.clerkId,
      actorRole: ctx.role,
      targetType: "contact_message",
      targetId: id,
      context,
      metadata: { status: updated.status },
    });
    return Response.json({ ok: true, message: updated });
  }

  if (input.action === "archive") {
    const updated = await db.contactMessage.update({
      where: { id },
      data: { status: ContactMessageStatus.ARCHIVED },
    });
    await recordAudit({
      action: AuditAction.ContactMessageArchived,
      actorUserId: ctx.user.id,
      actorClerkId: ctx.clerkId,
      actorRole: ctx.role,
      targetType: "contact_message",
      targetId: id,
      context,
      metadata: { fromStatus: row.status },
    });
    return Response.json({ ok: true, message: updated });
  }

  if (input.action === "reopen") {
    const updated = await db.contactMessage.update({
      where: { id },
      data: { status: ContactMessageStatus.NEW },
    });
    await recordAudit({
      action: AuditAction.ContactMessageReopened,
      actorUserId: ctx.user.id,
      actorClerkId: ctx.clerkId,
      actorRole: ctx.role,
      targetType: "contact_message",
      targetId: id,
      context,
      metadata: { fromStatus: row.status },
    });
    return Response.json({ ok: true, message: updated });
  }

  // reply
  if (input.sendEmail && !isResendConfigured) {
    return Response.json(
      {
        error: "email_not_configured",
        message: "Resend is not configured. Save the reply without email, or set RESEND_API_KEY.",
      },
      { status: 503 }
    );
  }

  let emailId: string | undefined;
  let emailed = false;
  let emailWarning: string | null = null;

  if (input.sendEmail) {
    const delivered = await sendContactReplyEmail({
      to: row.email,
      name: row.name,
      originalMessage: row.body,
      replyBody: input.body,
    });
    if (delivered.sent) {
      emailed = true;
      emailId = delivered.id;
    } else if (delivered.code === "sandbox_recipient") {
      // Still save the reply so admin workflow is not blocked by Resend test limits.
      emailWarning =
        delivered.error ??
        "Reply saved in the inbox. Email was not sent — Resend test mode only delivers to your account address (verify a domain to email anyone).";
    } else {
      return Response.json(
        {
          error: "email_failed",
          message: delivered.error ?? "Could not send the reply email.",
        },
        { status: 502 }
      );
    }
  }

  const updated = await db.contactMessage.update({
    where: { id },
    data: {
      status: ContactMessageStatus.REPLIED,
      replyBody: input.body,
      replySentEmail: emailed,
      replyEmailId: emailId ?? null,
      repliedAt: new Date(),
      repliedByUserId: ctx.user.id,
      reviewedAt: row.reviewedAt ?? new Date(),
      reviewedByUserId: row.reviewedByUserId ?? ctx.user.id,
    },
  });

  await recordAudit({
    action: AuditAction.ContactMessageReplied,
    actorUserId: ctx.user.id,
    actorClerkId: ctx.clerkId,
    actorRole: ctx.role,
    targetType: "contact_message",
    targetId: id,
    context,
    metadata: {
      sendEmail: input.sendEmail,
      emailed,
      emailId: emailId ?? null,
      emailWarning: emailWarning ?? null,
    },
  });

  return Response.json({
    ok: true,
    message: updated,
    emailed,
    warning: emailWarning,
  });
}
