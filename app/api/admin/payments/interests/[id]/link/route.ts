import { Role } from "@prisma/client";
import { z } from "zod";
import { guardApi } from "@/lib/auth/guard";
import { isRazorpayConfigured } from "@/lib/env";
import { createLinkForInterest, LINK_EXPIRY_DAYS } from "@/lib/payment-links";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  amountPaise: z.number().int().positive(),
  expiresInDays: z
    .number()
    .int()
    .refine((value) => (LINK_EXPIRY_DAYS as readonly number[]).includes(value), "Pick a link lifetime."),
  notifySms: z.boolean().default(true),
  notifyEmail: z.boolean().default(false),
  sendAinfEmail: z.boolean().default(true),
});

/** Sends a Razorpay payment link for one interest. Works while self-serve payments are paused. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;
  if (!isRazorpayConfigured) {
    return Response.json({ error: "not_configured", message: "Razorpay keys are not set." }, { status: 503 });
  }
  const { id } = await params;

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? (error.issues[0]?.message ?? "Invalid input.") : "Invalid input.";
    return Response.json({ error: "invalid_input", message }, { status: 400 });
  }

  const result = await createLinkForInterest({
    interestId: id,
    ...input,
    actor: { userId: guard.ctx.user.id, clerkId: guard.ctx.clerkId, role: guard.ctx.role },
    context: contextFromRequest(request),
  });
  if (!result.ok) return Response.json({ error: "rejected", message: result.message }, { status: result.status });

  return Response.json({
    ok: true,
    link: {
      id: result.link.id,
      shortUrl: result.link.shortUrl,
      expiresAt: result.link.expiresAt?.toISOString() ?? null,
      status: result.link.status,
    },
    email: result.email
      ? { sent: result.email.sent, error: result.email.sent ? null : (result.email.error ?? null) }
      : null,
  });
}
