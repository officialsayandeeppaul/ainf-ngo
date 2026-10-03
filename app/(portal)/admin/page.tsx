import type { Metadata } from "next";
import Link from "next/link";
import { KycStatus, Role, UserStatus } from "@prisma/client";
import { requirePageSuperAdmin } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { isClerkConfigured, isDatabaseConfigured, isRedisConfigured } from "@/lib/env";
import { getVerificationPolicy } from "@/lib/verification-policy";
import { getSupportBanner, toSupportBannerView } from "@/lib/support-banner";
import { DashShell } from "@/components/portal/DashShell";
import { Pagination } from "@/components/portal/Pagination";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { SupportBannerEditor } from "@/components/portal/SupportBannerEditor";
import { formatDayTime } from "@/lib/format-date";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

const ACTIVITY_PAGE_SIZE = 8;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!isClerkConfigured) {
    return (
      <SetupNotice
        feature="Clerk authentication"
        keys={["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]}
      />
    );
  }
  if (!isDatabaseConfigured) {
    return <SetupNotice feature="The account database" keys={["DATABASE_URL", "DIRECT_URL"]} />;
  }

  const { role } = await requirePageSuperAdmin();
  const policy = getVerificationPolicy();
  const params = await searchParams;
  const activityPage = Math.max(1, Number(params.page ?? "1") || 1);

  const [
    totalUsers,
    verifiedUsers,
    superAdmins,
    suspended,
    awaitingReview,
    declined,
    panVerified,
    diditSessions,
    diditApproved,
    panAttempts,
    otpVerified,
    recentAudit,
    auditTotal,
    failedWebhooks,
    supportBannerRow,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: Role.VERIFIED_USER } }),
    db.user.count({ where: { role: Role.SUPER_ADMIN } }),
    db.user.count({ where: { status: { not: UserStatus.ACTIVE } } }),
    db.kycVerification.count({ where: { status: KycStatus.IN_REVIEW } }),
    db.user.count({ where: { kycStatus: KycStatus.DECLINED } }),
    db.user.count({ where: { panVerified: true } }),
    db.kycVerification.count(),
    db.kycVerification.count({ where: { status: KycStatus.APPROVED } }),
    db.panVerification.count(),
    db.auditLog.count({ where: { action: "otp.verified", success: true } }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (activityPage - 1) * ACTIVITY_PAGE_SIZE,
      take: ACTIVITY_PAGE_SIZE,
    }),
    db.auditLog.count(),
    db.webhookEvent.count({ where: { error: { not: null } } }),
    getSupportBanner(),
  ]);
  const activityPages = Math.max(1, Math.ceil(auditTotal / ACTIVITY_PAGE_SIZE));
  const supportBanner = toSupportBannerView(supportBannerRow);

  return (
    <DashShell role={role} currentPath="/admin">
      <main className="pt-main">
        <h1 className="pt-title">Overview</h1>
        <p className="pt-subtitle">
          Roles are authoritative in Postgres and mirrored to Clerk. Every privileged action on
          these pages is written to the append-only audit log.
        </p>

        {!isRedisConfigured ? (
          <div className="pt-alert pt-alert--warning">
            <p className="pt-alert__title">Rate limiting is not backed by Redis</p>
            <p>
              Set <code>UPSTASH_REDIS_REST_URL</code> and <code>UPSTASH_REDIS_REST_TOKEN</code>.
              In development an in-memory fallback is used; in production requests to rate-limited
              endpoints are rejected outright.
            </p>
          </div>
        ) : null}

        {failedWebhooks > 0 ? (
          <div className="pt-alert pt-alert--error">
            <p className="pt-alert__title">
              {failedWebhooks} webhook event{failedWebhooks === 1 ? "" : "s"} failed processing
            </p>
            <p>Inspect the WebhookEvent table for the recorded error.</p>
          </div>
        ) : null}

        <div className="pt-grid pt-grid--3" style={{ marginBottom: 18 }}>
          <div className="pt-stat">
            <p className="pt-stat__label">Total users</p>
            <p className="pt-stat__value">{totalUsers}</p>
          </div>
          <div className="pt-stat">
            <p className="pt-stat__label">Verified members</p>
            <p className="pt-stat__value">{verifiedUsers}</p>
          </div>
          {policy.pan ? (
            <div className="pt-stat">
              <p className="pt-stat__label">PAN verified</p>
              <p className="pt-stat__value">{panVerified}</p>
            </div>
          ) : null}
          {policy.didit ? (
            <div className="pt-stat">
              <p className="pt-stat__label">Awaiting review</p>
              <p className="pt-stat__value">{awaitingReview}</p>
            </div>
          ) : null}
          <div className="pt-stat">
            <p className="pt-stat__label">Declined</p>
            <p className="pt-stat__value">{declined}</p>
          </div>
          <div className="pt-stat">
            <p className="pt-stat__label">Suspended</p>
            <p className="pt-stat__value">{suspended}</p>
          </div>
          <div className="pt-stat">
            <p className="pt-stat__label">Super admins</p>
            <p className="pt-stat__value">{superAdmins}</p>
          </div>
        </div>

        <div className="pt-grid pt-grid--2" style={{ marginBottom: 18 }}>
          <section className="pt-card">
            <h2 className="pt-section-title">Verification methods</h2>
            <p className="pt-hint" style={{ marginTop: 0 }}>
              Driven by environment variables. Members only see methods that are on.
            </p>
            <dl className="pt-kv" style={{ marginTop: 14 }}>
              <dt>Didit (ID + selfie)</dt>
              <dd>
                {policy.didit ? (
                  <span className="pt-badge pt-badge--success">on</span>
                ) : (
                  <span className="pt-badge pt-badge--neutral">off</span>
                )}
                <span className="pt-hint" style={{ display: "block", marginTop: 4 }}>
                  {diditApproved} approved · {diditSessions} session{diditSessions === 1 ? "" : "s"}{" "}
                  stored
                </span>
              </dd>
              <dt>APITXT PAN</dt>
              <dd>
                {policy.pan ? (
                  <span className="pt-badge pt-badge--success">on</span>
                ) : (
                  <span className="pt-badge pt-badge--neutral">off</span>
                )}
                <span className="pt-hint" style={{ display: "block", marginTop: 4 }}>
                  {panVerified} members verified · {panAttempts} check
                  {panAttempts === 1 ? "" : "s"}
                </span>
              </dd>
              <dt>Mobile OTP</dt>
              <dd>
                {policy.otp ? (
                  <span className="pt-badge pt-badge--success">
                    on · {policy.otpChannel === "none" ? "no delivery channel" : policy.otpChannel}
                  </span>
                ) : (
                  <span className="pt-badge pt-badge--neutral">off</span>
                )}
                <span className="pt-hint" style={{ display: "block", marginTop: 4 }}>
                  {otpVerified} successful verification{otpVerified === 1 ? "" : "s"}
                </span>
              </dd>
            </dl>
            <div className="pt-card__foot pt-btn-row">
              {policy.didit ? (
                <Link href="/admin/kyc" className="pt-btn pt-btn--secondary pt-btn--sm">
                  Verification queue{awaitingReview > 0 ? ` (${awaitingReview})` : ""}
                </Link>
              ) : null}
              <Link href="/admin/users" className="pt-btn pt-btn--ghost pt-btn--sm">
                Users
              </Link>
              <Link href="/admin/crm" className="pt-btn pt-btn--ghost pt-btn--sm">
                CRM
              </Link>
            </div>
          </section>

          <SupportBannerEditor initial={supportBanner} />

          <section className="pt-card pt-card--flush pt-grid--span">
            <div className="pt-card__head">
              <h2 className="pt-section-title" style={{ margin: 0 }}>
                Latest activity
              </h2>
              <Link
                href="/admin/audit"
                className="pt-btn pt-btn--ghost pt-btn--sm"
                style={{ marginLeft: "auto" }}
              >
                View all
              </Link>
            </div>
            {recentAudit.length === 0 ? (
              <p className="pt-empty">No audit entries yet.</p>
            ) : (
              <div className="pt-activity">
                {recentAudit.map((entry) => (
                  <div className="pt-activity__row" key={entry.id}>
                    <span className="pt-activity__action">{entry.action}</span>
                    <span className="pt-activity__time">{formatDayTime(entry.createdAt)}</span>
                    {entry.success ? (
                      <span className="pt-badge pt-badge--success">ok</span>
                    ) : (
                      <span className="pt-badge pt-badge--danger">failed</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Pagination
              page={Math.min(activityPage, activityPages)}
              pages={activityPages}
              total={auditTotal}
              pageSize={ACTIVITY_PAGE_SIZE}
              hrefFor={(next) => `/admin?page=${next}`}
            />
          </section>
        </div>
      </main>
    </DashShell>
  );
}
