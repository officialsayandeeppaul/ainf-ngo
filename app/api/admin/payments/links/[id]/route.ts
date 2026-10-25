import { Role } from "@prisma/client";
import { z } from "zod";
import { guardApi } from "@/lib/auth/guard";
import { isRazorpayConfigured } from "@/lib/env";
import { cancelPaymentLink, resendPaymentLink, syncPaymentLink } from "@/lib/payment-links";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ action: z.enum(["sync", "cancel", "resend"]) });

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
  } catch {
    return Response.json({ error: "invalid_input", message: "Choose sync, cancel, or resend." }, { status: 400 });
  }

  const actor = { userId: guard.ctx.user.id, clerkId: guard.ctx.clerkId, role: guard.ctx.role };
  const context = contextFromRequest(request);

  try {
    if (input.action === "sync") {
      const result = await syncPaymentLink(id, context);
      if (!result.ok) return Response.json({ error: "rejected", message: result.message }, { status: result.status });
      return Response.json({ ok: true, status: result.link.status, changed: result.changed });
    }
    if (input.action === "cancel") {
      const result = await cancelPaymentLink(id, actor, context);
      if (!result.ok) return Response.json({ error: "rejected", message: result.message }, { status: result.status });
      return Response.json({ ok: true, status: result.link.status });
    }
    const result = await resendPaymentLink(id, actor, context);
    if (!result.ok) return Response.json({ error: "rejected", message: result.message }, { status: result.status });
    return Response.json({
      ok: true,
      status: result.link.status,
      emailed: result.email.sent,
      emailError: result.email.sent ? null : (result.email.error ?? null),
      sms: result.sms,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Razorpay did not answer.";
    return Response.json({ error: "razorpay_failed", message }, { status: 502 });
  }
}
