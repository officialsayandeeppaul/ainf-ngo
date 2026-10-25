import { Role } from "@prisma/client";
import { z } from "zod";
import { guardApi } from "@/lib/auth/guard";
import { removeIdentityOverride, verifyIdentityByAdmin } from "@/lib/identity-override";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("verify"),
    note: z.string().trim().max(500).optional(),
    notify: z.boolean().default(true),
  }),
  z.object({ action: z.literal("remove") }),
]);

/** Marks a member's identity verified without Didit, PAN, or OTP — or takes that back. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_input", message: "Choose verify or remove." }, { status: 400 });
  }

  const actor = { userId: guard.ctx.user.id, clerkId: guard.ctx.clerkId, role: guard.ctx.role };
  const context = contextFromRequest(request);

  if (input.action === "verify") {
    const result = await verifyIdentityByAdmin({ userId: id, note: input.note, notify: input.notify, actor, context });
    if (!result.ok) return Response.json({ error: "rejected", message: result.message }, { status: result.status });
    return Response.json({ ok: true, role: result.user.role });
  }

  const result = await removeIdentityOverride({ userId: id, actor, context });
  if (!result.ok) return Response.json({ error: "rejected", message: result.message }, { status: result.status });
  return Response.json({ ok: true, role: result.user.role, stillVerified: result.stillVerified });
}
