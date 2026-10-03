import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Clerk request proxy (Next.js 16 replacement for middleware.ts).
 *
 * The matcher below is a deliberate allow-list. The 25 Framer HTML routes are
 * force-static route handlers that gzip their own bodies; running auth
 * middleware over them would add an edge invocation per request for no benefit,
 * so they are simply never matched.
 *
 * Authentication here is a first pass only. Role enforcement lives in the page
 * and route-handler guards, which re-read Postgres — see lib/auth/guard.ts.
 */

const isProtectedRoute = createRouteMatcher([
  "/account(.*)",
  "/admin(.*)",
  "/api/kyc(.*)",
  "/api/admin(.*)",
  "/api/membership(.*)",
  "/api/me(.*)",
]);

/** Inbound webhooks authenticate themselves via HMAC and must stay public. */
const isWebhookRoute = createRouteMatcher(["/api/webhooks(.*)"]);

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

const handler = clerkMiddleware(async (auth, request) => {
  if (isWebhookRoute(request)) return;

  if (isProtectedRoute(request)) {
    await auth.protect({
      unauthenticatedUrl: new URL(
        `/sign-in?redirect_url=${encodeURIComponent(request.nextUrl.pathname)}`,
        request.url
      ).toString(),
    });
  }
});

export default function proxy(request: NextRequest, event: any) {
  // Without Clerk keys the SDK throws on construction. Returning a plain
  // pass-through keeps the static marketing site online while the portal
  // reports its own precise "not configured" error at the page level.
  if (!clerkConfigured) return NextResponse.next();
  return handler(request, event);
}

export const config = {
  matcher: [
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/account(.*)",
    "/admin(.*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
