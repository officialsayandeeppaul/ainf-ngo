import type { Metadata } from "next";
import Link from "next/link";
import { KycStatus } from "@prisma/client";
import { requirePageAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { fetchSession } from "@/lib/didit";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { applyDiditDecision } from "@/lib/kyc-apply";
import { requestContext } from "@/lib/request-context";
import { getVerificationPolicy } from "@/lib/verification-policy";
import { DashShell } from "@/components/portal/DashShell";
import { KycBadge } from "@/components/portal/StatusBadge";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { DoneArt, EmptyArt, WaitingArt } from "@/components/portal/VerifyArt";
import { VerifyProgress, type ProgressStep } from "@/components/portal/VerifyProgress";
import { formatDayTime } from "@/lib/format-date";
import { DiditFlow, LockedStep, OtpFlow, PanFlow } from "@/components/portal/VerifyFlows";

export const metadata: Metadata = { title: "Identity verification" };
export const dynamic = "force-dynamic";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; verificationSessionId?: string; session_id?: string }>;
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

  const { user, role } = await requirePageAuth("/account/verify");
  const policy = getVerificationPolicy();
  const params = await searchParams;

  const callbackSessionId = params.verificationSessionId || params.session_id;
  if (policy.didit && params.from === "didit" && callbackSessionId) {
    try {
      const session = await fetchSession(callbackSessionId);
      await applyDiditDecision({
        sessionId: callbackSessionId,
        status: session.status,
        decision: session.decision,
        scheme: "callback_api",
        trustsPayload: true,
        expectedUserId: user.id,
        context: await requestContext(),
      });
    } catch (error) {
      console.error("[verify] Didit return reconcile failed", error);
    }
  }

  const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });

  const [latestKyc, panRecord] = await Promise.all([
    db.kycVerification.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.panVerification.findFirst({
      where: { userId: user.id, status: "VERIFIED" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const approved = fresh.kycStatus === KycStatus.APPROVED;
  const inReview = fresh.kycStatus === KycStatus.IN_REVIEW;
  const panDone = Boolean(fresh.panVerified || panRecord);
  const showPan = policy.pan && (!policy.didit || approved);
  const showOtp = policy.otp && !approved;
  const allDone = approved && (!policy.pan || panDone);
  const noneEnabled = !policy.didit && !policy.pan && !policy.otp;

  const steps: ProgressStep[] = [];
  if (policy.didit) {
    steps.push({
      id: "identity",
      label: "Identity",
      caption: approved ? "Approved" : inReview ? "In review" : "ID and selfie",
      state: approved ? "complete" : "current",
    });
  }
  if (policy.pan) {
    steps.push({
      id: "pan",
      label: "PAN",
      caption: panDone ? "On file" : policy.didit && !approved ? "Locked" : "Name and date of birth",
      state: panDone ? "complete" : showPan ? "current" : "locked",
    });
  }
  if (policy.otp) {
    steps.push({
      id: "otp",
      label: "Mobile code",
      caption: approved ? "Verified" : "One-time code",
      state: approved ? "complete" : "current",
    });
  }

  return (
    <DashShell role={role} currentPath="/account/verify">
      <main className="pt-main">
        <h1 className="pt-title">Become a verified member</h1>
        <p className="pt-subtitle">
          {policy.didit && policy.pan
            ? "Confirm your identity first. PAN unlocks only after that is approved."
            : policy.otp
              ? "This instance verifies members with a one-time mobile code."
              : policy.pan
                ? "Submit your PAN to become a verified member."
                : "Complete the steps below. Disabled methods stay hidden."}
        </p>

        <div
          className="pt-card"
          style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}
        >
          <span style={{ fontSize: 13.5, color: "var(--ink-muted)" }}>Current status</span>
          <KycBadge status={fresh.kycStatus} />
          {fresh.panVerified ? (
            <span className="pt-badge pt-badge--success">
              <span className="pt-badge__dot" aria-hidden="true" />
              PAN verified
            </span>
          ) : null}
        </div>

        <VerifyProgress steps={steps} />

        {allDone ? (
          <section className="pt-card pt-card--hero">
            <DoneArt />
            <div>
              <p className="pt-alert__title">You are verified</p>
              <p className="pt-hint" style={{ margin: "6px 0 0" }}>
                Nothing more to do on this page. Your account has verified member access.
              </p>
            </div>
          </section>
        ) : null}

        {inReview ? (
          <section className="pt-card pt-card--hero">
            <WaitingArt />
            <div>
              <p className="pt-alert__title">Manual review in progress</p>
              <p className="pt-hint" style={{ margin: "6px 0 0" }}>
                Your submission needs a human check. This usually completes within one business day
                and you will be emailed the result.
              </p>
            </div>
          </section>
        ) : null}

        {fresh.kycStatus === KycStatus.DECLINED ? (
          <div className="pt-alert pt-alert--error">
            <p className="pt-alert__title">Previous attempt not approved</p>
            <p>You can start a new attempt below.</p>
          </div>
        ) : null}

        {noneEnabled ? (
          <section className="pt-card pt-card--hero">
            <EmptyArt />
            <div>
              <p className="pt-disabled__kicker">Currently disabled</p>
              <h2 className="pt-section-title" style={{ marginBottom: 8 }}>
                No verification method is on
              </h2>
              <p className="pt-hint" style={{ margin: 0 }}>
                Set Didit or APITXT keys, or turn on <code>VERIFICATION_OTP=true</code>. Admin
                overview lists which methods this instance will show.
              </p>
            </div>
          </section>
        ) : null}

        {!allDone ? (
          <div className="pt-verify-stack">
            {policy.didit && !approved && !inReview ? (
              <DiditFlow />
            ) : null}

            {policy.didit && policy.pan && !approved ? (
              <LockedStep
                title="Step 2 — PAN"
                body="This step is currently disabled. Photograph your ID first. PAN is collected only after that check is approved."
              />
            ) : null}

            {showPan ? (
              <PanFlow
                title={policy.didit ? "Step 2 — PAN" : "PAN"}
                initialLast4={panRecord?.panLast4 ?? null}
              />
            ) : null}

            {showOtp ? <OtpFlow phoneHint={fresh.phone} /> : null}
          </div>
        ) : null}

        {allDone ? (
          <section className="pt-card" style={{ marginTop: 18 }}>
            <h2 className="pt-section-title">Identity is approved</h2>
            <p className="pt-hint">You can take a Field Sevak plan now.</p>
            <p style={{ marginTop: 14 }}>
              <Link href="/account/membership" className="pt-btn pt-btn--primary">
                Continue to your plan
              </Link>
            </p>
          </section>
        ) : null}

        <section className="pt-card" style={{ marginTop: 18 }}>
          <h2 className="pt-section-title">What we keep</h2>
          <ul className="pt-list">
            {policy.didit ? (
              <li>Your ID images stay with our verification partner; we receive only the decision.</li>
            ) : null}
            {policy.pan ? (
              <li>
                Your PAN is stored as a one-way hash plus the last four characters, so we can detect
                duplicate use without holding the number.
              </li>
            ) : null}
            {policy.otp ? (
              <li>One-time codes expire in ten minutes and are stored only as a hash.</li>
            ) : null}
            <li>Every status change is recorded in an append-only audit log.</li>
            <li>
              Read more in our{" "}
              <Link href="/legal-pages/terms-conditions">terms and privacy notice</Link>.
            </li>
          </ul>
        </section>

        {latestKyc ? (
          <p className="pt-hint" style={{ marginTop: 16 }}>
            Last document attempt{" "}
            {formatDayTime(latestKyc.createdAt)}
            {latestKyc.sessionNumber ? ` · session #${latestKyc.sessionNumber}` : ""}
          </p>
        ) : null}
      </main>
    </DashShell>
  );
}
