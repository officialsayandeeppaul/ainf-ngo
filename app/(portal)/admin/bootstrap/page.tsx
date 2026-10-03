import type { Metadata } from "next";
import Link from "next/link";
import { Role } from "@prisma/client";
import { requirePageAuth } from "@/lib/auth/guard";
import { countSuperAdmins } from "@/lib/auth/role-service";
import { hasMfaEnrolled } from "@/lib/auth/session";
import {
  env,
  isAdminMfaRequired,
  isBootstrapConfigured,
  isClerkConfigured,
  isDatabaseConfigured,
} from "@/lib/env";
import { DashShell } from "@/components/portal/DashShell";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { BootstrapForm } from "@/components/portal/BootstrapForm";

export const metadata: Metadata = { title: "Admin bootstrap" };
export const dynamic = "force-dynamic";

/**
 * Self-service super admin creation, gated by the bootstrap key.
 *
 * This page deliberately requires only a signed-in session — requiring
 * SUPER_ADMIN here would make it impossible to create the first one. The real
 * gates are enforced server-side in /api/admin/bootstrap.
 */
export default async function BootstrapPage() {
  if (!isClerkConfigured || !isDatabaseConfigured) {
    return (
      <SetupNotice
        feature="The portal"
        keys={["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "DATABASE_URL"]}
      />
    );
  }
  if (!isBootstrapConfigured) {
    return (
      <SetupNotice
        feature="Super admin bootstrap"
        keys={["SUPER_ADMIN_BOOTSTRAP_KEY", "PAN_HASH_SALT"]}
        hint={
          "Generate with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\""
        }
      />
    );
  }

  const { user, role } = await requirePageAuth("/admin/bootstrap");
  const [mfaEnabled, existingAdmins] = await Promise.all([hasMfaEnrolled(), countSuperAdmins()]);

  const alreadyAdmin = role === Role.SUPER_ADMIN;
  const blocked = existingAdmins > 0 && !env.SUPER_ADMIN_ALLOW_MULTIPLE && !alreadyAdmin;

  return (
    <DashShell role={role} currentPath="/admin/bootstrap">
      <main className="pt-main pt-main--narrow">
        <p className="pt-eyebrow">Restricted</p>
        <h1 className="pt-title">Super admin access</h1>
        <p className="pt-subtitle">
          This grants full control over every account in this instance. It requires the bootstrap
          key from the server environment
          {isAdminMfaRequired ? ", plus two-factor authentication on your own account" : ""}.
        </p>

        {alreadyAdmin ? (
          <div className="pt-card">
            <div className="pt-alert pt-alert--success" style={{ marginBottom: 14 }}>
              <p className="pt-alert__title">You already have super admin access</p>
              <p>Signed in as {user.email}.</p>
            </div>
            <Link href="/admin" className="pt-btn pt-btn--primary">
              Open admin dashboard
            </Link>
          </div>
        ) : blocked ? (
          <div className="pt-card">
            <div className="pt-alert pt-alert--warning" style={{ marginBottom: 0 }}>
              <p className="pt-alert__title">Already bootstrapped</p>
              <p>
                This instance has {existingAdmins} super admin
                {existingAdmins === 1 ? "" : "s"}. Ask an existing admin to promote your account
                from the users page, or set <code>SUPER_ADMIN_ALLOW_MULTIPLE=true</code> on the
                server if a second bootstrap is genuinely required.
              </p>
            </div>
          </div>
        ) : (
          <div className="pt-card">
            <BootstrapForm mfaEnabled={mfaEnabled} mfaRequired={isAdminMfaRequired} />
            <hr className="pt-divider" />
            <p className="pt-eyebrow">What happens on success</p>
            <ul className="pt-list">
              <li>Your role becomes SUPER_ADMIN in Postgres and is mirrored to Clerk</li>
              <li>An audit entry records your identity, IP, and user agent</li>
              <li>A security alert email is sent to the configured address</li>
            </ul>
          </div>
        )}
      </main>
    </DashShell>
  );
}
