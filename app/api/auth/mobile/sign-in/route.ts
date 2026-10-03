import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { indianMobile } from "@/lib/mobile-auth";
import { ensureMobileUser, findMobileAccount } from "@/lib/mobile-user";
import { checkRateLimit, rateLimitResponse } from "@/lib/ratelimit";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().trim().min(10).max(16),
  password: z.string().min(1).max(72),
});

export async function POST(request: Request) {
  if (!isClerkConfigured || !isDatabaseConfigured) {
    return Response.json({ error: "not_configured", message: "Mobile sign-in is not available." }, { status: 503 });
  }

  const context = contextFromRequest(request);
  const limit = await checkRateLimit("auth", `mobile-sign:${context.ip}`);
  if (!limit.success) return rateLimitResponse(limit, "auth");

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_input", message: "Enter your mobile number and password." }, { status: 400 });
  }

  const phone = indianMobile(input.phone);
  if (!phone) {
    return Response.json({ error: "invalid", message: "Mobile number or password is wrong." }, { status: 401 });
  }

  const account = await findMobileAccount(phone);
  if (!account) {
    return Response.json({ error: "invalid", message: "Mobile number or password is wrong." }, { status: 401 });
  }

  const client = await clerkClient();
  try {
    const checked = await client.users.verifyPassword({ userId: account.clerkId, password: input.password });
    if (!checked.verified) {
      return Response.json({ error: "invalid", message: "Mobile number or password is wrong." }, { status: 401 });
    }
  } catch {
    return Response.json({ error: "invalid", message: "Mobile number or password is wrong." }, { status: 401 });
  }

  await ensureMobileUser({
    clerkId: account.clerkId,
    phone10: phone,
    firstName: account.firstName,
  });
  const ticket = await client.signInTokens.createSignInToken({ userId: account.clerkId, expiresInSeconds: 120 });

  await recordAudit({
    action: AuditAction.UserUpdated,
    actorClerkId: account.clerkId,
    targetType: "user",
    targetId: account.clerkId,
    context,
    metadata: { source: "mobile_sign_in", phoneLast4: phone.slice(-4) },
  });

  return Response.json({ ok: true, ticket: ticket.token });
}
