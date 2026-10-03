import type { Metadata } from "next";
import Link from "next/link";
import { DonationStatus } from "@prisma/client";
import { requirePageAuth } from "@/lib/auth/guard";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { DashShell } from "@/components/portal/DashShell";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { formatDay } from "@/lib/format-date";
import { formatInr } from "@/lib/membership";
import { getUserGiving } from "@/lib/user-donations";

export const metadata: Metadata = { title: "Your giving" };
export const dynamic = "force-dynamic";

function statusBadge(status: DonationStatus) {
  if (status === DonationStatus.REFUNDED) {
    return { className: "pt-badge pt-badge--warning", label: "Returned" };
  }
  return { className: "pt-badge pt-badge--success", label: "Received" };
}

export default async function AccountDonationsPage() {
  if (!isClerkConfigured || !isDatabaseConfigured) {
    return (
      <SetupNotice
        feature="The portal"
        keys={["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "DATABASE_URL"]}
      />
    );
  }

  const { user, role } = await requirePageAuth("/account/donations");
  const { donations, summary } = await getUserGiving(user.email);

  return (
    <DashShell role={role} currentPath="/account/donations">
      <main className="pt-main">
        <h1 className="pt-title">Your giving</h1>
        <p className="pt-subtitle">
          Every gift made with <strong>{user.email}</strong>. Open a receipt to view or print it.
          Membership plans are on the{" "}
          <Link href="/account/membership" className="pt-link">Your plan</Link> page.
        </p>

        <div className="pt-grid pt-grid--3" style={{ marginBottom: 22 }}>
          <div className="pt-stat">
            <p className="pt-stat__label">Total given</p>
            <p className="pt-stat__value">{formatInr(summary.totalPaise)}</p>
          </div>
          <div className="pt-stat">
            <p className="pt-stat__label">Gifts</p>
            <p className="pt-stat__value">{summary.giftCount}</p>
          </div>
          <div className="pt-stat">
            <p className="pt-stat__label">This year</p>
            <p className="pt-stat__value">{formatInr(summary.thisYearPaise)}</p>
          </div>
        </div>

        <section className="pt-card">
          <h2 className="pt-section-title">Gift history</h2>
          {donations.length === 0 ? (
            <p className="pt-empty">
              No gifts yet under this email.{" "}
              <Link href="/donate-now" className="pt-link">Make your first gift</Link> to support a cause.
            </p>
          ) : (
            <div className="pt-table-wrap">
              <table className="pt-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Cause</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {donations.map((gift) => {
                    const badge = statusBadge(gift.status);
                    return (
                      <tr key={gift.id}>
                        <td>{formatDay(gift.at)}</td>
                        <td>{gift.targetTitle}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {formatInr(gift.amountPaise)}
                        </td>
                        <td>
                          <span className={badge.className}>
                            <span className="pt-badge__dot" aria-hidden="true" />
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <a
                            href={`/donate/receipt/${gift.receiptToken}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pt-link"
                          >
                            Open
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {summary.refundedCount > 0 ? (
            <p className="pt-hint" style={{ marginTop: 14 }}>
              {summary.refundedCount} gift{summary.refundedCount === 1 ? "" : "s"} totalling{" "}
              {formatInr(summary.refundedPaise)} {summary.refundedCount === 1 ? "was" : "were"}{" "}
              returned and {summary.refundedCount === 1 ? "is" : "are"} not counted in your total.
            </p>
          ) : null}
        </section>
      </main>
    </DashShell>
  );
}
