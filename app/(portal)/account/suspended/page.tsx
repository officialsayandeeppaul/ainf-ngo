import type { Metadata } from "next";
import Link from "next/link";
import { UserStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { DashShell } from "@/components/portal/DashShell";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { formatDayTime } from "@/lib/format-date";

export const metadata: Metadata = { title: "Account suspended" };
export const dynamic = "force-dynamic";

export default async function SuspendedPage() {
  if (!isClerkConfigured || !isDatabaseConfigured) {
    return (
      <SetupNotice
        feature="The portal"
        keys={["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "DATABASE_URL"]}
      />
    );
  }

  const ctx = await getAuthContext();
  if (!ctx) redirect("/sign-in");
  // Reinstated users should not be able to sit on this page.
  if (ctx.user.status === UserStatus.ACTIVE) redirect("/account");

  const banned = ctx.user.status === UserStatus.BANNED;

  return (
    <DashShell role={null}>
      <main className="pt-main pt-main--narrow">
        <h1 className="pt-title">{banned ? "Account closed" : "Account suspended"}</h1>
        <p className="pt-subtitle">
          {banned
            ? "This account has been closed and cannot be used to access member services."
            : "Access to member services is paused on this account."}
        </p>
        <div className="pt-card">
          {ctx.user.suspendedReason ? (
            <>
              <p className="pt-eyebrow">Reason given</p>
              <p style={{ margin: "0 0 18px", fontSize: 14 }}>{ctx.user.suspendedReason}</p>
            </>
          ) : null}
          {ctx.user.suspendedAt ? (
            <p className="pt-hint" style={{ marginTop: 0 }}>
              Since{" "}
              {formatDayTime(ctx.user.suspendedAt)}
            </p>
          ) : null}
          <hr className="pt-divider" />
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
            If you believe this is a mistake, please get in touch and quote the email address on
            this account.
          </p>
          <div className="pt-btn-row" style={{ marginTop: 18 }}>
            <Link href="/contact-us" className="pt-btn pt-btn--primary">
              Contact us
            </Link>
            <Link href="/" className="pt-btn pt-btn--ghost">
              Back to site
            </Link>
          </div>
        </div>
      </main>
    </DashShell>
  );
}
