import type { Metadata } from "next";
import { requirePageAuth } from "@/lib/auth/guard";
import { isMobileAccountEmail } from "@/lib/account-contact";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { loadMemberInbox, markMemberMessagesRead } from "@/lib/member-inbox";
import { indianMobile } from "@/lib/mobile-auth";
import { DashShell } from "@/components/portal/DashShell";
import { MemberInbox } from "@/components/portal/MemberInbox";
import { MemberMessageForm } from "@/components/portal/MemberMessageForm";
import { SetupNotice } from "@/components/portal/SetupNotice";

export const metadata: Metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

export default async function AccountMessagesPage() {
  if (!isClerkConfigured || !isDatabaseConfigured) {
    return (
      <SetupNotice
        feature="The portal"
        keys={["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "DATABASE_URL"]}
      />
    );
  }

  const { user, role } = await requirePageAuth("/account/messages");
  const { items, unread } = await loadMemberInbox(user);
  // Opening the inbox reads them; the "New" tags still show on this visit.
  if (unread > 0) await markMemberMessagesRead(user.id);
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return (
    <DashShell role={role} currentPath="/account/messages" verifiedByAdmin={Boolean(user.identityVerifiedByAdminAt)}>
      <main className="pt-main">
        <h1 className="pt-title">Messages</h1>
        <p className="pt-subtitle">
          Write to the AINF team here. Their replies, and any message they send you, appear below.
        </p>

        <div className="pt-grid pt-grid--2 pt-inbox-layout">
          <section className="pt-card">
            <h2 className="pt-section-title">Write to AINF</h2>
            <MemberMessageForm
              name={name}
              email={isMobileAccountEmail(user.email) ? "" : user.email}
              phone={(user.phone && indianMobile(user.phone)) || ""}
            />
          </section>
          <section className="pt-card">
            <h2 className="pt-section-title">
              Your inbox{unread > 0 ? ` · ${unread} new` : ""}
            </h2>
            <MemberInbox items={items} emptyHint="No messages yet. Anything you send, and every reply, shows here." />
          </section>
        </div>
      </main>
    </DashShell>
  );
}
