import type { Metadata } from "next";
import Link from "next/link";
import { KycStatus, MembershipOrderStatus, Role, UserStatus } from "@prisma/client";
import { requirePageSuperAdmin } from "@/lib/auth/guard";
import { CRM_PAGE_SIZE, crmListHref, crmUserOrder, crmUserWhere, parseCrmQuery } from "@/lib/crm-filters";
import { paidByMonth, paidByPlan } from "@/lib/crm-metrics";
import { db } from "@/lib/db";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { formatDay, formatDayTime } from "@/lib/format-date";
import { formatInr } from "@/lib/membership";
import { expireDueMemberships } from "@/lib/membership-pay";
import { membershipIsLive } from "@/lib/membership-state";
import { UserRowActions } from "@/components/portal/AdminActions";
import { CrmBars, CrmSpark, CrmStat } from "@/components/portal/CrmCharts";
import { DashShell } from "@/components/portal/DashShell";
import { Pagination } from "@/components/portal/Pagination";
import { RoleBadge } from "@/components/portal/PortalChrome";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { PortalDateField } from "@/components/portal/PortalDateField";
import { KycBadge, UserStatusBadge } from "@/components/portal/StatusBadge";

export const metadata: Metadata = { title: "CRM" };
export const dynamic = "force-dynamic";

export default async function AdminCrmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!isClerkConfigured || !isDatabaseConfigured) {
    return (
      <SetupNotice
        feature="The portal"
        keys={["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "DATABASE_URL"]}
      />
    );
  }

  const { role: viewerRole, user: viewer } = await requirePageSuperAdmin();
  await expireDueMemberships();
  const query = parseCrmQuery(await searchParams);
  const now = new Date();
  const where = crmUserWhere(query, now);

  const [users, total, everyone, liveCount, payingCount, verifiedCount, paid, plans, recentPaid] =
    await Promise.all([
      db.user.findMany({
        where,
        orderBy: crmUserOrder(query.sort),
        skip: (query.page - 1) * CRM_PAGE_SIZE,
        take: CRM_PAGE_SIZE,
        include: {
          membershipTier: { select: { badge: true, badgeColor: true, name: true } },
        },
      }),
      db.user.count({ where }),
      db.user.count(),
      db.user.count({
        where: { membershipTierId: { not: null }, membershipExpiresAt: { gt: now } },
      }),
      db.user.count({
        where: { membershipOrders: { some: { status: MembershipOrderStatus.PAID } } },
      }),
      db.user.count({
        where: { OR: [{ role: Role.VERIFIED_USER }, { kycStatus: KycStatus.APPROVED }] },
      }),
      db.membershipOrder.aggregate({
        where: { status: MembershipOrderStatus.PAID },
        _sum: { amountPaise: true },
        _count: true,
      }),
      db.membershipTier.findMany({
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, badge: true },
      }),
      db.membershipOrder.findMany({
        where: { status: MembershipOrderStatus.PAID },
        orderBy: { paidAt: "desc" },
        take: 400,
        select: {
          amountPaise: true,
          paidAt: true,
          createdAt: true,
          tier: { select: { name: true } },
        },
      }),
    ]);

  const paidByUser =
    users.length === 0
      ? []
      : await db.membershipOrder.groupBy({
          by: ["userId"],
          where: {
            userId: { in: users.map((user) => user.id) },
            status: MembershipOrderStatus.PAID,
          },
          _sum: { amountPaise: true },
          _count: { _all: true },
        });
  const spend = new Map(paidByUser.map((row) => [row.userId, row]));

  const monthPoints = paidByMonth(
    recentPaid.map((order) => ({
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      amountPaise: order.amountPaise,
    })),
    6,
    now
  );
  const planPoints = paidByPlan(
    recentPaid.map((order) => ({ tierName: order.tier.name, amountPaise: order.amountPaise }))
  );

  const pages = Math.max(1, Math.ceil(total / CRM_PAGE_SIZE));
  const paidTotal = paid._sum.amountPaise ?? 0;

  return (
    <DashShell role={viewerRole} currentPath="/admin/crm">
      <main className="pt-main">
        <h1 className="pt-title">CRM</h1>
        <p className="pt-subtitle">
          All {everyone} member{everyone === 1 ? "" : "s"} in the database
          {total !== everyone ? ` · ${total} match these filters` : ""}.
        </p>

        <form method="get" className="pt-card pt-crm-form">
          <div className="pt-crm-form__top">
            <div className="pt-crm-form__search">
              <label className="pt-label" htmlFor="q">
                Search
              </label>
              <input
                id="q"
                name="q"
                className="pt-input"
                defaultValue={query.q}
                placeholder="Email, name, phone, or Clerk id"
              />
            </div>
            <div>
              <label className="pt-label" htmlFor="sort">
                Sort
              </label>
              <PortalSelect
                id="sort"
                name="sort"
                defaultValue={query.sort}
                options={[
                  { value: "newest", label: "Newest joined" },
                  { value: "oldest", label: "Oldest joined" },
                  { value: "seen", label: "Last seen" },
                  { value: "name", label: "Name A–Z" },
                ]}
              />
            </div>
            <div className="pt-crm-form__actions">
              <button type="submit" className="pt-btn pt-btn--secondary">
                Apply
              </button>
              <Link href="/admin/crm" className="pt-btn pt-btn--ghost">
                Clear
              </Link>
            </div>
          </div>
          <div className="pt-crm-form__filters">
            <div>
              <label className="pt-label" htmlFor="role">
                Role
              </label>
              <PortalSelect
                id="role"
                name="role"
                defaultValue={query.role ?? ""}
                options={[
                  { value: "", label: "All roles" },
                  { value: Role.USER, label: "Member" },
                  { value: Role.VERIFIED_USER, label: "Verified member" },
                  { value: Role.SUPER_ADMIN, label: "Super admin" },
                ]}
              />
            </div>
            <div>
              <label className="pt-label" htmlFor="status">
                Status
              </label>
              <PortalSelect
                id="status"
                name="status"
                defaultValue={query.status ?? ""}
                options={[
                  { value: "", label: "All statuses" },
                  { value: UserStatus.ACTIVE, label: "Active" },
                  { value: UserStatus.SUSPENDED, label: "Suspended" },
                  { value: UserStatus.BANNED, label: "Banned" },
                ]}
              />
            </div>
            <div>
              <label className="pt-label" htmlFor="kyc">
                Identity
              </label>
              <PortalSelect
                id="kyc"
                name="kyc"
                defaultValue={query.kyc ?? ""}
                options={[
                  { value: "", label: "All identity states" },
                  ...Object.values(KycStatus).map((status) => ({
                    value: status,
                    label: status.toLowerCase().replaceAll("_", " "),
                  })),
                ]}
              />
            </div>
            <div>
              <label className="pt-label" htmlFor="membership">
                Membership
              </label>
              <PortalSelect
                id="membership"
                name="membership"
                defaultValue={query.membership ?? ""}
                options={[
                  { value: "", label: "All memberships" },
                  { value: "live", label: "Live" },
                  { value: "canceling", label: "Live, auto-renew off" },
                  { value: "lapsed", label: "Lapsed (paid before)" },
                  { value: "none", label: "Never paid" },
                ]}
              />
            </div>
            <div>
              <label className="pt-label" htmlFor="plan">
                Plan
              </label>
              <PortalSelect
                id="plan"
                name="plan"
                defaultValue={query.plan ?? ""}
                options={[
                  { value: "", label: "All plans" },
                  ...plans.map((plan) => ({
                    value: plan.id,
                    label: `${plan.badge} · ${plan.name}`,
                  })),
                ]}
              />
            </div>
            <div>
              <label className="pt-label" htmlFor="seen">
                Last seen
              </label>
              <PortalSelect
                id="seen"
                name="seen"
                defaultValue={query.seen ?? ""}
                options={[
                  { value: "", label: "Any activity" },
                  { value: "recent", label: "Last 7 days" },
                  { value: "stale", label: "Quiet 30+ days" },
                  { value: "never", label: "Never signed in" },
                ]}
              />
            </div>
            <div>
              <label className="pt-label" htmlFor="joinedFrom">
                Joined from
              </label>
              <PortalDateField
                id="joinedFrom"
                name="joinedFrom"
                defaultValue={query.joinedFrom ?? ""}
                placeholder="Joined from"
              />
            </div>
            <div>
              <label className="pt-label" htmlFor="joinedTo">
                Joined to
              </label>
              <PortalDateField
                id="joinedTo"
                name="joinedTo"
                defaultValue={query.joinedTo ?? ""}
                placeholder="Joined to"
              />
            </div>
          </div>
        </form>

        <div className="pt-crm-kpis">
          <CrmStat label="Members" value={String(everyone)} hint={`${total} in this view`} />
          <CrmStat label="Live badges" value={String(liveCount)} hint={`${payingCount} have paid`} />
          <CrmStat
            label="Paid to date"
            value={formatInr(paidTotal)}
            hint={`${paid._count} captured payment${paid._count === 1 ? "" : "s"}`}
          />
          <CrmStat label="Verified" value={String(verifiedCount)} hint="Didit approved or verified role" />
        </div>

        <div className="pt-grid pt-grid--2" style={{ marginBottom: 16 }}>
          <section className="pt-card">
            <h2 className="pt-section-title">Paid by month</h2>
            <CrmSpark points={monthPoints} />
          </section>
          <section className="pt-card">
            <h2 className="pt-section-title">Paid by plan</h2>
            <CrmBars items={planPoints} />
          </section>
        </div>

        <section className="pt-card pt-card--flush">
          {users.length === 0 ? (
            <p className="pt-empty">No members match these filters. Clear them to see all {everyone}.</p>
          ) : (
            <div className="pt-table-wrap">
              <table className="pt-table pt-table--crm">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Plan</th>
                    <th>Paid</th>
                    <th>Identity</th>
                    <th>Status</th>
                    <th>Seen</th>
                    <th style={{ textAlign: "right" }}>Open</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const live = membershipIsLive(user);
                    const money = spend.get(user.id);
                    return (
                      <tr key={user.id}>
                        <td>
                          <Link href={`/admin/crm/${user.id}`} className="pt-user-link">
                            <div className="pt-crm-name">
                              {[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
                            </div>
                            <div className="pt-crm-email">{user.email}</div>
                          </Link>
                        </td>
                        <td>
                          <RoleBadge role={user.role} />
                        </td>
                        <td>
                          {live && user.membershipTier && user.membershipExpiresAt ? (
                            <>
                              <span
                                className="pt-plan-badge"
                                style={{
                                  background: `${user.membershipTier.badgeColor}22`,
                                  color: user.membershipTier.badgeColor,
                                }}
                              >
                                {user.membershipTier.badge}
                              </span>
                              <div className="pt-crm-email">until {formatDay(user.membershipExpiresAt)}</div>
                            </>
                          ) : (
                            <span className="pt-crm-email">{money ? "Lapsed" : "Never paid"}</span>
                          )}
                        </td>
                        <td>
                          {money?._sum.amountPaise ? (
                            <>
                              <strong>{formatInr(money._sum.amountPaise)}</strong>
                              <div className="pt-crm-email">
                                {money._count._all} payment{money._count._all === 1 ? "" : "s"}
                              </div>
                            </>
                          ) : (
                            <span className="pt-crm-email">₹0</span>
                          )}
                        </td>
                        <td>
                          <KycBadge status={user.kycStatus} />
                        </td>
                        <td>
                          <UserStatusBadge status={user.status} />
                        </td>
                        <td>
                          <div className="pt-crm-email">
                            {user.lastSeenAt ? formatDayTime(user.lastSeenAt) : "—"}
                          </div>
                          <div className="pt-crm-email">Joined {formatDay(user.createdAt)}</div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="pt-crm-open">
                            <Link href={`/admin/crm/${user.id}`} className="pt-btn pt-btn--sm pt-btn--secondary">
                              Lifecycle
                            </Link>
                            <UserRowActions
                              userId={user.id}
                              role={user.role}
                              status={user.status}
                              isSelf={user.id === viewer.id}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Pagination
          page={query.page}
          pages={pages}
          total={total}
          pageSize={CRM_PAGE_SIZE}
          hrefFor={(next) => crmListHref(query, next)}
        />
      </main>
    </DashShell>
  );
}
