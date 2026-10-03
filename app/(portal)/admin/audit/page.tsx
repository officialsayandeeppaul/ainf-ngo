import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { AuditAction } from "@/lib/audit";
import { auditActionLabel, auditChips, shortId } from "@/lib/audit-display";
import { requirePageSuperAdmin } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { DashShell } from "@/components/portal/DashShell";
import { Pagination } from "@/components/portal/Pagination";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { formatClock, formatDay } from "@/lib/format-date";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const USER_OPTION_CAP = 10;

function auditHref(next: {
  page?: number;
  action?: string;
  outcome?: string;
  user?: string;
}) {
  const params = new URLSearchParams();
  if (next.action) params.set("action", next.action);
  if (next.outcome) params.set("outcome", next.outcome);
  if (next.user) params.set("user", next.user);
  if (next.page && next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/admin/audit?${query}` : "/admin/audit";
}

function memberLabel(user: {
  email: string;
  firstName: string | null;
  lastName: string | null;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || user.email;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; outcome?: string; user?: string; page?: string }>;
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

  const action = (params.action ?? "").trim();
  const outcomeRaw = (params.outcome ?? "").trim();
  const outcome = outcomeRaw === "failed" ? false : outcomeRaw === "ok" ? true : undefined;
  const userId = (params.user ?? "").trim();
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const knownActions = Array.from(new Set(Object.values(AuditAction))).sort();
  const actionValid = !action || knownActions.includes(action as (typeof knownActions)[number]);
  const safeAction = actionValid ? action : "";

  const where: Prisma.AuditLogWhereInput = {
    ...(safeAction ? { action: safeAction } : {}),
    ...(outcome === undefined ? {} : { success: outcome }),
    ...(userId
      ? {
          OR: [
            { actorUserId: userId },
            { AND: [{ targetType: "user" }, { targetId: userId }] },
          ],
        }
      : {}),
  };

  const [entries, total, actorGroups, targetGroups, selectedUser] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { email: true, firstName: true, lastName: true } } },
    }),
    db.auditLog.count({ where }),
    db.auditLog.groupBy({
      by: ["actorUserId"],
      where: { actorUserId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { actorUserId: "desc" } },
      take: USER_OPTION_CAP,
    }),
    db.auditLog.groupBy({
      by: ["targetId"],
      where: { targetType: "user", targetId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { targetId: "desc" } },
      take: USER_OPTION_CAP,
    }),
    userId
      ? db.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      : Promise.resolve(null),
  ]);

  const relatedIds = [
    ...new Set(
      [
        ...actorGroups.map((row) => row.actorUserId),
        ...targetGroups.map((row) => row.targetId),
        selectedUser?.id,
      ].filter((value): value is string => Boolean(value))
    ),
  ].slice(0, USER_OPTION_CAP);

  const relatedUsers =
    relatedIds.length === 0
      ? []
      : await db.user.findMany({
          where: { id: { in: relatedIds } },
          select: { id: true, email: true, firstName: true, lastName: true },
          orderBy: { email: "asc" },
        });

  const userOptions = [
    { value: "", label: "All users" },
    ...relatedUsers.map((user) => ({
      value: user.id,
      label: memberLabel(user),
      hint: user.email,
    })),
  ];

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safeUser = selectedUser?.id ?? (relatedUsers.some((user) => user.id === userId) ? userId : "");

  return (
    <DashShell role={role} currentPath="/admin/audit">
      <main className="pt-main">
        <div className="pt-pagehead">
          <div>
            <h1 className="pt-title">Audit log</h1>
            <p className="pt-subtitle">
              Append-only. Rows cannot be edited or deleted, including from this app. Filter by
              action, outcome, or the member involved as actor or target.
            </p>
          </div>
          <span className="pt-count">{total}</span>
        </div>

        <section className="pt-card pt-card--flush pt-audit">
          <form method="get" className="pt-toolbar">
            <div className="pt-toolbar__field">
              <label className="pt-label" htmlFor="action">
                Action
              </label>
              <PortalSelect
                id="action"
                name="action"
                defaultValue={safeAction}
                searchable
                searchPlaceholder="Search actions"
                options={[
                  { value: "", label: "All actions" },
                  ...knownActions.map((value) => ({
                    value,
                    label: auditActionLabel(value),
                  })),
                ]}
              />
            </div>
            <div className="pt-toolbar__field">
              <label className="pt-label" htmlFor="user">
                User
              </label>
              <PortalSelect
                id="user"
                name="user"
                defaultValue={safeUser}
                searchable
                searchPlaceholder="Search members"
                remoteSearchUrl="/api/admin/users/options"
                options={userOptions}
              />
            </div>
            <div className="pt-toolbar__field pt-toolbar__field--sm">
              <label className="pt-label" htmlFor="outcome">
                Outcome
              </label>
              <PortalSelect
                id="outcome"
                name="outcome"
                defaultValue={outcomeRaw === "ok" || outcomeRaw === "failed" ? outcomeRaw : ""}
                options={[
                  { value: "", label: "Any" },
                  { value: "ok", label: "Succeeded" },
                  { value: "failed", label: "Failed" },
                ]}
              />
            </div>
            <button type="submit" className="pt-btn pt-btn--secondary">
              Apply
            </button>
          </form>

          {entries.length === 0 ? (
            <p className="pt-empty">No audit entries match these filters.</p>
          ) : (
            <>
              <div className="pt-audit__cols" aria-hidden="true">
                <span>When</span>
                <span>Event</span>
                <span>Actor</span>
                <span>Target</span>
              </div>
              <div className="pt-audit__list">
                {entries.map((entry) => {
                  const chips = auditChips(entry.metadata);
                  return (
                    <article className="pt-audit__row" key={entry.id}>
                      <time className="pt-audit__when" dateTime={entry.createdAt.toISOString()}>
                        <span className="pt-audit__date">{formatDay(entry.createdAt)}</span>
                        <span className="pt-audit__clock">{formatClock(entry.createdAt)}</span>
                      </time>
                      <div className="pt-audit__event">
                        <span
                          className={`pt-badge ${entry.success ? "pt-badge--success" : "pt-badge--danger"}`}
                        >
                          {auditActionLabel(entry.action)}
                        </span>
                        {chips.length ? (
                          <ul className="pt-chips">
                            {chips.map((chip) => (
                              <li key={`${entry.id}-${chip.label}`}>
                                <span>{chip.label}</span> {chip.value}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <div className="pt-audit__who">
                        <span className="pt-audit__email">
                          {entry.actor ? memberLabel(entry.actor) : (entry.actorClerkId ?? "System")}
                        </span>
                        {entry.actor?.email && (entry.actor.firstName || entry.actor.lastName) ? (
                          <span className="pt-audit__meta">{entry.actor.email}</span>
                        ) : null}
                        {entry.actorRole ? (
                          <span className="pt-audit__meta">{entry.actorRole.replace(/_/g, " ")}</span>
                        ) : null}
                      </div>
                      <div className="pt-audit__target">
                        <span className="pt-audit__email">
                          {entry.targetType ? entry.targetType.replace(/_/g, " ") : "—"}
                        </span>
                        {entry.targetId ? (
                          <span className="pt-audit__meta" title={entry.targetId}>
                            {shortId(entry.targetId)}
                          </span>
                        ) : null}
                        {entry.ip ? <span className="pt-audit__meta">{entry.ip}</span> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          <Pagination
            page={Math.min(page, pages)}
            pages={pages}
            total={total}
            pageSize={PAGE_SIZE}
            hrefFor={(next) =>
              auditHref({
                page: next,
                action: safeAction || undefined,
                outcome: outcomeRaw === "ok" || outcomeRaw === "failed" ? outcomeRaw : undefined,
                user: safeUser || undefined,
              })
            }
          />
        </section>
      </main>
    </DashShell>
  );
}
