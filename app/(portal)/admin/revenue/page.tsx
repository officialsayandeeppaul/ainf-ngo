import type { Metadata } from "next";
import Link from "next/link";
import { DonationStatus, MembershipOrderStatus } from "@prisma/client";
import { requirePageSuperAdmin } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { formatDayTime } from "@/lib/format-date";
import { formatInr } from "@/lib/membership";
import {
  buildRevenueSnapshot,
  giftPaidWhere,
  parseRevenueDay,
  revenueKindLabel,
  revenuePaidWhere,
} from "@/lib/revenue";
import { CrmBars, CrmSpark, CrmStat } from "@/components/portal/CrmCharts";
import { DashShell } from "@/components/portal/DashShell";
import { Pagination } from "@/components/portal/Pagination";
import { PaymentRef } from "@/components/portal/PaymentRef";
import { PortalDateField } from "@/components/portal/PortalDateField";
import { SetupNotice } from "@/components/portal/SetupNotice";

export const metadata: Metadata = { title: "Revenue" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const MAX_PAGE = 40;
const CHART_CAP = 2000;

function revenueHref(next: { from?: string; to?: string; page?: number }) {
  const params = new URLSearchParams();
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.page && next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/admin/revenue?${query}` : "/admin/revenue";
}

type CapturedRow = {
  id: string;
  who: string;
  email: string;
  userId: string | null;
  what: string;
  detail: string;
  amountPaise: number;
  creditPaise: number;
  kind: string;
  how: string;
  at: Date;
  paymentId: string | null;
  orderId: string | null;
};

export default async function AdminRevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; page?: string }>;
}) {
  if (!isClerkConfigured || !isDatabaseConfigured) {
    return (
      <SetupNotice
        feature="The portal"
        keys={["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "DATABASE_URL"]}
      />
    );
  }

  const { role } = await requirePageSuperAdmin();
  const query = await searchParams;
  const fromRaw = query.from?.trim() ?? "";
  const toRaw = query.to?.trim() ?? "";
  const from = parseRevenueDay(fromRaw);
  const to = parseRevenueDay(toRaw, true);
  const page = Math.min(MAX_PAGE, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const now = new Date();
  const paidWhere = revenuePaidWhere(from, to);
  const giftWhere = giftPaidWhere(from, to);
  const createdIn =
    from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};
  const take = page * PAGE_SIZE;

  const [
    paidOrders,
    orderPage,
    orderTotal,
    paidGifts,
    giftPage,
    giftTotal,
    refunded,
    liveMembers,
    payingMembers,
    createdCount,
    failedCount,
    cancelledCount,
    giftsAbandoned,
    giftsFailed,
  ] = await Promise.all([
    db.membershipOrder.findMany({
      where: paidWhere,
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      take: CHART_CAP,
      select: {
        amountPaise: true,
        creditPaise: true,
        interval: true,
        changeKind: true,
        paidAt: true,
        createdAt: true,
        tier: { select: { name: true } },
      },
    }),
    db.membershipOrder.findMany({
      where: paidWhere,
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      take,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        tier: { select: { name: true, badge: true } },
        offer: { select: { name: true } },
        paymentLink: { select: { id: true } },
      },
    }),
    db.membershipOrder.count({ where: paidWhere }),
    db.donation.findMany({
      where: giftWhere,
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      take: CHART_CAP,
      select: { amountPaise: true, paidAt: true, createdAt: true, targetTitle: true },
    }),
    db.donation.findMany({
      where: giftWhere,
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      take,
      include: { paymentLink: { select: { id: true } } },
    }),
    db.donation.count({ where: giftWhere }),
    db.donation.aggregate({
      where: {
        status: DonationStatus.REFUNDED,
        ...(from || to ? { refundedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      _sum: { amountPaise: true },
      _count: { _all: true },
    }),
    db.user.count({
      where: { membershipTierId: { not: null }, membershipExpiresAt: { gt: now } },
    }),
    db.user.count({
      where: { membershipOrders: { some: { status: MembershipOrderStatus.PAID } } },
    }),
    db.membershipOrder.count({ where: { status: MembershipOrderStatus.CREATED, ...createdIn } }),
    db.membershipOrder.count({ where: { status: MembershipOrderStatus.FAILED, ...createdIn } }),
    db.membershipOrder.count({ where: { status: MembershipOrderStatus.CANCELLED, ...createdIn } }),
    db.donation.count({ where: { status: DonationStatus.CREATED, ...createdIn } }),
    db.donation.count({ where: { status: DonationStatus.FAILED, ...createdIn } }),
  ]);

  const snapshot = buildRevenueSnapshot({
    paidOrders: paidOrders.map((row) => ({
      amountPaise: row.amountPaise,
      creditPaise: row.creditPaise,
      interval: row.interval,
      changeKind: row.changeKind,
      paidAt: row.paidAt,
      createdAt: row.createdAt,
      tierName: row.tier.name,
    })),
    paidGifts,
    refundedGiftPaise: refunded._sum.amountPaise ?? 0,
    liveMembers,
    payingMembers,
    createdCount,
    failedCount,
    cancelledCount,
    now,
  });

  const captured: CapturedRow[] = [
    ...orderPage.map((order) => ({
      id: `m_${order.id}`,
      who: [order.user.firstName, order.user.lastName].filter(Boolean).join(" ") || order.user.email,
      email: order.user.email,
      userId: order.user.id,
      what: order.tier.name,
      detail: [
        order.interval === "YEARLY" ? "Yearly" : "Monthly",
        order.recurring ? "recurring" : null,
        order.offer ? order.offer.name : null,
      ]
        .filter(Boolean)
        .join(" · "),
      amountPaise: order.amountPaise,
      creditPaise: order.creditPaise,
      kind: revenueKindLabel(order.changeKind),
      how: order.grantedByUserId
        ? "Granted free"
        : order.paymentLink
          ? "Payment link"
          : order.changeKind === "RENEWAL" && order.recurring
            ? "Auto-renew"
            : "Checkout",
      at: order.paidAt ?? order.createdAt,
      paymentId: order.razorpayPaymentId,
      orderId: order.razorpayOrderId,
    })),
    ...giftPage.map((gift) => ({
      id: `g_${gift.id}`,
      who: gift.donorName,
      email: gift.donorEmail,
      userId: null,
      what: gift.targetTitle,
      detail: "Gift",
      amountPaise: gift.amountPaise,
      creditPaise: 0,
      kind: "Gift",
      how: gift.paymentLink ? "Payment link" : "Checkout",
      at: gift.paidAt ?? gift.createdAt,
      paymentId: gift.razorpayPaymentId,
      orderId: gift.razorpayOrderId,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const capturedTotal = orderTotal + giftTotal;
  const pages = Math.min(MAX_PAGE, Math.max(1, Math.ceil(capturedTotal / PAGE_SIZE)));
  const avgPaise = snapshot.paidCount > 0 ? Math.round(snapshot.paidTotalPaise / snapshot.paidCount) : 0;

  return (
    <DashShell role={role} currentPath="/admin/revenue">
      <main className="pt-main">
        <div className="pt-pagehead">
          <div>
            <h1 className="pt-title">Revenue</h1>
            <p className="pt-subtitle">
              Every captured payment: membership plans and gifts, by checkout or payment link. Returned
              gifts are left out of the totals. Filter by period; charts use up to {CHART_CAP} paid rows
              of each kind and the table is paginated.
            </p>
          </div>
          {snapshot.paidCount > 0 ? <span className="pt-count">{snapshot.paidCount}</span> : null}
        </div>

        <form className="pt-card pt-crm-period" method="get" style={{ marginBottom: 16 }}>
          <label className="pt-label" htmlFor="rev-from">
            Start date
            <PortalDateField id="rev-from" name="from" defaultValue={fromRaw} placeholder="Start date" />
          </label>
          <label className="pt-label" htmlFor="rev-to">
            End date
            <PortalDateField id="rev-to" name="to" defaultValue={toRaw} placeholder="End date" />
          </label>
          <div className="pt-crm-period__actions">
            <button type="submit" className="pt-btn pt-btn--secondary pt-btn--pop">
              Apply period
            </button>
            {fromRaw || toRaw ? (
              <Link className="pt-btn pt-btn--ghost pt-btn--pop" href="/admin/revenue">
                Clear
              </Link>
            ) : null}
          </div>
        </form>

        <div className="pt-crm-kpis">
          <CrmStat
            label="Paid to date"
            value={formatInr(snapshot.paidTotalPaise)}
            hint={`${snapshot.paidCount} captured payment${snapshot.paidCount === 1 ? "" : "s"}`}
          />
          <CrmStat
            label="Membership"
            value={formatInr(snapshot.membershipPaise)}
            hint={`${snapshot.membershipCount} plan payment${snapshot.membershipCount === 1 ? "" : "s"}`}
          />
          <CrmStat
            label="Gifts"
            value={formatInr(snapshot.giftPaise)}
            hint={`${snapshot.giftCount} gift${snapshot.giftCount === 1 ? "" : "s"}${
              refunded._count._all ? ` · ${formatInr(snapshot.refundedGiftPaise)} returned` : ""
            }`}
          />
          <CrmStat label="Average ticket" value={formatInr(avgPaise)} hint="Across everything in view" />
        </div>

        <div className="pt-grid pt-grid--2" style={{ marginBottom: 16 }}>
          <section className="pt-card">
            <h2 className="pt-section-title">Paid by month</h2>
            <CrmSpark points={snapshot.byMonth.slice(-6)} />
          </section>
          <section className="pt-card">
            <h2 className="pt-section-title">Membership by plan</h2>
            {snapshot.byPlan.length ? <CrmBars items={snapshot.byPlan} /> : <p className="pt-hint">No plan payments in view.</p>}
          </section>
        </div>

        <div className="pt-grid pt-grid--2" style={{ marginBottom: 16 }}>
          <section className="pt-card">
            <h2 className="pt-section-title">Gifts by desk</h2>
            {snapshot.byDesk.length ? <CrmBars items={snapshot.byDesk} /> : <p className="pt-hint">No gifts in view.</p>}
          </section>
          <section className="pt-card">
            <h2 className="pt-section-title">Members</h2>
            <dl className="pt-kv">
              <dt>Live badges</dt>
              <dd>{snapshot.liveMembers}</dd>
              <dt>Have paid before</dt>
              <dd>{snapshot.payingMembers}</dd>
              <dt>Monthly plans</dt>
              <dd>
                <span className="pt-money">{formatInr(snapshot.monthlyPaise)}</span>
              </dd>
              <dt>Yearly plans</dt>
              <dd>
                <span className="pt-money">{formatInr(snapshot.yearlyPaise)}</span>
              </dd>
              <dt>Credits given</dt>
              <dd>
                <span className="pt-money">{formatInr(snapshot.refundCreditPaise)}</span>
              </dd>
            </dl>
          </section>
        </div>

        <div className="pt-grid pt-grid--2" style={{ marginBottom: 16 }}>
          <section className="pt-card">
            <h2 className="pt-section-title">Plan checkouts</h2>
            <dl className="pt-kv">
              <dt>Open / created</dt>
              <dd>{snapshot.createdCount}</dd>
              <dt>Failed</dt>
              <dd>{snapshot.failedCount}</dd>
              <dt>Cancelled</dt>
              <dd>{snapshot.cancelledCount}</dd>
            </dl>
          </section>
          <section className="pt-card">
            <h2 className="pt-section-title">Gift checkouts</h2>
            <dl className="pt-kv">
              <dt>Opened, not paid</dt>
              <dd>{giftsAbandoned}</dd>
              <dt>Failed</dt>
              <dd>{giftsFailed}</dd>
              <dt>Returned</dt>
              <dd>{refunded._count._all}</dd>
            </dl>
          </section>
        </div>

        {snapshot.byKind.length > 0 ? (
          <section className="pt-card" style={{ marginBottom: 16 }}>
            <h2 className="pt-section-title">Membership by change kind</h2>
            <div className="pt-table-wrap">
              <table className="pt-table pt-table--dossier">
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Payments</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.byKind.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>{row.count}</td>
                      <td>
                        <span className="pt-money">{formatInr(row.paise)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="pt-card pt-card--flush">
          <div className="pt-card__head">
            <h2 className="pt-section-title" style={{ margin: 0 }}>
              Captured payments
            </h2>
            <Link href="/admin/payments" className="pt-link">
              Every attempt, paid or not
            </Link>
          </div>
          {captured.length === 0 ? (
            <p className="pt-empty">No captured payments in this period.</p>
          ) : (
            <div className="pt-table-wrap">
              <table className="pt-table pt-table--dossier pt-table--payments pt-pay-table">
                <thead>
                  <tr>
                    <th>Who</th>
                    <th>For</th>
                    <th>Amount</th>
                    <th>Kind</th>
                    <th>When</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {captured.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.userId ? (
                          <Link href={`/admin/crm/${row.userId}`} className="pt-user-link">
                            <div className="pt-dossier-plan">{row.who}</div>
                            <div className="pt-dossier-meta">{row.email}</div>
                          </Link>
                        ) : (
                          <>
                            <div className="pt-dossier-plan">{row.who}</div>
                            <div className="pt-dossier-meta">{row.email}</div>
                          </>
                        )}
                      </td>
                      <td>
                        <div className="pt-dossier-plan">{row.what}</div>
                        <div className="pt-dossier-meta">{row.detail}</div>
                      </td>
                      <td>
                        <span className="pt-money">{formatInr(row.amountPaise)}</span>
                        {row.creditPaise > 0 ? (
                          <div className="pt-dossier-meta">Credit {formatInr(row.creditPaise)}</div>
                        ) : null}
                      </td>
                      <td>
                        <span className="pt-pill">{row.kind}</span>
                        <div className="pt-dossier-meta">{row.how}</div>
                      </td>
                      <td className="pt-dossier-when">{formatDayTime(row.at)}</td>
                      <td>
                        <PaymentRef paymentId={row.paymentId} orderId={row.orderId} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: "12px 16px 16px" }}>
            <Pagination
              page={Math.min(page, pages)}
              pages={pages}
              total={capturedTotal}
              pageSize={PAGE_SIZE}
              hrefFor={(next) =>
                revenueHref({
                  from: fromRaw || undefined,
                  to: toRaw || undefined,
                  page: next,
                })
              }
            />
          </div>
        </section>
      </main>
    </DashShell>
  );
}
