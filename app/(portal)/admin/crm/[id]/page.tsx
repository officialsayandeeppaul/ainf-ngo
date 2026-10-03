import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KycStatus, MembershipChangeKind, PanStatus, Prisma } from "@prisma/client";
import { AuditAction } from "@/lib/audit";
import { auditActionLabel, auditChips, shortId } from "@/lib/audit-display";
import { requirePageSuperAdmin } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { formatDay, formatDayTime } from "@/lib/format-date";
import { paidByMonth } from "@/lib/crm-metrics";
import { formatInr } from "@/lib/membership";
import { CrmSpark, CrmStat } from "@/components/portal/CrmCharts";
import { ensureMembershipCard, findMembershipCardByUserId, previewMembershipCard } from "@/lib/membership-card";
import { expireMembershipIfNeeded } from "@/lib/membership-pay";
import { membershipIsLive } from "@/lib/membership-state";
import { buildUserJourney } from "@/lib/user-journey";
import {
  maskLast4,
  otpCountsFromActions,
  summariseUserVerification,
} from "@/lib/verification-summary";
import { UserRowActions } from "@/components/portal/AdminActions";
import { DashShell } from "@/components/portal/DashShell";
import { Pagination } from "@/components/portal/Pagination";
import { PaymentRef } from "@/components/portal/PaymentRef";
import { RoleBadge } from "@/components/portal/PortalChrome";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { KycBadge, PanBadge, UserStatusBadge } from "@/components/portal/StatusBadge";
import { MembershipIdCard } from "@/components/portal/MembershipIdCard";
import { MembershipAdminControls, UserJourney } from "@/components/portal/UserJourney";
import { PortalDateField } from "@/components/portal/PortalDateField";
import { VerifyMethodStack } from "@/components/portal/VerifyMethods";

export const metadata: Metadata = { title: "CRM dossier" };
export const dynamic = "force-dynamic";

const AUDIT_PAGE = 25;
const JOURNEY_AUDIT_CAP = 120;
const VERIFY_LIST_CAP = 12;
const ORDER_LIST_CAP = 40;

const CHANGE_LABEL: Record<MembershipChangeKind, string> = {
  NEW: "New",
  RENEWAL: "Renewal",
  UPGRADE: "Upgrade",
  DOWNGRADE: "Downgrade",
  INTERVAL_CHANGE: "Cycle change",
};

function decisionReason(decision: unknown): string | null {
  if (!decision || typeof decision !== "object") return null;
  const record = decision as Record<string, unknown>;
  if (typeof record.reason === "string" && record.reason.trim()) return record.reason.trim();
  const nested = record.kyc;
  if (nested && typeof nested === "object" && typeof (nested as { reason?: unknown }).reason === "string") {
    return (nested as { reason: string }).reason.trim();
  }
  return null;
}

function parseDayBound(value: string | undefined, end = false): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dossierHref(
  id: string,
  next: { from?: string; to?: string; auditPage?: number }
): string {
  const params = new URLSearchParams();
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.auditPage && next.auditPage > 1) params.set("auditPage", String(next.auditPage));
  const query = params.toString();
  return query ? `/admin/crm/${id}?${query}` : `/admin/crm/${id}`;
}

export default async function AdminCrmDossierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; auditPage?: string }>;
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
  const { id } = await params;
  const query = await searchParams;
  const fromRaw = query.from?.trim() ?? "";
  const toRaw = query.to?.trim() ?? "";
  const fromDate = parseDayBound(fromRaw);
  const toDate = parseDayBound(toRaw, true);
  const auditPage = Math.max(1, Number.parseInt(query.auditPage ?? "1", 10) || 1);
  await expireMembershipIfNeeded(id);

  const member = await db.user.findUnique({
    where: { id },
    include: {
      kycVerifications: { orderBy: { createdAt: "desc" }, take: VERIFY_LIST_CAP },
      panVerifications: { orderBy: { createdAt: "desc" }, take: VERIFY_LIST_CAP },
      membershipTier: true,
      membershipOrders: {
        orderBy: { createdAt: "desc" },
        take: ORDER_LIST_CAP,
        include: {
          tier: { select: { name: true } },
          offer: { select: { name: true } },
        },
      },
    },
  });
  if (!member) notFound();

  const previousTierIds = [
    ...new Set(
      member.membershipOrders.map((order) => order.previousTierId).filter((value): value is string => Boolean(value))
    ),
  ];

  const createdAtFilter: Prisma.DateTimeFilter | undefined =
    fromDate || toDate
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        }
      : undefined;

  const auditWhere: Prisma.AuditLogWhereInput = {
    OR: [{ actorUserId: member.id }, { targetType: "user", targetId: member.id }],
    ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
  };

  const [auditTotal, audit, journeyAudit, previousTiers, otpGrouped] = await Promise.all([
    db.auditLog.count({ where: auditWhere }),
    db.auditLog.findMany({
      where: auditWhere,
      orderBy: { createdAt: "desc" },
      skip: (auditPage - 1) * AUDIT_PAGE,
      take: AUDIT_PAGE,
      include: { actor: { select: { email: true } } },
    }),
    db.auditLog.findMany({
      where: auditWhere,
      orderBy: { createdAt: "desc" },
      take: JOURNEY_AUDIT_CAP,
    }),
    previousTierIds.length === 0
      ? Promise.resolve([])
      : db.membershipTier.findMany({
          where: { id: { in: previousTierIds } },
          select: { id: true, name: true },
        }),
    db.auditLog.groupBy({
      by: ["action"],
      where: {
        actorUserId: member.id,
        action: { in: [AuditAction.OtpSent, AuditAction.OtpVerified, AuditAction.OtpFailed] },
      },
      _count: { _all: true },
    }),
  ]);
  const previousTierName = new Map(previousTiers.map((tier) => [tier.id, tier.name]));
  const auditPages = Math.max(1, Math.ceil(auditTotal / AUDIT_PAGE));

  const otp = otpCountsFromActions(
    otpGrouped.map((row) => ({ action: row.action, count: row._count._all }))
  );
  const summary = summariseUserVerification({
    kycStatus: member.kycStatus,
    phone: member.phone,
    kyc: member.kycVerifications,
    pan: member.panVerifications,
    otp,
  });

  const name = [member.firstName, member.lastName].filter(Boolean).join(" ") || "Unnamed member";
  const phoneMask = maskLast4(member.phone);
  const live = membershipIsLive(member);
  const issued = live ? await ensureMembershipCard(member.id) : null;
  const storedCard = issued ? null : await findMembershipCardByUserId(member.id);
  const cardArt =
    issued ??
    previewMembershipCard({
      ...member,
      membershipCard: storedCard,
    });
  const paidOrders = member.membershipOrders.filter((order) => order.status === "PAID");
  const spentPaise = paidOrders.reduce((sum, order) => sum + order.amountPaise, 0);
  const periodStartedAt =
    member.membershipPeriodStartedAt ?? paidOrders[0]?.paidAt ?? paidOrders[0]?.createdAt ?? null;
  const termValue =
    member.membershipTermPaise != null
      ? formatInr(member.membershipTermPaise)
      : paidOrders[0]
        ? formatInr(paidOrders[0].amountPaise)
        : null;

  const journey = buildUserJourney(
    {
      createdAt: member.createdAt,
      lastSeenAt: member.lastSeenAt,
      kyc: member.kycVerifications,
      pan: member.panVerifications,
      orders: member.membershipOrders.map((order) => ({
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        cancelledAt: order.cancelledAt,
        status: order.status,
        interval: order.interval,
        amountLabel: formatInr(order.amountPaise),
        tierName: order.tier.name,
        recurring: order.recurring,
        changeKind: order.changeKind,
        offerName: order.offer?.name ?? null,
        creditLabel: order.creditPaise > 0 ? formatInr(order.creditPaise) : null,
      })),
      audit: [...journeyAudit].reverse(),
    },
    { includeRedundantAudit: true }
  );

  return (
    <DashShell role={viewerRole} currentPath={`/admin/crm/${member.id}`}>
      <main className="pt-main">
        <p className="pt-hint" style={{ margin: "0 0 8px" }}>
          <Link href="/admin/crm">← All members</Link>
        </p>
        <h1 className="pt-title">{name}</h1>
        <p className="pt-subtitle">{member.email}</p>

        <div className="pt-crm-kpis">
          <CrmStat
            label="Paid to date"
            value={formatInr(spentPaise)}
            hint={`${paidOrders.length} captured payment${paidOrders.length === 1 ? "" : "s"}`}
          />
          <CrmStat label="Lifecycle" value={String(journey.length)} hint="Newest event first · capped load" />
          <CrmStat
            label="Live term"
            value={
              live && member.membershipExpiresAt
                ? `${Math.max(0, Math.ceil((member.membershipExpiresAt.getTime() - Date.now()) / 86_400_000))}d`
                : "—"
            }
            hint={live ? "Days left on badge" : "No live badge"}
          />
          <CrmStat label="Audit rows" value={String(auditTotal)} hint="Newest first · paginated" />
        </div>

        <section className="pt-card" style={{ marginBottom: 16 }}>
          <h2 className="pt-section-title">Paid by month</h2>
          <CrmSpark
            points={paidByMonth(
              paidOrders.map((order) => ({
                paidAt: order.paidAt,
                createdAt: order.createdAt,
                amountPaise: order.amountPaise,
              })),
              6
            )}
          />
        </section>

        <section className="pt-card" style={{ marginBottom: 16 }}>
          <h2 className="pt-section-title">Full lifecycle</h2>
          <p className="pt-hint" style={{ marginTop: 0 }}>
            Most recent event first. Apply a start/end period to keep the database light, then search
            or page within the loaded record.
          </p>
          <form className="pt-crm-period" method="get">
            <label className="pt-label" htmlFor="crm-from">
              Start date
              <PortalDateField
                id="crm-from"
                name="from"
                defaultValue={fromRaw}
                placeholder="Start date"
              />
            </label>
            <label className="pt-label" htmlFor="crm-to">
              End date
              <PortalDateField id="crm-to" name="to" defaultValue={toRaw} placeholder="End date" />
            </label>
            <div className="pt-crm-period__actions">
              <button type="submit" className="pt-btn pt-btn--secondary">
                Apply period
              </button>
              {fromRaw || toRaw ? (
                <Link className="pt-btn pt-btn--ghost" href={`/admin/crm/${member.id}`}>
                  Clear
                </Link>
              ) : null}
            </div>
          </form>
          <UserJourney events={journey} filterable initialFrom={fromRaw} initialTo={toRaw} />
        </section>

        <div className="pt-grid pt-grid--2 pt-grid--equal" style={{ marginBottom: 16 }}>
          <section className="pt-card pt-card--stack">
            <h2 className="pt-section-title">Account</h2>
            <dl className="pt-kv">
              <dt>Role</dt>
              <dd>
                <RoleBadge role={member.role} />
              </dd>
              <dt>Status</dt>
              <dd>
                <UserStatusBadge status={member.status} />
                {member.suspendedReason ? (
                  <span className="pt-hint" style={{ display: "block", marginTop: 4 }}>
                    {member.suspendedReason}
                  </span>
                ) : null}
              </dd>
              <dt>Joined</dt>
              <dd>{formatDayTime(member.createdAt)}</dd>
              <dt>Last seen</dt>
              <dd>{member.lastSeenAt ? formatDayTime(member.lastSeenAt) : "Never"}</dd>
              <dt>Phone on file</dt>
              <dd>{phoneMask ?? "—"}</dd>
              <dt>Clerk id</dt>
              <dd>
                <code>{shortId(member.clerkId)}</code>
              </dd>
            </dl>
            <div className="pt-card__foot">
              <UserRowActions
                userId={member.id}
                role={member.role}
                status={member.status}
                isSelf={member.id === viewer.id}
              />
            </div>
          </section>

          <section className="pt-card pt-card--stack">
            <h2 className="pt-section-title">Membership</h2>
            <dl className="pt-kv">
              <dt>Badge</dt>
              <dd>
                {live && member.membershipTier && member.membershipExpiresAt ? (
                  <>
                    <span
                      className="pt-plan-badge"
                      style={{
                        background: `${member.membershipTier.badgeColor}22`,
                        color: member.membershipTier.badgeColor,
                      }}
                    >
                      {member.membershipTier.badge}
                    </span>
                    <span className="pt-hint" style={{ display: "block", marginTop: 6 }}>
                      {member.membershipTier.name} ·{" "}
                      {member.membershipInterval === "YEARLY" ? "yearly" : "monthly"} · until{" "}
                      {formatDay(member.membershipExpiresAt)}
                      {member.membershipCancelAtPeriodEnd ? " · auto-renew off" : ""}
                    </span>
                  </>
                ) : (
                  <span className="pt-pill pt-pill--muted">No live badge</span>
                )}
              </dd>
              <dt>Period started</dt>
              <dd>{periodStartedAt ? formatDayTime(periodStartedAt) : "—"}</dd>
              <dt>Term value</dt>
              <dd>{termValue ? <span className="pt-money">{termValue}</span> : <span className="pt-pill pt-pill--muted">No paid term</span>}</dd>
              <dt>Subscription</dt>
              <dd>
                {member.membershipSubscriptionId ? (
                  shortId(member.membershipSubscriptionId)
                ) : (
                  <span className="pt-pill pt-pill--muted">No subscription</span>
                )}
              </dd>
              <dt>ID card</dt>
              <dd>
                {cardArt ? (
                  <code>{cardArt.regNo}</code>
                ) : (
                  <span className="pt-pill pt-pill--muted">ID not issued</span>
                )}
              </dd>
            </dl>
            <div className="pt-card__foot">
              <MembershipAdminControls
                userId={member.id}
                live={live}
                recurring={Boolean(member.membershipSubscriptionId) && !member.membershipCancelAtPeriodEnd}
              />
            </div>
          </section>
        </div>

        {cardArt ? (
          <div className="pt-card" style={{ marginBottom: 18 }}>
            <MembershipIdCard
              frontSvg={cardArt.frontSvg}
              backSvg={cardArt.backSvg}
              regNo={cardArt.regNo}
              verifyUrl={cardArt.verifyUrl}
              expiresLabel={formatDay(cardArt.expiresAt)}
              compact
            />
          </div>
        ) : null}

        <section className="pt-card" style={{ marginBottom: 18 }}>
          <h2 className="pt-section-title">Verification mix</h2>
          <p className="pt-hint" style={{ marginTop: 0 }}>
            Didit, APITXT PAN, and mobile OTP from stored records. Identity images and full PAN
            numbers are never shown here.
          </p>
          <VerifyMethodStack summary={summary} />
        </section>

        <div className="pt-grid pt-grid--methods pt-grid--equal">
          <section className="pt-card pt-card--stack">
            <h2 className="pt-section-title">Didit</h2>
            {member.kycVerifications.length === 0 ? (
              <p className="pt-hint">No Didit sessions yet.</p>
            ) : (
              <ul className="pt-log">
                {member.kycVerifications.map((session) => {
                  const reason = decisionReason(session.decision);
                  return (
                    <li className="pt-log__row" key={session.id}>
                      <KycBadge status={session.status} />
                      <div className="pt-log__who">
                        Session {session.sessionNumber ?? shortId(session.diditSessionId)}
                        <div className="pt-log__sub">
                          {formatDayTime(session.createdAt)}
                          {session.signatureScheme ? ` · ${session.signatureScheme}` : ""}
                          {session.reviewedAt ? ` · reviewed ${formatDayTime(session.reviewedAt)}` : ""}
                        </div>
                        {session.reviewNote ? <div className="pt-log__sub">{session.reviewNote}</div> : null}
                        {reason ? <div className="pt-log__sub">{reason}</div> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="pt-card pt-card--stack">
            <h2 className="pt-section-title">APITXT PAN</h2>
            {member.panVerifications.length === 0 ? (
              <p className="pt-hint">No PAN checks yet.</p>
            ) : (
              <ul className="pt-log">
                {member.panVerifications.map((row) => (
                  <li className="pt-log__row" key={row.id}>
                    <PanBadge status={row.status} />
                    <div className="pt-log__who">
                      ····{row.panLast4}
                      <div className="pt-log__sub">
                        {formatDayTime(row.createdAt)}
                        {row.nameMatch != null ? ` · name ${row.nameMatch ? "match" : "mismatch"}` : ""}
                        {row.dobMatch != null ? ` · DOB ${row.dobMatch ? "match" : "mismatch"}` : ""}
                      </div>
                      {row.status === PanStatus.FAILED && row.failureMessage ? (
                        <div className="pt-log__sub">{row.failureMessage}</div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="pt-card pt-card--stack">
            <h2 className="pt-section-title">Mobile OTP</h2>
            {otp.sent + otp.verified + otp.failed === 0 ? (
              <p className="pt-hint">No OTP attempts yet.</p>
            ) : (
              <dl className="pt-kv">
                <dt>Codes sent</dt>
                <dd>{otp.sent}</dd>
                <dt>Verified</dt>
                <dd>{otp.verified}</dd>
                <dt>Failed checks</dt>
                <dd>{otp.failed}</dd>
                <dt>Number</dt>
                <dd>
                  {phoneMask ?? "—"}
                  {member.kycStatus === KycStatus.APPROVED && otp.verified > 0 ? " · verified" : ""}
                </dd>
              </dl>
            )}
          </section>
        </div>

        <section className="pt-card pt-card--flush" style={{ marginTop: 18 }}>
          <div className="pt-card__head">
            <h2 className="pt-section-title" style={{ margin: 0 }}>
              Payments
            </h2>
          </div>
          {member.membershipOrders.length === 0 ? (
            <p className="pt-empty">No membership payments.</p>
          ) : (
            <div className="pt-table-wrap">
              <table className="pt-table pt-table--dossier pt-table--payments">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Amount</th>
                    <th>Kind</th>
                    <th>When</th>
                    <th>Status</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {member.membershipOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <div className="pt-dossier-plan">{order.tier.name}</div>
                        <div className="pt-dossier-meta">
                          {order.interval === "YEARLY" ? "Yearly" : "Monthly"}
                          {order.offer ? ` · ${order.offer.name}` : ""}
                          {order.previousTierId
                            ? ` · from ${previousTierName.get(order.previousTierId) ?? "previous plan"}`
                            : ""}
                          {order.recurring ? " · recurring" : ""}
                        </div>
                      </td>
                      <td>
                        <span className="pt-money">{formatInr(order.amountPaise)}</span>
                        {order.listPaise != null && order.listPaise !== order.amountPaise ? (
                          <div className="pt-dossier-meta">List {formatInr(order.listPaise)}</div>
                        ) : null}
                        {order.creditPaise > 0 ? (
                          <div className="pt-dossier-meta">Credit {formatInr(order.creditPaise)}</div>
                        ) : null}
                      </td>
                      <td>
                        <span className="pt-pill">{CHANGE_LABEL[order.changeKind]}</span>
                      </td>
                      <td className="pt-dossier-when">{formatDayTime(order.paidAt ?? order.createdAt)}</td>
                      <td>
                        <span
                          className={`pt-badge pt-badge--lift ${
                            order.status === "PAID"
                              ? "pt-badge--success"
                              : order.status === "CANCELLED"
                                ? "pt-badge--warning"
                                : order.status === "FAILED"
                                  ? "pt-badge--danger"
                                  : "pt-badge--neutral"
                          }`}
                        >
                          {order.status === "PAID" ? "Paid" : order.status.toLowerCase()}
                        </span>
                      </td>
                      <td>
                        <PaymentRef
                          paymentId={order.razorpayPaymentId}
                          orderId={order.razorpayOrderId}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="pt-card pt-card--flush" style={{ marginTop: 16 }}>
          <div className="pt-card__head">
            <h2 className="pt-section-title" style={{ margin: 0 }}>
              Raw audit
            </h2>
          </div>
          {audit.length === 0 ? (
            <p className="pt-empty">No audit rows for this period.</p>
          ) : (
            <div className="pt-table-wrap">
              <table className="pt-table pt-table--dossier">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Details</th>
                    <th>When</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((entry) => {
                    const chips = auditChips(entry.metadata, 6);
                    return (
                      <tr key={entry.id}>
                        <td>
                          <div className="pt-dossier-plan">{auditActionLabel(entry.action)}</div>
                          {entry.actor?.email && entry.actorUserId !== member.id ? (
                            <div className="pt-dossier-meta">by {entry.actor.email}</div>
                          ) : null}
                        </td>
                        <td>
                          {chips.length ? (
                            <div className="pt-dossier-chips">
                              {chips.map((chip) => (
                                <span className="pt-pill pt-pill--chip" key={`${entry.id}-${chip.label}`}>
                                  <strong>{chip.label}</strong> {chip.value}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="pt-dossier-meta">—</span>
                          )}
                        </td>
                        <td className="pt-dossier-when">{formatDayTime(entry.createdAt)}</td>
                        <td>
                          <span
                            className={`pt-badge pt-badge--lift ${entry.success ? "pt-badge--success" : "pt-badge--danger"}`}
                          >
                            {entry.success ? "OK" : "Failed"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: "12px 16px 16px" }}>
            <Pagination
              page={Math.min(auditPage, auditPages)}
              pages={auditPages}
              total={auditTotal}
              pageSize={AUDIT_PAGE}
              hrefFor={(next) =>
                dossierHref(member.id, {
                  from: fromRaw || undefined,
                  to: toRaw || undefined,
                  auditPage: next,
                })
              }
            />
          </div>
        </section>
      </main>
    </DashShell>
  );
}
