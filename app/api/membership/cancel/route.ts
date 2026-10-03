import { z } from "zod";
import { guardApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { cancelMembership } from "@/lib/membership-pay";
import { cancelRazorpaySubscription } from "@/lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  immediate: z.boolean().default(false),
});

export async function POST(request: Request) {
  const guard = await guardApi({ limiter: "checkout" });
  if (!guard.ok) return guard.response;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_input", message: "Choose cancel now or at period end." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: guard.ctx.user.id } });
  if (user?.membershipSubscriptionId) {
    try {
      await cancelRazorpaySubscription(user.membershipSubscriptionId, !input.immediate);
    } catch {
      // Local cancel still proceeds so the badge/term rules stay consistent.
    }
  }

  const result = await cancelMembership({
    userId: guard.ctx.user.id,
    immediate: input.immediate,
    actorUserId: guard.ctx.user.id,
  });
  if (!result.ok) {
    return Response.json(
      { error: "not_active", message: "There is no active membership to cancel." },
      { status: 409 }
    );
  }
  return Response.json({ ok: true, immediate: input.immediate });
}
