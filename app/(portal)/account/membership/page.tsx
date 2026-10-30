import type { Metadata } from "next";
import { requirePageAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { isClerkConfigured, isDatabaseConfigured, isRazorpayConfigured } from "@/lib/env";
import { formatDay, formatDayTime } from "@/lib/format-date";
import { ensureMembershipCard, loadUserMembership, previewMembershipCard } from "@/lib/membership-card";
import { formatInr } from "@/lib/membership";
import { membershipIsLive } from "@/lib/membership-state";
import { identityReadyForMembership } from "@/lib/donation-rules";
import { getVerificationPolicy } from "@/lib/verification-policy";
import { getPaymentSettings, paymentsOpenFor } from "@/lib/payment-settings";
import { loadSavedInterests } from "@/lib/saved-interests";
import Link from "next/link";
import { CardPhotoEditor } from "@/components/portal/CardPhotoEditor";
import { DashShell } from "@/components/portal/DashShell";
import { MembershipIdCard } from "@/components/portal/MembershipIdCard";
import { MembershipPay } from "@/components/portal/MembershipPay";
import { SetupNotice } from "@/components/portal/SetupNotice";

export const metadata: Metadata = { title: "Membership" };
export const dynamic = "force-dynamic";

export default async function AccountMembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  if (!isClerkConfigured || !isDatabaseConfigured) {
    return (
      <SetupNotice
        feature="The portal"
        keys={["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "DATABASE_URL"]}
      />
    );
  }

  const { user, role } = await requirePageAuth("/account/membership");
  const query = await searchParams;
  const [plans, member, orders, paymentSettings, interests] = await Promise.all([
    db.membershipTier.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    loadUserMembership(user.id),
    db.membershipOrder.findMany({
      // Orders behind an admin payment link show here once paid; until then they are a saved request.
      where: { userId: user.id, OR: [{ paymentLink: { is: null } }, { status: "PAID" }] },
      orderBy: { createdAt: "desc" },
      include: { tier: { select: { name: true } } },
    }),
    getPaymentSettings(),
    loadSavedInterests({ userId: user.id, purpose: "MEMBERSHIP" }),
  ]);

  const live = member ? membershipIsLive(member) : false;
  const identityReady = identityReadyForMembership(user, getVerificationPolicy());
  const issued = live ? await ensureMembershipCard(user.id) : null;
  const preview = issued ?? (member ? previewMembershipCard(member) : null);
  const card = live && preview
    ? {
        frontSvg: preview.frontSvg,
        backSvg: preview.backSvg,
        regNo: preview.regNo,
        verifyUrl: preview.verifyUrl,
        expiresLabel: formatDay(preview.expiresAt),
      }
    : null;
  const current =
    live && member?.membershipTier && member.membershipExpiresAt
      ? {
          badge: member.membershipTier.badge,
          badgeColor: member.membershipTier.badgeColor,
          name: member.membershipTier.name,
          interval: member.membershipInterval ?? "MONTHLY",
          expiresAt: formatDay(member.membershipExpiresAt),
          cancelAtPeriodEnd: member.membershipCancelAtPeriodEnd,
          recurring: Boolean(member.membershipSubscriptionId),
          tierId: member.membershipTier.id,
        }
      : null;

  return (
    <DashShell role={role} currentPath="/account/membership">
      <main className="pt-main">
        <h1 className="pt-title">Your plan</h1>
        <p className="pt-subtitle">
          Upgrade or downgrade any time. Unused days from the current plan become credit, the new plan
          starts today, and the next billing date becomes today plus one month or year.
        </p>
        {query.paid === "link" && live ? (
          <div className="pt-alert pt-alert--success" style={{ marginBottom: 16 }}>
            <p className="pt-alert__title">Payment received</p>
            <p>Thank you. Your membership is active and your card is ready below.</p>
          </div>
        ) : null}
        {card ? (
          <>
            <MembershipIdCard {...card} />
            <CardPhotoEditor
              fatherName={member?.fatherName ?? ""}
              address={member?.address ?? ""}
              mobile={member?.phone ?? ""}
              savedPhoto={member?.cardPhotoPath?.startsWith("/api/membership/card-photo") ? member.cardPhotoPath : null}
            />
          </>
        ) : null}
        {identityReady ? (
          <MembershipPay
          plans={plans}
          razorpayOn={isRazorpayConfigured}
          paymentsOpen={paymentsOpenFor(paymentSettings)}
          interests={interests}
          current={current}
          payments={orders.map((order) => ({
            id: order.id,
            when: formatDayTime(order.paidAt ?? order.createdAt),
            tierName: order.tier.name,
            interval: order.interval,
            amount: formatInr(order.amountPaise),
            status: order.status,
            recurring: order.recurring,
            changeKind: order.changeKind,
            granted: Boolean(order.grantedByUserId),
          }))}
        />
        ) : (
          <section className="pt-card" style={{ marginTop: 18 }}>
            <h2 className="pt-section-title">Verify identity first</h2>
            <p className="pt-hint">
              {live
                ? "Your membership is active. To change or renew a plan online, verify your identity first."
                : "A Field Sevak plan needs an approved identity before Razorpay opens. A donation to AINF does not."}
            </p>
            <p style={{ marginTop: 14 }}>
              <Link href="/account/verify" className="pt-btn pt-btn--primary">
                Verify identity
              </Link>
            </p>
          </section>
        )}
      </main>
    </DashShell>
  );
}
