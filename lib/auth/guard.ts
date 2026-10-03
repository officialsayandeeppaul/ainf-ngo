import { redirect } from "next/navigation";
import { Role, UserStatus } from "@prisma/client";
import { isClerkConfigured, isDatabaseConfigured } from "../env";
import { AuditAction, recordAudit } from "../audit";
import { requestContext } from "../request-context";
import { checkRateLimit, rateLimitResponse, type LimiterName } from "../ratelimit";
import { getAuthContext, type AuthContext } from "./session";
import { hasRole } from "./roles";

/**
 * Access guards.
 *
 * Every guard re-reads Postgres through getAuthContext rather than trusting the
 * Clerk metadata mirror, so a stale or tampered session claim cannot escalate
 * privileges. Denials are audited.
 */

export class SuspendedAccountError extends Error {
  constructor() {
    super("Account suspended");
    this.name = "SuspendedAccountError";
  }
}

async function auditDenial(required: Role, ctx: AuthContext | null, reason: string) {
  await recordAudit({
    action: AuditAction.AccessDenied,
    actorUserId: ctx?.user.id ?? null,
    actorClerkId: ctx?.clerkId ?? null,
    actorRole: ctx?.role ?? null,
    success: false,
    context: await requestContext(),
    metadata: { required, actual: ctx?.role ?? "anonymous", reason },
  });
}

// ---------------------------------------------------------------------------
// Server components / pages
// ---------------------------------------------------------------------------

/** Requires a signed-in, non-suspended user. Redirects to sign-in otherwise. */
export async function requirePageAuth(returnTo = "/account"): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
  }
  if (ctx.user.status !== UserStatus.ACTIVE) {
    redirect("/account/suspended");
  }
  return ctx;
}

/** Requires at least `required`. Sends insufficient roles somewhere useful. */
export async function requirePageRole(required: Role, returnTo = "/account"): Promise<AuthContext> {
  const ctx = await requirePageAuth(returnTo);
  if (!hasRole(ctx.role, required)) {
    await auditDenial(required, ctx, "page");
    redirect(required === Role.VERIFIED_USER ? "/account/verify" : "/account");
  }
  return ctx;
}

export const requirePageSuperAdmin = (returnTo = "/admin") =>
  requirePageRole(Role.SUPER_ADMIN, returnTo);

// ---------------------------------------------------------------------------
// Route handlers / server actions
// ---------------------------------------------------------------------------

export type ApiGuardFailure = { ok: false; response: Response };
export type ApiGuardSuccess = { ok: true; ctx: AuthContext };
export type ApiGuardResult = ApiGuardSuccess | ApiGuardFailure;

function jsonError(status: number, error: string, message: string): Response {
  return Response.json({ error, message }, { status });
}

/**
 * Authenticates an API caller, enforces role, and consumes a rate-limit unit
 * keyed by user id. Returns a ready-to-send Response on any failure.
 */
export async function guardApi(options: {
  required?: Role;
  limiter?: LimiterName;
}): Promise<ApiGuardResult> {
  const { required = Role.USER, limiter } = options;

  // An unconfigured install is a server-side gap, not a client error: say so
  // with 503 rather than letting the Clerk SDK surface an opaque 500.
  if (!isClerkConfigured || !isDatabaseConfigured) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "not_configured",
          message: "This endpoint is not configured yet.",
          keys: [
            ...(isClerkConfigured ? [] : ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]),
            ...(isDatabaseConfigured ? [] : ["DATABASE_URL"]),
          ],
        },
        { status: 503 }
      ),
    };
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    return { ok: false, response: jsonError(401, "unauthenticated", "Sign in to continue.") };
  }

  if (ctx.user.status !== UserStatus.ACTIVE) {
    await auditDenial(required, ctx, "suspended");
    return {
      ok: false,
      response: jsonError(403, "account_suspended", "This account is suspended."),
    };
  }

  if (!hasRole(ctx.role, required)) {
    await auditDenial(required, ctx, "api");
    return {
      ok: false,
      response: jsonError(403, "forbidden", "You do not have access to this resource."),
    };
  }

  if (limiter) {
    const result = await checkRateLimit(limiter, ctx.user.id);
    if (!result.success) {
      await recordAudit({
        action: AuditAction.RateLimited,
        actorUserId: ctx.user.id,
        actorClerkId: ctx.clerkId,
        actorRole: ctx.role,
        success: false,
        context: await requestContext(),
        metadata: { limiter, degraded: result.degraded },
      });
      return { ok: false, response: rateLimitResponse(result, limiter) };
    }
  }

  return { ok: true, ctx };
}
