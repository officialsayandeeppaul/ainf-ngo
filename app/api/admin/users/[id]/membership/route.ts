import { Role } from "@prisma/client";
import { z } from "zod";
import { guardApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { cancelMembership } from "@/lib/membership-pay";
import { cancelRazorpaySubscription } from "@/lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  immediate: z.boolean(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_input", message: "Choose end now or at period end." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    return Response.json({ error: "not_found", message: "User not found." }, { status: 404 });
  }

  if (user.membershipSubscriptionId) {
    try {
      await cancelRazorpaySubscription(user.membershipSubscriptionId, !input.immediate);
    } catch {
      // Keep local state authoritative if Razorpay already cancelled the mandate.
    }
  }

  const result = await cancelMembership({
    userId: user.id,
    immediate: input.immediate,
    actorUserId: guard.ctx.user.id,
  });
  if (!result.ok) {
    return Response.json(
      { error: "not_active", message: "This member has no live membership." },
      { status: 409 }
    );
  }
  return Response.json({ ok: true });
}
