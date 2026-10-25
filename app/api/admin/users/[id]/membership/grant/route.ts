import { Role } from "@prisma/client";
import { z } from "zod";
import { guardApi } from "@/lib/auth/guard";
import { formatDay } from "@/lib/format-date";
import { GRANT_LENGTHS, grantEndDate, grantMembership } from "@/lib/membership-grant";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  tierId: z.string().min(1),
  length: z.enum(GRANT_LENGTHS),
  until: z.string().trim().optional(),
  note: z.string().trim().max(500).optional(),
  notify: z.boolean().default(true),
});

/** Free membership on any plan, no payment and no identity check. The account must exist (signed up). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_input", message: "Choose a plan and how long." }, { status: 400 });
  }

  const endsAt = grantEndDate(input.length, new Date(), input.until);
  if (!endsAt) {
    return Response.json(
      { error: "invalid_input", message: "Pick an end date from tomorrow up to ten years ahead." },
      { status: 400 }
    );
  }

  const result = await grantMembership({
    userId: id,
    tierId: input.tierId,
    endsAt,
    note: input.note,
    notify: input.notify,
    actor: { userId: guard.ctx.user.id, clerkId: guard.ctx.clerkId, role: guard.ctx.role },
    context: contextFromRequest(request),
  });
  if (!result.ok) return Response.json({ error: "rejected", message: result.message }, { status: result.status });

  return Response.json({
    ok: true,
    expiresAt: result.expiresAt.toISOString(),
    expiresLabel: formatDay(result.expiresAt),
    cardRegNo: result.cardRegNo,
    cancelledMandate: result.cancelledMandate,
  });
}
