import { Role } from "@prisma/client";
import { z } from "zod";
import { guardApi } from "@/lib/auth/guard";
import { MEMBER_MESSAGE_MAX, sendMemberMessage } from "@/lib/member-inbox";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ body: z.string().max(MEMBER_MESSAGE_MAX + 200) });

/** Sends a message to one member's dashboard inbox. No email or SMS goes out. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_input", message: "Write a message first." }, { status: 400 });
  }

  const result = await sendMemberMessage({
    userId: id,
    body: input.body,
    actor: { userId: guard.ctx.user.id, clerkId: guard.ctx.clerkId, role: guard.ctx.role },
    context: contextFromRequest(request),
  });
  if (!result.ok) return Response.json({ error: "rejected", message: result.message }, { status: result.status });
  return Response.json({ ok: true, id: result.id, createdAt: result.createdAt.toISOString() });
}
