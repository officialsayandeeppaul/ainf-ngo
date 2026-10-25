import type { Metadata } from "next";
import Link from "next/link";
import {
  DonationStatus,
  MembershipOrderStatus,
  PaymentInterestStatus,
  PaymentLinkStatus,
  PaymentPurpose,
  type Prisma,
} from "@prisma/client";
import { requirePageSuperAdmin } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { isClerkConfigured, isDatabaseConfigured, isRazorpayConfigured, isRazorpayWebhookConfigured } from "@/lib/env";
import { formatDay, formatDayTime } from "@/lib/format-date";
import { formatInr } from "@/lib/membership";
import { interestLabel } from "@/lib/payment-interest";
import { getPaymentSettings, toPaymentSettingsView } from "@/lib/payment-settings";
import { checkRazorpayKeys } from "@/lib/razorpay";
import { parseRevenueDay } from "@/lib/revenue";
import { CrmStat } from "@/components/portal/CrmCharts";
import { DashShell } from "@/components/portal/DashShell";
import { Pagination } from "@/components/portal/Pagination";
import { PaymentRef } from "@/components/portal/PaymentRef";
import { PaymentsAdmin, type InterestRow, type LinkRow } from "@/components/portal/PaymentsAdmin";
import { PortalDateField } from "@/components/portal/PortalDateField";
import { SetupNotice } from "@/components/portal/SetupNotice";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

const HISTORY_PAGE = 25;
const HISTORY_MAX_PAGE = 40;

const QUEUE_FILTERS = {
  active: { label: "Waiting", statuses: [PaymentInterestStatus.OPEN, PaymentInterestStatus.CONTACTED, PaymentInterestStatus.LINK_SENT] },
  open: { label: "New", statuses: [PaymentInterestStatus.OPEN] },
  link: { label: "Link sent", statuses: [PaymentInterestStatus.LINK_SENT] },
  paid: { label: "Paid", statuses: [PaymentInterestStatus.PAID] },
  dismissed: { label: "Dismissed", statuses: [PaymentInterestStatus.DISMISSED] },
  all: { label: "All", statuses: null },
} as const;

type QueueFilter = keyof typeof QUEUE_FILTERS;

type Query = {
  queue?: string;
  purpose?: string;
  q?: string;
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: string;
};

function hrefWith(current: Query, next: Partial<Query>): string {
  const merged = { ...current, ...next };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value && !(key === "page" && value === "1")) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/admin/payments?${query}` : "/admin/payments";
}

type HistoryRow = {
  id: string;
  kind: "Membership" | "Gift";
  who: string;
  email: string;
  userId: string | null;
  what: string;
  amountPaise: number;
  status: string;
  how: string;
  at: Date;
  paymentId: string | null;
  orderId: string | null;
};

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<Query> }) {
  if (!isClerkConfigured || !isDatabaseConfigured) {
    return (
      <SetupNotice
        feature="The portal"
        keys={["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "DATABASE_URL"]}
      />
    );
  }

  const { role } = await requirePageSuperAdmin("/admin/payments");
  const query = await searchParams;
  const queue: QueueFilter = query.queue && query.queue in QUEUE_FILTERS ? (query.queue as QueueFilter) : "active";
  const purpose =
    query.purpose === "gift" ? PaymentPurpose.DONATION : query.purpose === "membership" ? PaymentPurpose.MEMBERSHIP : null;
  const search = (query.q ?? "").trim().slice(0, 80);
  const historyType = query.type === "gift" || query.type === "membership" ? query.type : "all";
  const historyStatus = query.status === "paid" || query.status === "unpaid" || query.status === "refunded" ? query.status : "all";
  const from = parseRevenueDay(query.from?.trim() ?? "");
  const to = parseRevenueDay(query.to?.trim() ?? "", true);
  const page = Math.min(HISTORY_MAX_PAGE, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));

  const statuses = QUEUE_FILTERS[queue].statuses;
  const interestWhere: Prisma.PaymentInterestWhereInput = {
    ...(statuses ? { status: { in: [...statuses] } } : {}),
    ...(purpose ? { purpose } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { targetTitle: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const dateFilter =
    from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;
  const take = page * HISTORY_PAGE;

  const membershipStatus: Prisma.MembershipOrderWhereInput =
    historyStatus === "paid"
      ? { status: MembershipOrderStatus.PAID }
      : historyStatus === "unpaid"
        ? { status: { in: [MembershipOrderStatus.CREATED, MembershipOrderStatus.FAILED, MembershipOrderStatus.CANCELLED] } }
        : historyStatus === "refunded"
          ? { id: "__none__" }
          : {};
  const donationStatus: Prisma.DonationWhereInput =
    historyStatus === "paid"
      ? { status: DonationStatus.PAID }
      : historyStatus === "unpaid"
        ? { status: { in: [DonationStatus.CREATED, DonationStatus.FAILED] } }
        : historyStatus === "refunded"
          ? { status: DonationStatus.REFUNDED }
          : {};
  const orderWhere: Prisma.MembershipOrderWhereInput = {
    ...membershipStatus,
    ...(dateFilter ? { createdAt: dateFilter } : {}),
  };
  const giftWhere: Prisma.DonationWhereInput = {
    ...donationStatus,
    ...(dateFilter ? { createdAt: dateFilter } : {}),
  };

  const [
    keyHealth,
    settingsRow,
    interests,
    statusCounts,
    waitingValue,
    links,
    linksOut,
    linksPaid,
    orders,
    orderTotal,
    gifts,
    giftTotal,
  ] = await Promise.all([
    checkRazorpayKeys(),
    getPaymentSettings(),
    db.paymentInterest.findMany({
      where: interestWhere,
      orderBy: [{ lastAttemptAt: "desc" }],
      take: 100,
      include: {
        tier: { select: { name: true } },
        links: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    db.paymentInterest.groupBy({ by: ["status"], _count: { _all: true } }),
    db.paymentInterest.aggregate({
      where: { status: { in: [PaymentInterestStatus.OPEN, PaymentInterestStatus.CONTACTED] } },
      _sum: { amountPaise: true },
    }),
    // Attempts Razorpay refused never became links; their error shows on the request.
    db.paymentLink.findMany({
      where: { status: { not: PaymentLinkStatus.FAILED } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { interest: { select: { purpose: true, targetTitle: true, interval: true } } },
    }),
    db.paymentLink.aggregate({
      where: { status: PaymentLinkStatus.CREATED },
      _count: { _all: true },
      _sum: { amountPaise: true },
    }),
    db.paymentLink.aggregate({
      where: { status: PaymentLinkStatus.PAID },
      _count: { _all: true },
      _sum: { amountPaise: true },
    }),
    historyType === "gift"
      ? Promise.resolve([])
      : db.membershipOrder.findMany({
          where: orderWhere,
          orderBy: { createdAt: "desc" },
          take,
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
            tier: { select: { name: true } },
            paymentLink: { select: { id: true } },
          },
        }),
    historyType === "gift" ? Promise.resolve(0) : db.membershipOrder.count({ where: orderWhere }),
    historyType === "membership"
      ? Promise.resolve([])
      : db.donation.findMany({
          where: giftWhere,
          orderBy: { createdAt: "desc" },
          take,
          include: { paymentLink: { select: { id: true } } },
        }),
    historyType === "membership" ? Promise.resolve(0) : db.donation.count({ where: giftWhere }),
  ]);

  const settings = toPaymentSettingsView(settingsRow);
  const counts = Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all])) as Partial<
    Record<PaymentInterestStatus, number>
  >;
  const waiting = (counts.OPEN ?? 0) + (counts.CONTACTED ?? 0);
  const now = Date.now();

  const interestRows: InterestRow[] = interests.map((row) => {
    const link = row.links[0] ?? null;
    return {
      id: row.id,
      purpose: row.purpose,
      status: row.status,
      name: row.name,
      email: row.email,
      phone: row.phone,
      what: interestLabel(row),
      amountPaise: row.amountPaise,
      amountLabel: formatInr(row.amountPaise),
      attempts: row.attempts,
      firstLabel: formatDayTime(row.createdAt),
      lastLabel: formatDayTime(row.lastAttemptAt),
      source: row.source,
      adminNote: row.adminNote,
      crmHref: row.userId ? `/admin/crm/${row.userId}` : null,
      link: link
        ? {
            id: link.id,
            status: link.status,
            shortUrl: link.shortUrl,
            amountLabel: formatInr(link.amountPaise),
            expiresLabel: link.expiresAt ? formatDay(link.expiresAt) : null,
            expired: Boolean(link.expiresAt && link.expiresAt.getTime() <= now),
            paidLabel: link.paidAt ? formatDayTime(link.paidAt) : null,
            emailed: Boolean(link.emailedAt),
            lastError: link.lastError,
          }
        : null,
    };
  });

  const linkRows: LinkRow[] = links.map((link) => ({
    id: link.id,
    purpose: link.purpose,
    status: link.status,
    who: link.customerName,
    email: link.customerEmail,
    what: link.interest ? interestLabel(link.interest) : link.description,
    amountLabel: formatInr(link.amountPaise),
    createdLabel: formatDayTime(link.createdAt),
    expiresLabel: link.expiresAt ? formatDay(link.expiresAt) : null,
    expired: Boolean(link.expiresAt && link.expiresAt.getTime() <= now),
    paidLabel: link.paidAt ? formatDayTime(link.paidAt) : null,
    shortUrl: link.shortUrl,
    paymentId: link.razorpayPaymentId,
    lastError: link.lastError,
  }));

  const history: HistoryRow[] = [
    ...orders.map((order) => ({
      id: `m_${order.id}`,
      kind: "Membership" as const,
      who: [order.user.firstName, order.user.lastName].filter(Boolean).join(" ") || order.user.email,
      email: order.user.email,
      userId: order.user.id,
      what: `${order.tier.name} · ${order.interval === "YEARLY" ? "yearly" : "monthly"}`,
      amountPaise: order.amountPaise,
      status: order.status,
      how: order.grantedByUserId
        ? "Granted free"
        : order.paymentLink
          ? "Payment link"
          : order.changeKind === "RENEWAL" && order.recurring
            ? "Auto-renew"
            : order.recurring
              ? "Subscription"
              : "Checkout",
      at: order.paidAt ?? order.createdAt,
      paymentId: order.razorpayPaymentId,
      orderId: order.razorpayOrderId,
    })),
    ...gifts.map((gift) => ({
      id: `g_${gift.id}`,
      kind: "Gift" as const,
      who: gift.donorName,
      email: gift.donorEmail,
      userId: null,
      what: gift.targetTitle,
      amountPaise: gift.amountPaise,
      status: gift.status,
      how: gift.paymentLink ? "Payment link" : "Checkout",
      at: gift.paidAt ?? gift.createdAt,
      paymentId: gift.razorpayPaymentId,
      orderId: gift.razorpayOrderId,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice((page - 1) * HISTORY_PAGE, page * HISTORY_PAGE);

  const historyTotal = orderTotal + giftTotal;
  const historyPages = Math.min(HISTORY_MAX_PAGE, Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE)));

  return (
    <DashShell role={role} currentPath="/admin/payments">
      <main className="pt-main">
        <div className="pt-pagehead">
          <div>
            <h1 className="pt-title">Payments</h1>
            <p className="pt-subtitle">
              Turn online payments on or off, work through the people who asked to pay while they were
              off, send them Razorpay payment links, and see every payment in one place.
            </p>
          </div>
          <span className={`pt-badge pt-badge--lift ${settings.open ? "pt-badge--success" : "pt-badge--warning"}`}>
            <span className="pt-badge__dot" aria-hidden="true" />
            {settings.open ? "Payments live" : "Payments paused"}
          </span>
        </div>

        {!isRazorpayConfigured ? (
          <div className="pt-alert pt-alert--warning" style={{ marginBottom: 16 }}>
            <p className="pt-alert__title">Razorpay keys are missing</p>
            <p>Checkout and payment links need NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.</p>
          </div>
        ) : keyHealth === "rejected" ? (
          <div className="pt-alert pt-alert--error" style={{ marginBottom: 16 }}>
            <p className="pt-alert__title">Razorpay is rejecting the API keys</p>
            <p>
              Checkout and payment links fail with “Authentication failed” until this is fixed. In the
              Razorpay Dashboard open Account &amp; Settings → API Keys, generate a key pair (test or
              live), then set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel → Settings →
              Environment Variables and redeploy.
            </p>
          </div>
        ) : keyHealth === "unreachable" ? (
          <div className="pt-alert pt-alert--warning" style={{ marginBottom: 16 }}>
            <p className="pt-alert__title">Razorpay did not answer</p>
            <p>The key check timed out. Links may still work; try again in a minute.</p>
          </div>
        ) : null}

        <div className="pt-crm-kpis">
          <CrmStat
            label="Waiting"
            value={String(waiting)}
            hint={`${formatInr(waitingValue._sum.amountPaise ?? 0)} asked for, no link yet`}
          />
          <CrmStat
            label="Links out"
            value={String(linksOut._count._all)}
            hint={`${formatInr(linksOut._sum.amountPaise ?? 0)} waiting to be paid`}
          />
          <CrmStat
            label="Paid via links"
            value={formatInr(linksPaid._sum.amountPaise ?? 0)}
            hint={`${linksPaid._count._all} link${linksPaid._count._all === 1 ? "" : "s"} settled`}
          />
          <CrmStat label="All requests" value={String(Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0))} hint="Every interest ever saved" />
        </div>

        <PaymentsAdmin
          settings={settings}
          webhookOn={isRazorpayWebhookConfigured}
          interests={interestRows}
          links={linkRows}
          queue={{
            current: queue,
            tabs: (Object.keys(QUEUE_FILTERS) as QueueFilter[]).map((key) => ({
              key,
              label: QUEUE_FILTERS[key].label,
              count:
                key === "active"
                  ? (counts.OPEN ?? 0) + (counts.CONTACTED ?? 0) + (counts.LINK_SENT ?? 0)
                  : key === "all"
                    ? Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0)
                    : (QUEUE_FILTERS[key].statuses ?? []).reduce((sum, status) => sum + (counts[status] ?? 0), 0),
              href: hrefWith(query, { queue: key === "active" ? undefined : key }),
            })),
            purpose: query.purpose === "gift" || query.purpose === "membership" ? query.purpose : "all",
            search,
            purposeHref: {
              all: hrefWith(query, { purpose: undefined }),
              gift: hrefWith(query, { purpose: "gift" }),
              membership: hrefWith(query, { purpose: "membership" }),
            },
          }}
        />

        <section className="pt-card pt-card--flush" style={{ marginTop: 18 }}>
          <div className="pt-card__head">
            <h2 className="pt-section-title" style={{ margin: 0 }}>
              Payment history
            </h2>
            <span className="pt-count">{historyTotal}</span>
          </div>
          <form className="pt-crm-period pt-pay-filters" method="get">
            {query.queue ? <input type="hidden" name="queue" value={query.queue} /> : null}
            {query.purpose ? <input type="hidden" name="purpose" value={query.purpose} /> : null}
            {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
            <label className="pt-label" htmlFor="pay-type">
              Type
              <select id="pay-type" name="type" className="pt-select" defaultValue={historyType}>
                <option value="all">Everything</option>
                <option value="membership">Membership</option>
                <option value="gift">Gifts</option>
              </select>
            </label>
            <label className="pt-label" htmlFor="pay-status">
              Status
              <select id="pay-status" name="status" className="pt-select" defaultValue={historyStatus}>
                <option value="all">Any</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Not paid</option>
                <option value="refunded">Returned</option>
              </select>
            </label>
            <label className="pt-label" htmlFor="pay-from">
              Start date
              <PortalDateField id="pay-from" name="from" defaultValue={query.from ?? ""} placeholder="Start date" />
            </label>
            <label className="pt-label" htmlFor="pay-to">
              End date
              <PortalDateField id="pay-to" name="to" defaultValue={query.to ?? ""} placeholder="End date" />
            </label>
            <div className="pt-crm-period__actions">
              <button type="submit" className="pt-btn pt-btn--secondary pt-btn--pop">
                Apply
              </button>
              {query.type || query.status || query.from || query.to ? (
                <Link
                  className="pt-btn pt-btn--ghost pt-btn--pop"
                  href={hrefWith(query, { type: undefined, status: undefined, from: undefined, to: undefined, page: undefined })}
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </form>
          {history.length === 0 ? (
            <p className="pt-empty">No payments match these filters.</p>
          ) : (
            <div className="pt-table-wrap">
              <table className="pt-table pt-table--dossier pt-table--payments">
                <thead>
                  <tr>
                    <th>Who</th>
                    <th>For</th>
                    <th>Amount</th>
                    <th>How</th>
                    <th>When</th>
                    <th>Status</th>
                    <th>Razorpay</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
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
                        <div className="pt-dossier-meta">{row.kind}</div>
                      </td>
                      <td>
                        <span className="pt-money">{formatInr(row.amountPaise)}</span>
                      </td>
                      <td>
                        <span className="pt-pill">{row.how}</span>
                      </td>
                      <td className="pt-dossier-when">{formatDayTime(row.at)}</td>
                      <td>
                        <span className={`pt-badge pt-badge--lift ${historyTone(row.status)}`}>{historyLabel(row.status)}</span>
                      </td>
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
              page={Math.min(page, historyPages)}
              pages={historyPages}
              total={historyTotal}
              pageSize={HISTORY_PAGE}
              hrefFor={(next) => hrefWith(query, { page: String(next) })}
            />
          </div>
        </section>
      </main>
    </DashShell>
  );
}

function historyLabel(status: string): string {
  if (status === "PAID") return "Paid";
  if (status === "REFUNDED") return "Returned";
  if (status === "CREATED") return "Not paid";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function historyTone(status: string): string {
  if (status === "PAID") return "pt-badge--success";
  if (status === "REFUNDED" || status === "CANCELLED") return "pt-badge--warning";
  if (status === "FAILED") return "pt-badge--danger";
  return "pt-badge--neutral";
}
