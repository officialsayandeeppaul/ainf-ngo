import type { Metadata } from "next";
import Link from "next/link";
import { DonationStatus, type Prisma } from "@prisma/client";
import { requirePageSuperAdmin } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { formatDayTime } from "@/lib/format-date";
import { formatInr } from "@/lib/membership";
import { CrmStat } from "@/components/portal/CrmCharts";
import { DashShell } from "@/components/portal/DashShell";
import { GiftActions } from "@/components/portal/GiftActions";
import { GiftsAdmin } from "@/components/portal/GiftsAdmin";
import { Pagination } from "@/components/portal/Pagination";
import { PaymentRef } from "@/components/portal/PaymentRef";
import { SetupNotice } from "@/components/portal/SetupNotice";

export const metadata: Metadata = { title: "Gifts" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

/** Ledger tabs. Received is the default: unfinished checkouts are noise next to money. */
const TABS = {
  received: { label: "Received", statuses: [DonationStatus.PAID] },
  returned: { label: "Returned", statuses: [DonationStatus.REFUNDED] },
  unpaid: { label: "Not paid", statuses: [DonationStatus.CREATED, DonationStatus.FAILED] },
  all: { label: "All", statuses: null },
} as const;

type Tab = keyof typeof TABS;

const STATUS: Record<DonationStatus, { label: string; tone: string }> = {
  PAID: { label: "Received", tone: "pt-badge--success" },
  REFUNDED: { label: "Returned", tone: "pt-badge--warning" },
  CREATED: { label: "Checkout not finished", tone: "pt-badge--neutral" },
  FAILED: { label: "Failed", tone: "pt-badge--danger" },
};

type Query = { tab?: string; q?: string; page?: string };

function giftsHref(current: Query, next: Partial<Query>): string {
  const merged = { ...current, ...next };
  const params = new URLSearchParams();
  if (merged.tab && merged.tab !== "received") params.set("tab", merged.tab);
  if (merged.q) params.set("q", merged.q);
  if (merged.page && merged.page !== "1") params.set("page", merged.page);
  const query = params.toString();
  return query ? `/admin/gifts?${query}` : "/admin/gifts";
}

export default async function AdminGiftsPage({ searchParams }: { searchParams: Promise<Query> }) {
  if (!isClerkConfigured || !isDatabaseConfigured) {
    return (
      <SetupNotice
        feature="The portal"
        keys={["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "DATABASE_URL"]}
      />
    );
  }

  const { role } = await requirePageSuperAdmin("/admin/gifts");
  const query = await searchParams;
  const tab: Tab = query.tab && query.tab in TABS ? (query.tab as Tab) : "received";
  const search = (query.q ?? "").trim().slice(0, 80);
  const requestedPage = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);

  const statuses = TABS[tab].statuses;
  const searchWhere: Prisma.DonationWhereInput = search
    ? {
        OR: [
          { donorName: { contains: search, mode: "insensitive" } },
          { donorEmail: { contains: search, mode: "insensitive" } },
          { donorPhone: { contains: search } },
          { targetTitle: { contains: search, mode: "insensitive" } },
          { razorpayPaymentId: { contains: search } },
        ],
      }
    : {};
  const where: Prisma.DonationWhereInput = {
    ...(statuses ? { status: { in: [...statuses] } } : {}),
    ...searchWhere,
  };

  const [settings, missions, total, counts, received, returned] = await Promise.all([
    db.donationSettings.findUnique({ where: { id: "singleton" } }),
    db.donationMission.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }] }),
    db.donation.count({ where }),
    db.donation.groupBy({ by: ["status"], where: searchWhere, _count: { _all: true } }),
    db.donation.aggregate({ where: { status: DonationStatus.PAID }, _sum: { amountPaise: true }, _count: { _all: true } }),
    db.donation.aggregate({ where: { status: DonationStatus.REFUNDED }, _sum: { amountPaise: true }, _count: { _all: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  const rows = await db.donation.findMany({
    where,
    orderBy: [{ paidAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { paymentLink: { select: { id: true } } },
  });

  const byStatus = Object.fromEntries(counts.map((row) => [row.status, row._count._all])) as Partial<
    Record<DonationStatus, number>
  >;
  const tabCount = (key: Tab) =>
    (TABS[key].statuses ?? Object.values(DonationStatus)).reduce((sum, status) => sum + (byStatus[status] ?? 0), 0);

  return (
    <DashShell role={role} currentPath="/admin/gifts">
      <main className="pt-main">
        <h1 className="pt-title">Gifts</h1>
        <p className="pt-subtitle">
          Set the minimum, choose which missions accept a gift, and return a paid gift in full. Project gifts are switched on inside each project.
        </p>

        <div className="pt-crm-kpis">
          <CrmStat
            label="Received"
            value={formatInr(received._sum.amountPaise ?? 0)}
            hint={`${received._count._all} gift${received._count._all === 1 ? "" : "s"} on the books`}
          />
          <CrmStat
            label="Returned"
            value={formatInr(returned._sum.amountPaise ?? 0)}
            hint={`${returned._count._all} gift${returned._count._all === 1 ? "" : "s"} given back`}
          />
          <CrmStat
            label="Not paid"
            value={String((byStatus.CREATED ?? 0) + (byStatus.FAILED ?? 0))}
            hint="Checkouts opened but not finished"
          />
        </div>

        <GiftsAdmin
          initialSettings={{
            minPaise: settings?.minPaise ?? 20000,
            maxPaise: settings?.maxPaise ?? 10000000,
            suggestedPaise: settings?.suggestedPaise?.length ? settings.suggestedPaise : [20000, 50000, 100000, 250000],
          }}
          initialMissions={missions.map((mission) => ({
            id: mission.id,
            slug: mission.slug,
            title: mission.title,
            published: mission.published,
            sortOrder: mission.sortOrder,
            minPaise: mission.minPaise,
          }))}
        />

        <section className="pt-card pt-card--flush" style={{ marginTop: 16 }}>
          <div className="pt-card__head pt-pay-queue__head">
            <h2 className="pt-section-title" style={{ margin: 0 }}>
              Ledger
            </h2>
            <form className="pt-pay-search" method="get" role="search">
              {tab !== "received" ? <input type="hidden" name="tab" value={tab} /> : null}
              <input
                className="pt-input"
                type="search"
                name="q"
                defaultValue={search}
                placeholder="Name, email, phone, desk, or payment id"
                aria-label="Search gifts"
              />
            </form>
          </div>
          <div className="pt-pay-tabs">
            <nav className="pt-segment pt-segment--wrap" aria-label="Gift status">
              {(Object.keys(TABS) as Tab[]).map((key) => (
                <Link
                  key={key}
                  href={giftsHref(query, { tab: key, page: undefined })}
                  className={`pt-segment__btn${tab === key ? " is-on" : ""}`}
                  aria-current={tab === key ? "page" : undefined}
                >
                  {TABS[key].label} <span className="pt-pay-tabs__n">{tabCount(key)}</span>
                </Link>
              ))}
            </nav>
          </div>

          {rows.length === 0 ? (
            <p className="pt-empty">{search ? "No gifts match that search." : "No gifts here yet."}</p>
          ) : (
            <div className="pt-table-wrap">
              <table className="pt-table pt-table--dossier pt-pay-table">
                <thead>
                  <tr>
                    <th>Giver</th>
                    <th>For</th>
                    <th>Amount</th>
                    <th>When</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const status = STATUS[row.status];
                    return (
                      <tr key={row.id}>
                        <td>
                          <div className="pt-dossier-plan">{row.donorName}</div>
                          <div className="pt-dossier-meta">
                            <a href={`mailto:${row.donorEmail}`}>{row.donorEmail}</a>
                            {row.donorPhone ? ` · ${row.donorPhone}` : ""}
                          </div>
                        </td>
                        <td>
                          <div className="pt-dossier-plan">{row.targetTitle}</div>
                          <div className="pt-dossier-meta">{row.paymentLink ? "Payment link" : "Checkout"}</div>
                        </td>
                        <td>
                          <span className="pt-money">{formatInr(row.amountPaise)}</span>
                        </td>
                        <td className="pt-dossier-when">
                          {formatDayTime(row.refundedAt ?? row.paidAt ?? row.createdAt)}
                          {row.paidAt && row.refundedAt ? (
                            <div className="pt-dossier-meta">received {formatDayTime(row.paidAt)}</div>
                          ) : null}
                        </td>
                        <td>
                          <span className={`pt-badge pt-badge--lift ${status.tone}`}>{status.label}</span>
                          {row.status === DonationStatus.PAID ? (
                            <div className="pt-dossier-meta">
                              Receipt {row.receiptEmailedAt ? "emailed" : "not emailed yet"}
                            </div>
                          ) : null}
                          {row.razorpayPaymentId ? (
                            <div className="pt-dossier-meta">
                              <PaymentRef paymentId={row.razorpayPaymentId} orderId={row.razorpayOrderId} />
                            </div>
                          ) : null}
                        </td>
                        <td>
                          {row.status === DonationStatus.PAID ? (
                            <GiftActions
                              id={row.id}
                              who={row.donorName}
                              amount={formatInr(row.amountPaise)}
                              target={row.targetTitle}
                              email={row.donorEmail}
                            />
                          ) : row.status === DonationStatus.REFUNDED ? (
                            <a className="pt-link" href={`/donate/receipt/${row.receiptToken}`} target="_blank" rel="noopener noreferrer">
                              Return note
                            </a>
                          ) : null}
                          {row.status === DonationStatus.PAID ? (
                            <a
                              className="pt-link pt-gift-receipt-link"
                              href={`/donate/receipt/${row.receiptToken}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open receipt
                            </a>
                          ) : null}
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
              page={page}
              pages={pages}
              total={total}
              pageSize={PAGE_SIZE}
              hrefFor={(next) => giftsHref(query, { page: String(next) })}
            />
          </div>
        </section>
      </main>
    </DashShell>
  );
}
