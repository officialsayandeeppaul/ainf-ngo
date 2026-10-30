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

  // getAuthContext lifts a timed suspension that has run out.
  const ctx = await getAuthContext();
  if (!ctx) redirect("/sign-in");
  // Reinstated users should not be able to sit on this page.
  if (ctx.user.status === UserStatus.ACTIVE) redirect("/account");

  const banned = ctx.user.status === UserStatus.BANNED;
  const until = banned ? null : ctx.user.suspendedUntil;
  const contactLine = ctx.user.email.endsWith("@mobile.theainf.in")
    ? `the mobile number on this account${ctx.user.phone ? ` (${ctx.user.phone})` : ""}`
    : `the email address on this account (${ctx.user.email})`;

  return (
    <DashShell role={null}>
      <main className="pt-main pt-main--narrow">
        <h1 className="pt-title">{banned ? "Account closed" : "Account suspended"}</h1>
        <p className="pt-subtitle">
          {banned
            ? "This account has been closed and cannot be used to access member services."
            : until
              ? "Access to member services is paused on this account for a set time."
              : "Access to member services is paused on this account until AINF reinstates it."}
        </p>
        <div className="pt-card pt-suspended-card">
          <dl className="pt-suspended-facts">
            <div>
              <dt>Reason</dt>
              <dd>{ctx.user.suspendedReason || "No reason was recorded. Please contact us."}</dd>
            </div>
            {!banned ? (
              <div>
                <dt>How long</dt>
                <dd>
                  {until ? (
                    <>
                      Until <strong>{formatDayTime(until)}</strong> (India time). It lifts by itself then; sign
                      in again after that.
                    </>
                  ) : (
                    "Until AINF reinstates it."
                  )}
                </dd>
              </div>
            ) : null}
            {ctx.user.suspendedAt ? (
              <div>
                <dt>Since</dt>
                <dd>{formatDayTime(ctx.user.suspendedAt)}</dd>
              </div>
            ) : null}
          </dl>
          <hr className="pt-divider" />
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
            If you believe this is a mistake, write to{" "}
            <a className="pt-link" href="mailto:hello@theainf.in">
              hello@theainf.in
            </a>{" "}
            and quote {contactLine}.
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
