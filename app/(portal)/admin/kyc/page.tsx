import type { Metadata } from "next";
import { KycStatus } from "@prisma/client";
import { requirePageSuperAdmin } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { getVerificationPolicy } from "@/lib/verification-policy";
import { DashShell } from "@/components/portal/DashShell";
import { Pagination } from "@/components/portal/Pagination";
import { KycBadge } from "@/components/portal/StatusBadge";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { KycReviewActions } from "@/components/portal/AdminActions";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { formatDay, formatDayTime } from "@/lib/format-date";

export const metadata: Metadata = { title: "Verification queue" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 8;

export default async function AdminKycPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
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
  const policy = getVerificationPolicy();

  if (!policy.didit) {
    return (
      <DashShell role={role} currentPath="/admin/kyc">
        <main className="pt-main">
          <h1 className="pt-title">Verification queue</h1>
          <div className="pt-alert pt-alert--info">
            <p className="pt-alert__title">Didit is off on this instance</p>
            <p>
              There is no document review queue while <code>VERIFICATION_DIDIT</code> is false or
              Didit keys are missing. Members use PAN or mobile OTP instead, depending on env.
            </p>
          </div>
        </main>
      </DashShell>
    );
  }

  const params = await searchParams;

  const filter =
    params.status && params.status in KycStatus ? (params.status as KycStatus) : KycStatus.IN_REVIEW;
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const [records, total] = await Promise.all([
    db.kycVerification.findMany({
      where: { status: filter },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: true },
    }),
    db.kycVerification.count({ where: { status: filter } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <DashShell role={role} currentPath="/admin/kyc">
      <main className="pt-main">
        <h1 className="pt-title">Verification queue</h1>
        <p className="pt-subtitle">
          {total} session{total === 1 ? "" : "s"} Didit could not decide automatically. Approving
          here promotes the member to verified and emails them, exactly as a signed webhook
          decision would.
        </p>

        <form method="get" className="pt-card" style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "0 0 220px" }}>
              <label className="pt-label" htmlFor="status">
                Status
              </label>
              <PortalSelect
                id="status"
                name="status"
                defaultValue={filter}
                options={Object.values(KycStatus).map((value) => ({
                  value,
                  label: value.replace(/_/g, " ").toLowerCase(),
                }))}
              />
            </div>
            <button type="submit" className="pt-btn pt-btn--secondary">
              Apply
            </button>
          </div>
        </form>

        <section className="pt-card pt-card--flush">
          {records.length === 0 ? (
            <p className="pt-empty">
              Nothing with status {filter.replace(/_/g, " ").toLowerCase()}.
            </p>
          ) : (
            <div className="pt-table-wrap">
              <table className="pt-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Session</th>
                    <th>Status</th>
                    <th>Signature</th>
                    <th>Submitted</th>
                    <th style={{ textAlign: "right" }}>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <div style={{ fontSize: 13.5 }}>
                          {[record.user.firstName, record.user.lastName].filter(Boolean).join(" ") ||
                            "—"}
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
                          {record.user.email}
                        </div>
                      </td>
                      <td className="pt-table__mono">
                        {record.diditSessionId.slice(0, 12)}…
                        {record.sessionNumber ? (
                          <div style={{ color: "var(--ink-faint)" }}>#{record.sessionNumber}</div>
                        ) : null}
                      </td>
                      <td>
                        <KycBadge status={record.status} />
                      </td>
                      <td>
                        {record.signatureScheme ? (
                          <span
                            className={`pt-badge ${record.signatureScheme === "SIMPLE" ? "pt-badge--warning" : "pt-badge--neutral"}`}
                            title={
                              record.signatureScheme === "SIMPLE"
                                ? "Decision body was not signed; it was re-fetched from the Didit API"
                                : "Decision body was cryptographically signed"
                            }
                          >
                            {record.signatureScheme}
                          </span>
                        ) : (
                          <span style={{ color: "var(--ink-faint)", fontSize: 12.5 }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
                        {formatDayTime(record.createdAt)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {record.status === KycStatus.IN_REVIEW ||
                        record.status === KycStatus.IN_PROGRESS ? (
                          <KycReviewActions kycId={record.id} />
                        ) : (
                          <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
                            {record.reviewedAt
                              ? `Reviewed ${formatDay(record.reviewedAt)}`
                              : "Decided automatically"}
                          </div>
                        )}
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
          hrefFor={(next) => `/admin/kyc?page=${next}&status=${filter}`}
        />
      </main>
    </DashShell>
  );
}
