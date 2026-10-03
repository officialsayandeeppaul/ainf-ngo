import type { Metadata } from "next";
import Link from "next/link";
import { requirePageSuperAdmin } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import {
  isClerkConfigured,
  isDatabaseConfigured,
  isRazorpayConfigured,
  isRazorpayWebhookConfigured,
} from "@/lib/env";
import { formatDayTime } from "@/lib/format-date";
import { formatInr } from "@/lib/membership";
import { DashShell } from "@/components/portal/DashShell";
import { MembershipOffers } from "@/components/portal/MembershipOffers";
import { MembershipStudio } from "@/components/portal/MembershipStudio";
import { SetupNotice } from "@/components/portal/SetupNotice";

export const metadata: Metadata = { title: "Plans" };
export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  if (!isClerkConfigured || !isDatabaseConfigured) {
    return (
      <SetupNotice
        feature="The portal"
        keys={["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "DATABASE_URL"]}
      />
    );
  }

  const { role } = await requirePageSuperAdmin();
  const [tiers, settings, orders, offers] = await Promise.all([
    db.membershipTier.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.membershipSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    }),
    db.membershipOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { email: true } }, tier: { select: { name: true } } },
    }),
    db.membershipOffer.findMany({
      orderBy: { createdAt: "desc" },
      include: { plans: { select: { tierId: true } } },
    }),
  ]);

  return (
    <DashShell role={role} currentPath="/admin/plans">
      <main className="pt-main">
        <h1 className="pt-title">Plans</h1>
        <p className="pt-subtitle">
        Super admins only. Set member types, the stacked include/exclude list for each plan,
        attach offers, and members can upgrade or downgrade any time with unused-time credit.
        Checkout is at{" "}
        <Link href="/account/membership">/account/membership</Link>.
        </p>
        <MembershipStudio
          tiers={tiers}
          settings={settings}
          razorpayOn={isRazorpayConfigured}
          webhookOn={isRazorpayWebhookConfigured}
        />
        <div style={{ marginTop: 18 }}>
          <MembershipOffers
            plans={tiers.map((tier) => ({ id: tier.id, name: tier.name, badge: tier.badge }))}
            offers={offers.map((offer) => ({
              id: offer.id,
              name: offer.name,
              kind: offer.kind,
              value: offer.value,
              interval: offer.interval,
              active: offer.active,
              firstCycleOnly: offer.firstCycleOnly,
              startsAt: offer.startsAt?.toISOString() ?? null,
              endsAt: offer.endsAt?.toISOString() ?? null,
              tierIds: offer.plans.map((row) => row.tierId),
            }))}
          />
        </div>

        <section className="pt-card pt-card--flush" style={{ marginTop: 18 }}>
          <div className="pt-card__head">
            <h2 className="pt-section-title" style={{ margin: 0 }}>
              Recent payments
            </h2>
          </div>
          {orders.length === 0 ? (
            <p className="pt-empty">No Razorpay orders yet.</p>
          ) : (
            <div className="pt-activity">
              {orders.map((order) => (
                <div className="pt-activity__row" key={order.id}>
                  <span className="pt-activity__action">
                    {order.user.email} · {order.tier.name} ·{" "}
                    {order.interval === "YEARLY" ? "yearly" : "monthly"} · {formatInr(order.amountPaise)}
                  </span>
                  <span className="pt-activity__time">{formatDayTime(order.createdAt)}</span>
                  {order.status === "PAID" ? (
                    <span className="pt-badge pt-badge--success">paid</span>
                  ) : order.status === "FAILED" ? (
                    <span className="pt-badge pt-badge--danger">failed</span>
                  ) : (
                    <span className="pt-badge pt-badge--warning">created</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </DashShell>
  );
}
