import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { claimMobilePassword, completeMobileRegistration, e164India, indianMobile, mobileAccountEmail, passwordOk } from "@/lib/mobile-auth";
import { ensureMobileUser, findMobileAccount } from "@/lib/mobile-user";
import { checkRateLimit, rateLimitResponse } from "@/lib/ratelimit";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clerkErrorText(error: unknown): string {
  if (error && typeof error === "object" && "errors" in error) {
    const errors = (error as { errors?: { code?: string; message?: string; longMessage?: string }[] }).errors ?? [];
    return errors.map((item) => [item.code, item.longMessage, item.message].filter(Boolean).join(" ")).join("; ");
  }
  return error instanceof Error ? error.message : "";
}

const schema = z.object({
  phone: z.string().trim().min(10).max(16),
  setupToken: z.string().trim().min(20).max(80),
  password: z.string().min(8).max(72),
});

export async function POST(request: Request) {
  if (!isClerkConfigured || !isDatabaseConfigured) {
    return Response.json({ error: "not_configured", message: "Mobile registration is not available." }, { status: 503 });
  }

  const context = contextFromRequest(request);
  const limit = await checkRateLimit("auth", `mobile-password:${context.ip}`);
  if (!limit.success) return rateLimitResponse(limit, "auth");

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_input", message: "Set a password after the code is accepted." }, { status: 400 });
  }

  const phone = indianMobile(input.phone);
  if (!phone || !passwordOk(input.password)) {
    return Response.json(
      { error: "invalid_input", message: "Use at least 8 characters, with a letter and a number." },
      { status: 400 }
    );
  }

  const claimed = await claimMobilePassword(phone, input.setupToken);
  if (!claimed.ok) {
    const existing = await findMobileAccount(phone);
    if (existing) {
      return Response.json(
        { error: "taken", message: "That mobile number already has an account. Sign in with this number and password." },
        { status: 409 }
      );
    }
    return Response.json(
      { error: claimed.reason, message: "Confirm the text code before setting a password." },
      { status: 403 }
    );
  }

  const already = await findMobileAccount(phone);
  if (already) {
    await completeMobileRegistration(phone);
    return Response.json(
      { error: "taken", message: "That mobile number already has an account. Sign in instead." },
      { status: 409 }
    );
  }

  const client = await clerkClient();
  let clerkId: string;
  try {
    const created = await client.users.createUser({
      emailAddress: [mobileAccountEmail(phone)],
      username: `m${phone}`,
      password: input.password,
      skipPasswordChecks: true,
      firstName: claimed.firstName ?? undefined,
      publicMetadata: { phone: e164India(phone), auth: "mobile" },
    });
    clerkId = created.id;
  } catch (error) {
    const clerkMessage = clerkErrorText(error);
    const taken = /form_identifier_exists|already|exists|taken|identifier/i.test(clerkMessage);
    if (taken) await completeMobileRegistration(phone);
    else console.error("[mobile-register] account create failed", clerkMessage);
    return Response.json(
      {
        error: taken ? "taken" : "clerk_failed",
        message: taken
          ? "That mobile number already has an account. Sign in instead."
          : "The account could not be created. Try the password again.",
      },
      { status: taken ? 409 : 502 }
    );
  }

  await completeMobileRegistration(phone);
  await ensureMobileUser({ clerkId, phone10: phone, firstName: claimed.firstName });
  const ticket = await client.signInTokens.createSignInToken({ userId: clerkId, expiresInSeconds: 120 });

  await recordAudit({
    action: AuditAction.UserCreated,
    actorClerkId: clerkId,
    targetType: "user",
    targetId: clerkId,
    context,
    metadata: { source: "mobile_register", phoneLast4: phone.slice(-4) },
  });

  return Response.json({ ok: true, ticket: ticket.token });
}
