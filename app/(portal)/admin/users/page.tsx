import type { Metadata } from "next";
import Link from "next/link";
import { Prisma, Role } from "@prisma/client";
import { AuditAction } from "@/lib/audit";
import { requirePageSuperAdmin } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import {
  emptyOtp,
  otpCountsFromActions,
  summariseUserVerification,
} from "@/lib/verification-summary";
import { DashShell } from "@/components/portal/DashShell";
import { Pagination } from "@/components/portal/Pagination";
import { RoleBadge } from "@/components/portal/PortalChrome";
import { UserStatusBadge } from "@/components/portal/StatusBadge";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { formatDay } from "@/lib/format-date";
import { expireDueMemberships } from "@/lib/membership-pay";
import { membershipIsLive } from "@/lib/membership-state";
import { UserRowActions } from "@/components/portal/AdminActions";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { VerifyMethodStack } from "@/components/portal/VerifyMethods";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 8;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>;
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
  const params = await searchParams;

  const query = (params.q ?? "").trim();
  const roleFilter = params.role && params.role in Role ? (params.role as Role) : undefined;
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const where: Prisma.UserWhereInput = {
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" as const } },
            { firstName: { contains: query, mode: "insensitive" as const } },
            { lastName: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        membershipTier: { select: { badge: true, badgeColor: true, name: true } },
        kycVerifications: {
          orderBy: { createdAt: "desc" },
          select: { status: true, createdAt: true },
        },
        panVerifications: {
          orderBy: { createdAt: "desc" },
          select: {
            status: true,
            panLast4: true,
            nameMatch: true,
            dobMatch: true,
            createdAt: true,
          },
        },
      },
    }),
    db.user.count({ where }),
  ]);

  const otpGrouped =
    users.length === 0
      ? []
      : await db.auditLog.groupBy({
          by: ["actorUserId", "action"],
          where: {
            actorUserId: { in: users.map((user) => user.id) },
            action: { in: [AuditAction.OtpSent, AuditAction.OtpVerified, AuditAction.OtpFailed] },
          },
          _count: { _all: true },
        });

  const otpByUser = new Map<string, ReturnType<typeof emptyOtp>>();
  for (const row of otpGrouped) {
    if (!row.actorUserId) continue;
    const current = otpByUser.get(row.actorUserId) ?? emptyOtp();
    const next = otpCountsFromActions([{ action: row.action, count: row._count._all }]);
    otpByUser.set(row.actorUserId, {
      sent: current.sent + next.sent,
      verified: current.verified + next.verified,
      failed: current.failed + next.failed,
    });
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <DashShell role={viewerRole} currentPath="/admin/users">
      <main className="pt-main">
        <h1 className="pt-title">Users</h1>
        <p className="pt-subtitle">
          {total} account{total === 1 ? "" : "s"}. Changing a role updates Postgres and mirrors to
          Clerk immediately; the change is audited with your identity attached.
        </p>

        <form method="get" className="pt-card" style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 220px" }}>
              <label className="pt-label" htmlFor="q">
                Search
              </label>
              <input
                id="q"
                name="q"
                className="pt-input"
                defaultValue={query}
                placeholder="Email or name"
              />
            </div>
            <div style={{ flex: "0 0 180px" }}>
              <label className="pt-label" htmlFor="role">
                Role
              </label>
              <PortalSelect
                id="role"
                name="role"
                defaultValue={roleFilter ?? ""}
                options={[
                  { value: "", label: "All roles" },
                  { value: Role.USER, label: "Member" },
                  { value: Role.VERIFIED_USER, label: "Verified member" },
                  { value: Role.SUPER_ADMIN, label: "Super admin" },
                ]}
              />
            </div>
            <button type="submit" className="pt-btn pt-btn--secondary">
              Apply
            </button>
          </div>
        </form>

        <section className="pt-card pt-card--flush">
          {users.length === 0 ? (
            <p className="pt-empty">No users match these filters.</p>
          ) : (
            <div className="pt-table-wrap">
              <table className="pt-table pt-table--users">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Membership</th>
                    <th>Verification</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <Link href={`/admin/crm/${user.id}`} className="pt-user-link">
                          <div style={{ fontSize: 13.5 }}>
                            {[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
                          </div>
                          <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>{user.email}</div>
                        </Link>
                      </td>
                      <td>
                        <RoleBadge role={user.role} />
                      </td>
                      <td>
                        {membershipIsLive(user) && user.membershipTier ? (
                          <span
                            className="pt-plan-badge"
                            style={{
                              background: `${user.membershipTier.badgeColor}22`,
                              color: user.membershipTier.badgeColor,
                            }}
                          >
                            {user.membershipTier.badge}
                          </span>
                        ) : (
                          <span className="pt-pill pt-pill--muted">No plan</span>
                        )}
                      </td>
                      <td>
                        <VerifyMethodStack
                          compact
                          summary={summariseUserVerification({
                            kycStatus: user.kycStatus,
                            phone: user.phone,
                            kyc: user.kycVerifications,
                            pan: user.panVerifications,
                            otp: otpByUser.get(user.id) ?? emptyOtp(),
                          })}
                        />
                      </td>
                      <td>
                        <UserStatusBadge status={user.status} />
                      </td>
                      <td style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
                        {formatDay(user.createdAt)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <UserRowActions
                          userId={user.id}
                          role={user.role}
                          status={user.status}
                          isSelf={user.id === viewer.id}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Pagination
          page={page}
          pages={pages}
          total={total}
          pageSize={PAGE_SIZE}
          hrefFor={(next) =>
            `/admin/users?page=${next}${query ? `&q=${encodeURIComponent(query)}` : ""}${roleFilter ? `&role=${roleFilter}` : ""}`
          }
        />
      </main>
    </DashShell>
  );
}
