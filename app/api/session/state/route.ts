import { getClerkUserId, getAuthContext } from "@/lib/auth/session";
import { identityReadyForMembership } from "@/lib/donation-rules";
import { getVerificationPolicy } from "@/lib/verification-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public pages ask only whether a session exists, and whether identity is ready for a plan. */
export async function GET() {
  const clerkId = await getClerkUserId();
  if (!clerkId) {
    return Response.json({ signedIn: false, identityReady: false }, { headers: { "cache-control": "no-store" } });
  }
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ signedIn: true, identityReady: false }, { headers: { "cache-control": "no-store" } });
  }
  const name = [ctx.user.firstName, ctx.user.lastName].filter(Boolean).join(" ").trim();
  const email = ctx.user.email.endsWith("@mobile.theainf.in") ? "" : ctx.user.email;
  const phone = localPhone(ctx.user.phone);
  return Response.json(
    {
      signedIn: true,
      identityReady: identityReadyForMembership(ctx.user, getVerificationPolicy()),
      giver: {
        name,
        email,
        phone,
        imageUrl: safeImage(ctx.user.imageUrl),
      },
    },
    { headers: { "cache-control": "no-store" } }
  );
}

function safeImage(url: string | null | undefined): string {
  if (!url || !url.startsWith("https://")) return "";
  return url;
}

function localPhone(stored: string | null): string {
  if (!stored) return "";
  const digits = stored.replace(/[^\d]/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 10) return digits;
  return stored;
}
