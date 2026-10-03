import type { Metadata } from "next";
import Link from "next/link";
import { requirePageSuperAdmin } from "@/lib/auth/guard";
import { hasMfaEnrolled } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { servicesByGroup, type ServiceRow } from "@/lib/service-status";
import { getVerificationPolicy } from "@/lib/verification-policy";
import { DashShell } from "@/components/portal/DashShell";
import { SetupNotice } from "@/components/portal/SetupNotice";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

const GROUP_LABEL: Record<ServiceRow["group"], string> = {
  auth: "Authentication",
  data: "Data stores",
  verification: "Verification",
  messaging: "Messaging",
  payments: "Payments",
  security: "Security",
};

export default async function AdminSettingsPage() {
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
  const groups = servicesByGroup();
  const [mfaOnThisAccount, mfaUsers, totalUsers] = await Promise.all([
    hasMfaEnrolled(),
    db.user.count({ where: { mfaEnabled: true } }),
    db.user.count(),
  ]);

  return (
    <DashShell role={role} currentPath="/admin/settings">
      <main className="pt-main">
        <h1 className="pt-title">Settings</h1>
        <p className="pt-subtitle">
          Live status of every integration. Toggles are environment variables — true turns a
          method on, false turns it off, unset means auto.
        </p>

        <section className="pt-card" style={{ marginBottom: 18 }}>
          <h2 className="pt-section-title">MFA</h2>
          <dl className="pt-kv">
            <dt>Clerk TOTP</dt>
            <dd>
              <span className="pt-badge pt-badge--success">integrated</span>
              <span className="pt-hint" style={{ display: "block", marginTop: 4 }}>
                Members enrol from the avatar menu. Super admin bootstrap is blocked until TOTP is
                on.
              </span>
            </dd>
            <dt>This account</dt>
            <dd>
              {mfaOnThisAccount ? (
                <span className="pt-badge pt-badge--success">enrolled</span>
              ) : (
                <span className="pt-badge pt-badge--warning">not enrolled</span>
              )}
            </dd>
            <dt>Users with MFA</dt>
            <dd>
              {mfaUsers} of {totalUsers}
            </dd>
          </dl>
        </section>

        <section className="pt-card" style={{ marginBottom: 18 }}>
          <h2 className="pt-section-title">Verification flags</h2>
          <p className="pt-hint" style={{ marginTop: 0 }}>
            <code>VERIFICATION_DIDIT</code>, <code>VERIFICATION_PAN</code>,{" "}
            <code>VERIFICATION_OTP</code> — true / false / unset (auto).
          </p>
          <dl className="pt-kv" style={{ marginTop: 14 }}>
            <dt>Didit</dt>
            <dd>{policy.didit ? onBadge() : offBadge()}</dd>
            <dt>PAN</dt>
            <dd>{policy.pan ? onBadge() : offBadge()}</dd>
            <dt>OTP</dt>
            <dd>
              {policy.otp ? (
                <span className="pt-badge pt-badge--success">on · {policy.otpChannel}</span>
              ) : (
                offBadge()
              )}
            </dd>
          </dl>
        </section>

        <section className="pt-card" style={{ marginBottom: 18 }}>
          <h2 className="pt-section-title">Membership</h2>
          <p className="pt-hint" style={{ marginTop: 0 }}>
            Super admins only. Member types, badges, monthly price, and yearly discount (percent or
            a flat rupee amount). Members cannot pay until checkout is turned on.
          </p>
          <div className="pt-btn-row" style={{ marginTop: 14 }}>
            <Link href="/admin/plans" className="pt-btn pt-btn--primary">
              Open membership studio
            </Link>
          </div>
        </section>

        {(Object.keys(GROUP_LABEL) as ServiceRow["group"][]).map((group) => (
          <section key={group} className="pt-card pt-card--flush" style={{ marginBottom: 18 }}>
            <div className="pt-card__head">
              <h2 className="pt-section-title" style={{ margin: 0 }}>
                {GROUP_LABEL[group]}
              </h2>
            </div>
            <div className="pt-table-wrap">
              <table className="pt-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>State</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {groups[group].map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.on ? onBadge() : offBadge()}</td>
                      <td className="pt-hint" style={{ margin: 0 }}>
                        {row.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <p className="pt-hint">
          Secrets stay in <code>.env.local</code>.{" "}
          <Link href="/admin">Back to overview</Link>.
        </p>
      </main>
    </DashShell>
  );
}

function onBadge() {
  return <span className="pt-badge pt-badge--success">on</span>;
}

function offBadge() {
  return <span className="pt-badge pt-badge--neutral">off</span>;
}
