import type { Metadata } from "next";
import Link from "next/link";
import type { ContactMessageStatus, Prisma } from "@prisma/client";
import { requirePageSuperAdmin } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { formatDayTime } from "@/lib/format-date";
import { DashShell } from "@/components/portal/DashShell";
import { Pagination } from "@/components/portal/Pagination";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { SetupNotice } from "@/components/portal/SetupNotice";

export const metadata: Metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<ContactMessageStatus, string> = {
  NEW: "New",
  REVIEWED: "Reviewed",
  REPLIED: "Replied",
  ARCHIVED: "Archived",
};

function messagesHref(next: { page?: number; status?: string; q?: string }) {
  const params = new URLSearchParams();
  if (next.status && next.status !== "open") params.set("status", next.status);
  if (next.q) params.set("q", next.q);
  if (next.page && next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/admin/messages?${query}` : "/admin/messages";
}

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
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
  const params = await searchParams;
  const statusRaw = (params.status ?? "open").trim().toLowerCase();
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const where: Prisma.ContactMessageWhereInput = {};
  if (statusRaw === "new") where.status = "NEW";
  else if (statusRaw === "reviewed") where.status = "REVIEWED";
  else if (statusRaw === "replied") where.status = "REPLIED";
  else if (statusRaw === "archived") where.status = "ARCHIVED";
  else if (statusRaw === "all") {
    /* no filter */
  } else {
    where.status = { in: ["NEW", "REVIEWED", "REPLIED"] };
  }

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { body: { contains: q, mode: "insensitive" } },
    ];
  }

  const [rows, total, newCount] = await Promise.all([
    db.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.contactMessage.count({ where }),
    db.contactMessage.count({ where: { status: "NEW" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <DashShell role={role} currentPath="/admin/messages">
      <main className="pt-main">
        <div className="pt-pagehead">
          <div>
            <h1 className="pt-title">Messages</h1>
            <p className="pt-subtitle">
              Contact form submissions from theainf.in. Mark reviewed, archive, or reply — with or
              without an AINF email.
            </p>
          </div>
          {newCount > 0 ? <span className="pt-count">{newCount}</span> : null}
        </div>

        <form className="pt-card pt-crm-period" method="get" style={{ marginBottom: 16 }}>
          <label className="pt-label" htmlFor="msg-q">
            Search
            <input
              id="msg-q"
              className="pt-input"
              name="q"
              defaultValue={q}
              placeholder="Name, email, phone, or text"
            />
          </label>
          <label className="pt-label" htmlFor="msg-status">
            Status
            <PortalSelect
              id="msg-status"
              name="status"
              defaultValue={statusRaw === "open" ? "open" : statusRaw}
              options={[
                { value: "open", label: "Open inbox" },
                { value: "new", label: "New" },
                { value: "reviewed", label: "Reviewed" },
                { value: "replied", label: "Replied" },
                { value: "archived", label: "Archived" },
                { value: "all", label: "All" },
              ]}
            />
          </label>
          <div className="pt-crm-period__actions">
            <button type="submit" className="pt-btn pt-btn--secondary">
              Apply
            </button>
            {q || statusRaw !== "open" ? (
              <Link className="pt-btn pt-btn--ghost" href="/admin/messages">
                Clear
              </Link>
            ) : null}
          </div>
        </form>

        <section className="pt-card pt-card--flush">
          <div className="pt-card__head">
            <h2 className="pt-section-title" style={{ margin: 0 }}>
              Inbox
            </h2>
          </div>
          {rows.length === 0 ? (
            <p className="pt-empty">No messages in this view.</p>
          ) : (
            <div className="pt-table-wrap">
              <table className="pt-table pt-table--dossier pt-table--inbox">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>Message</th>
                    <th>Status</th>
                    <th>When</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className={row.status === "NEW" ? "is-unread" : undefined}>
                      <td>
                        <Link href={`/admin/messages/${row.id}`} className="pt-user-link pt-inbox-from">
                          <div className="pt-dossier-plan">{row.name}</div>
                          <div className="pt-dossier-meta">{row.email}</div>
                          {row.phone ? <div className="pt-dossier-meta pt-inbox-phone">{row.phone}</div> : null}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/admin/messages/${row.id}`} className="pt-user-link">
                          <div className="pt-inbox-preview">
                            {row.body.length > 90 ? `${row.body.slice(0, 90).trimEnd()}…` : row.body}
                          </div>
                        </Link>
                      </td>
                      <td>
                        <span
                          className={`pt-badge pt-badge--lift ${
                            row.status === "NEW"
                              ? "pt-badge--success"
                              : row.status === "ARCHIVED"
                                ? "pt-badge--warning"
                                : "pt-badge--neutral"
                          }`}
                        >
                          {STATUS_LABEL[row.status]}
                        </span>
                      </td>
                      <td className="pt-dossier-when">{formatDayTime(row.createdAt)}</td>
                      <td>
                        <Link
                          href={`/admin/messages/${row.id}`}
                          className="pt-btn pt-btn--secondary pt-btn--sm pt-btn--pop"
                        >
                          Open
                        </Link>
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
              total={total}
              pageSize={PAGE_SIZE}
              hrefFor={(next) =>
                messagesHref({
                  status: statusRaw,
                  q: q || undefined,
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
