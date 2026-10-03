import type { Metadata } from "next";
import Link from "next/link";
import { KycStatus, Role } from "@prisma/client";
import { requirePageAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { DashShell } from "@/components/portal/DashShell";
import { getVerificationPolicy } from "@/lib/verification-policy";
import { RoleBadge } from "@/components/portal/PortalChrome";
import { KycBadge, UserStatusBadge } from "@/components/portal/StatusBadge";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { formatDay } from "@/lib/format-date";
import { formatInr } from "@/lib/membership";
import { membershipIsLive } from "@/lib/membership-state";
import { getUserGiving } from "@/lib/user-donations";

export const metadata: Metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  if (!isClerkConfigured) {
    return (
      <SetupNotice
        feature="Clerk authentication"
        keys={["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]}
        hint="Run `clerk env pull --file .env.local` to fill these in."
      />
    );
  }
  if (!isDatabaseConfigured) {
    return (
      <SetupNotice
        feature="The account database"
        keys={["DATABASE_URL", "DIRECT_URL"]}
        hint="Create a Neon project, paste both connection strings, then run `npm run db:deploy`."
      />
    );
  }

  const { user, role } = await requirePageAuth("/account");
  const policy = getVerificationPolicy();

  const [latestKyc, panRecord, membershipTier, giving] = await Promise.all([
    db.kycVerification.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    db.panVerification.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    user.membershipTierId
      ? db.membershipTier.findUnique({ where: { id: user.membershipTierId } })
      : Promise.resolve(null),
    getUserGiving(user.email),
  ]);

  const verified = role === Role.VERIFIED_USER || role === Role.SUPER_ADMIN;
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <DashShell role={role} currentPath="/account">
      <main className="pt-main">
        <h1 className="pt-title">{displayName}</h1>
        <p className="pt-subtitle">
          {verified
            ? "Your identity is verified. You have full access to member services."
            : "Complete identity verification to unlock verified member access."}
        </p>

        <div className="pt-grid pt-grid--3" style={{ marginBottom: 22 }}>
          <div className="pt-stat">
            <p className="pt-stat__label">Account type</p>
            <div style={{ marginTop: 8 }}>
              <RoleBadge role={role} />
            </div>
          </div>
          <div className="pt-stat">
            <p className="pt-stat__label">Identity verification</p>
            <div style={{ marginTop: 8 }}>
              <KycBadge status={user.kycStatus} />
            </div>
          </div>
          <div className="pt-stat">
            <p className="pt-stat__label">Account status</p>
            <div style={{ marginTop: 8 }}>
              <UserStatusBadge status={user.status} />
            </div>
          </div>
        </div>

        <div className="pt-grid pt-grid--2">
          <section className="pt-card">
            <h2 className="pt-section-title">Profile</h2>
            <dl className="pt-kv">
              <dt>Name</dt>
              <dd>{displayName}</dd>
              <dt>Email</dt>
              <dd>{user.email}</dd>
              <dt>Phone</dt>
              <dd>{user.phone ?? <span style={{ color: "var(--ink-faint)" }}>Not added</span>}</dd>
              <dt>Two-factor</dt>
              <dd>
                {user.mfaEnabled ? (
                  <span className="pt-badge pt-badge--success">
                    <span className="pt-badge__dot" aria-hidden="true" />
                    Enabled
                  </span>
                ) : (
                  <span className="pt-badge pt-badge--warning">
                    <span className="pt-badge__dot" aria-hidden="true" />
                    Not enabled
                  </span>
                )}
              </dd>
              <dt>Member since</dt>
              <dd>{formatDay(user.createdAt)}</dd>
              <dt>Membership</dt>
              <dd>
                {membershipIsLive(user) && membershipTier && user.membershipExpiresAt ? (
                  <>
                    <span
                      className="pt-plan-badge"
                      style={{
                        background: `${membershipTier.badgeColor}22`,
                        color: membershipTier.badgeColor,
                      }}
                    >
                      {membershipTier.badge}
                    </span>
                    <span className="pt-hint" style={{ display: "block", marginTop: 6 }}>
                      {membershipTier.name} · until {formatDay(user.membershipExpiresAt)}
                    </span>
                  </>
                ) : (
                  <span style={{ color: "var(--ink-faint)" }}>No live badge</span>
                )}
              </dd>
            </dl>
            <p className="pt-hint">
              Name, email, password, and two-factor settings are managed through the account menu
              in the header.
            </p>
          </section>

          <section className="pt-card">
            <h2 className="pt-section-title">Identity verification</h2>

            {user.kycStatus === KycStatus.APPROVED ? (
              <div className="pt-alert pt-alert--success">
                <p className="pt-alert__title">Verified</p>
                <p>
                  Approved
                  {latestKyc?.completedAt
                    ? ` on ${formatDay(latestKyc.completedAt)}`
                    : ""}
                  .
                </p>
              </div>
            ) : user.kycStatus === KycStatus.IN_REVIEW ? (
              <div className="pt-alert pt-alert--warning">
                <p className="pt-alert__title">Under review</p>
                <p>Our team is reviewing your documents. You will be emailed when it completes.</p>
              </div>
            ) : user.kycStatus === KycStatus.DECLINED ? (
              <div className="pt-alert pt-alert--error">
                <p className="pt-alert__title">Not approved</p>
                <p>Your last attempt could not be verified. You can try again.</p>
              </div>
            ) : (
              <p className="pt-hint" style={{ marginTop: 0, marginBottom: 16 }}>
                {policy.didit
                  ? "First we confirm a government ID and selfie. PAN is collected only after that is approved."
                  : policy.otp
                    ? "This instance verifies members with a one-time mobile code."
                    : policy.pan
                      ? "Submit your PAN to become a verified member."
                      : "No verification method is enabled on this instance."}
              </p>
            )}

            {policy.pan ? (
              <dl className="pt-kv" style={{ marginTop: 16 }}>
                <dt>PAN</dt>
                <dd>
                  {panRecord ? (
                    <>
                      •••••{panRecord.panLast4}{" "}
                      <span style={{ color: "var(--ink-faint)", fontSize: 12.5 }}>
                        ({panRecord.status.toLowerCase()})
                      </span>
                    </>
                  ) : (
                    <span style={{ color: "var(--ink-faint)" }}>
                      {policy.didit && user.kycStatus !== KycStatus.APPROVED
                        ? "Unlocks after identity approval"
                        : "Not submitted"}
                    </span>
                  )}
                </dd>
              </dl>
            ) : null}

            <div className="pt-btn-row" style={{ marginTop: 18 }}>
              <Link href="/account/membership" className="pt-btn pt-btn--secondary">
                Membership plans
              </Link>
              {policy.didit || policy.pan || policy.otp ? (
                <Link href="/account/verify" className="pt-btn pt-btn--primary">
                  {user.kycStatus === KycStatus.APPROVED ? "View verification" : "Start verification"}
                </Link>
              ) : null}
            </div>
          </section>
        </div>

        <section className="pt-card" style={{ marginTop: 18 }}>
          <h2 className="pt-section-title">Your giving</h2>
          {giving.summary.giftCount > 0 ? (
            <>
              <dl className="pt-kv">
                <dt>Total given</dt>
                <dd>{formatInr(giving.summary.totalPaise)}</dd>
                <dt>Gifts</dt>
                <dd>{giving.summary.giftCount}</dd>
                <dt>This year</dt>
                <dd>{formatInr(giving.summary.thisYearPaise)}</dd>
                {giving.summary.lastGiftAt ? (
                  <>
                    <dt>Last gift</dt>
                    <dd>{formatDay(giving.summary.lastGiftAt)}</dd>
                  </>
                ) : null}
              </dl>
              <div className="pt-btn-row" style={{ marginTop: 16 }}>
                <Link href="/account/donations" className="pt-btn pt-btn--secondary">
                  View gift history
                </Link>
                <Link href="/donate-now" className="pt-btn pt-btn--primary">
                  Give again
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="pt-hint" style={{ marginTop: 0 }}>
                You have not made a gift under {user.email} yet. Gifts you make with this email
                will appear here with a receipt you can open any time.
              </p>
              <div className="pt-btn-row" style={{ marginTop: 14 }}>
                <Link href="/donate-now" className="pt-btn pt-btn--primary">
                  Make a gift
                </Link>
              </div>
            </>
          )}
        </section>

        {role === Role.SUPER_ADMIN ? (
          <section className="pt-card" style={{ marginTop: 18 }}>
            <h2 className="pt-section-title">Administration</h2>
            <p className="pt-hint" style={{ marginTop: 0 }}>
              You have super admin access to this instance.
            </p>
            <div className="pt-btn-row" style={{ marginTop: 14 }}>
              <Link href="/admin" className="pt-btn pt-btn--secondary">
                Open admin dashboard
              </Link>
            </div>
          </section>
        ) : null}
      </main>
    </DashShell>
  );
}
