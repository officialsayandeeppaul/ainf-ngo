import type { Metadata } from "next";
import { UserStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { recordSuspensionSeen } from "@/lib/auth/role-service";
import { displayPhone, isMobileAccountEmail } from "@/lib/account-contact";
import { requestContext } from "@/lib/request-context";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { DashShell } from "@/components/portal/DashShell";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { formatDayTime } from "@/lib/format-date";
import { loadMemberInbox, markMemberMessagesRead } from "@/lib/member-inbox";
import { indianMobile } from "@/lib/mobile-auth";
import { MemberInbox } from "@/components/portal/MemberInbox";
import { MemberMessageForm } from "@/components/portal/MemberMessageForm";

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

  // Lets the admin see "Seen at sign-in" when nobody could message them.
  await recordSuspensionSeen({ user: ctx.user, context: await requestContext() }).catch(() => false);

  // Messages from AINF reach suspended members here, since the rest of the dashboard is closed.
  const inbox = await loadMemberInbox(ctx.user).catch(() => ({ items: [], unread: 0 }));
  if (inbox.unread > 0) await markMemberMessagesRead(ctx.user.id).catch(() => undefined);
  const memberName = [ctx.user.firstName, ctx.user.lastName].filter(Boolean).join(" ");

  const banned = ctx.user.status === UserStatus.BANNED;
  const until = banned ? null : ctx.user.suspendedUntil;
  const contactLine = isMobileAccountEmail(ctx.user.email)
    ? `the mobile number on this account${ctx.user.phone ? ` (${displayPhone(ctx.user.phone)})` : ""}`
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
            <a href="#ainf-messages" className="pt-btn pt-btn--primary">
              Message AINF
            </a>
            <a href="/" className="pt-btn pt-btn--ghost">
              Back to site
            </a>
          </div>
        </div>

        <section className="pt-card" id="ainf-messages" style={{ marginTop: 18 }}>
          <h2 className="pt-section-title">
            Messages from AINF{inbox.unread > 0 ? ` · ${inbox.unread} new` : ""}
          </h2>
          <MemberInbox
            items={inbox.items}
            emptyHint="No messages yet. When the AINF team writes to you, or replies to you, it shows here."
          />
        </section>

        <section className="pt-card" style={{ marginTop: 18 }}>
          <h2 className="pt-section-title">Write to AINF</h2>
          <MemberMessageForm
            name={memberName}
            email={isMobileAccountEmail(ctx.user.email) ? "" : ctx.user.email}
            phone={(ctx.user.phone && indianMobile(ctx.user.phone)) || ""}
          />
        </section>
      </main>
    </DashShell>
  );
}
