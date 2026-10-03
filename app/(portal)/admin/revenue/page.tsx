import type { Metadata } from "next";
import Link from "next/link";
import { MembershipOrderStatus } from "@prisma/client";
import { requirePageSuperAdmin } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { formatDayTime } from "@/lib/format-date";
import { formatInr } from "@/lib/membership";
import {
  buildRevenueSnapshot,
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
const CHART_CAP = 2000;

function revenueHref(next: { from?: string; to?: string; page?: number }) {
  const params = new URLSearchParams();
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.page && next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/admin/revenue?${query}` : "/admin/revenue";
}

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
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const now = new Date();
  const paidWhere = revenuePaidWhere(from, to);

  const [
    paidOrders,
    paidPage,
    paidTotal,
    liveMembers,
    payingMembers,
    createdCount,
    failedCount,
    cancelledCount,
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
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        tier: { select: { name: true, badge: true } },
        offer: { select: { name: true } },
      },
    }),
    db.membershipOrder.count({ where: paidWhere }),
    db.user.count({
      where: { membershipTierId: { not: null }, membershipExpiresAt: { gt: now } },
    }),
    db.user.count({
      where: { membershipOrders: { some: { status: MembershipOrderStatus.PAID } } },
    }),
    db.membershipOrder.count({
      where: {
        status: MembershipOrderStatus.CREATED,
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
    }),
    db.membershipOrder.count({
      where: {
        status: MembershipOrderStatus.FAILED,
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
    }),
    db.membershipOrder.count({
      where: {
        status: MembershipOrderStatus.CANCELLED,
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
    }),
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
    liveMembers,
    payingMembers,
    createdCount,
    failedCount,
    cancelledCount,
    now,
  });
  const pages = Math.max(1, Math.ceil(paidTotal / PAGE_SIZE));
  const avgPaise = snapshot.paidCount > 0 ? Math.round(snapshot.paidTotalPaise / snapshot.paidCount) : 0;

  return (
    <DashShell role={role} currentPath="/admin/revenue">
      <main className="pt-main">
        <div className="pt-pagehead">
          <div>
            <h1 className="pt-title">Revenue</h1>
            <p className="pt-subtitle">
              Captured membership payments from Razorpay. Filter by period; charts use up to{" "}
              {CHART_CAP} paid rows and the table is paginated.
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
          <CrmStat label="Average ticket" value={formatInr(avgPaise)} hint="Across paid orders in view" />
          <CrmStat
            label="Live badges"
            value={String(snapshot.liveMembers)}
            hint={`${snapshot.payingMembers} members have paid before`}
          />
          <CrmStat
            label="Credits given"
            value={formatInr(snapshot.refundCreditPaise)}
            hint="Plan-change residual credited"
          />
        </div>

        <div className="pt-grid pt-grid--2" style={{ marginBottom: 16 }}>
          <section className="pt-card">
            <h2 className="pt-section-title">Paid by month</h2>
            <CrmSpark points={snapshot.byMonth.slice(-6)} />
          </section>
          <section className="pt-card">
            <h2 className="pt-section-title">Paid by plan</h2>
            <CrmBars items={snapshot.byPlan} />
          </section>
        </div>

        <div className="pt-grid pt-grid--2" style={{ marginBottom: 16 }}>
          <section className="pt-card">
            <h2 className="pt-section-title">Cycle mix</h2>
            <dl className="pt-kv">
              <dt>Monthly</dt>
              <dd>
                <span className="pt-money">{formatInr(snapshot.monthlyPaise)}</span>
              </dd>
              <dt>Yearly</dt>
              <dd>
                <span className="pt-money">{formatInr(snapshot.yearlyPaise)}</span>
              </dd>
            </dl>
          </section>
          <section className="pt-card">
            <h2 className="pt-section-title">Pipeline health</h2>
            <dl className="pt-kv">
              <dt>Open / created</dt>
              <dd>{snapshot.createdCount}</dd>
              <dt>Failed</dt>
              <dd>{snapshot.failedCount}</dd>
              <dt>Cancelled</dt>
              <dd>{snapshot.cancelledCount}</dd>
            </dl>
          </section>
        </div>

        {snapshot.byKind.length > 0 ? (
          <section className="pt-card" style={{ marginBottom: 16 }}>
            <h2 className="pt-section-title">By change kind</h2>
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
          </div>
          {paidPage.length === 0 ? (
            <p className="pt-empty">No paid memberships in this period.</p>
          ) : (
            <div className="pt-table-wrap">
              <table className="pt-table pt-table--dossier pt-table--payments">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Plan</th>
                    <th>Amount</th>
                    <th>Kind</th>
                    <th>When</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {paidPage.map((order) => {
                    const name =
                      [order.user.firstName, order.user.lastName].filter(Boolean).join(" ") ||
                      order.user.email;
                    return (
                      <tr key={order.id}>
                        <td>
                          <Link href={`/admin/crm/${order.user.id}`} className="pt-user-link">
                            <div className="pt-dossier-plan">{name}</div>
                            <div className="pt-dossier-meta">{order.user.email}</div>
                          </Link>
                        </td>
                        <td>
                          <div className="pt-dossier-plan">{order.tier.name}</div>
                          <div className="pt-dossier-meta">
                            {order.interval === "YEARLY" ? "Yearly" : "Monthly"}
                            {order.recurring ? " · recurring" : ""}
                            {order.offer ? ` · ${order.offer.name}` : ""}
                          </div>
                        </td>
                        <td>
                          <span className="pt-money">{formatInr(order.amountPaise)}</span>
                          {order.creditPaise > 0 ? (
                            <div className="pt-dossier-meta">Credit {formatInr(order.creditPaise)}</div>
                          ) : null}
                        </td>
                        <td>
                          <span className="pt-pill">{revenueKindLabel(order.changeKind)}</span>
                        </td>
                        <td className="pt-dossier-when">
                          {formatDayTime(order.paidAt ?? order.createdAt)}
                        </td>
                        <td>
                          <PaymentRef
                            paymentId={order.razorpayPaymentId}
                            orderId={order.razorpayOrderId}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: "12px 16px 16px" }}>
            <Pagination
              page={Math.min(page, pages)}
              pages={pages}
              total={paidTotal}
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
