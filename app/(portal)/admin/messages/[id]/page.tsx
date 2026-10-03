import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditAction } from "@/lib/audit-actions";
import { requirePageSuperAdmin } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { isClerkConfigured, isDatabaseConfigured, isResendConfigured } from "@/lib/env";
import { describeResendDelivery } from "@/lib/email";
import { formatDayTime } from "@/lib/format-date";
import {
  ContactMessageActions,
  type MessageActivityItem,
} from "@/components/portal/ContactMessageActions";
import { DashShell } from "@/components/portal/DashShell";
import { SetupNotice } from "@/components/portal/SetupNotice";

export const metadata: Metadata = { title: "Message" };
export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  NEW: "New",
  REVIEWED: "Reviewed",
  REPLIED: "Replied",
  ARCHIVED: "Archived",
} as const;

function statusBadgeClass(status: keyof typeof STATUS_LABEL) {
  if (status === "NEW") return "pt-badge pt-badge--lift pt-badge--success";
  if (status === "REPLIED") return "pt-badge pt-badge--lift pt-badge--neutral";
  if (status === "ARCHIVED") return "pt-badge pt-badge--lift pt-badge--warning";
  return "pt-badge pt-badge--lift pt-badge--neutral";
}

function actorName(user: {
  email: string;
  firstName: string | null;
  lastName: string | null;
} | null) {
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || user.email;
}

function buildActivity(input: {
  row: {
    id: string;
    createdAt: Date;
    reviewedAt: Date | null;
    repliedAt: Date | null;
    replySentEmail: boolean;
    status: keyof typeof STATUS_LABEL;
  };
  audits: Array<{
    id: string;
    action: string;
    createdAt: Date;
    metadata: unknown;
    actor: { email: string; firstName: string | null; lastName: string | null } | null;
  }>;
}): MessageActivityItem[] {
  const items: MessageActivityItem[] = [
    {
      id: `received-${input.row.id}`,
      label: "Message received",
      detail: "Submitted from the contact form",
      when: formatDayTime(input.row.createdAt),
      actor: null,
    },
  ];

  const ACTION_COPY: Record<string, { label: string; detail?: (meta: Record<string, unknown>) => string | null }> = {
    [AuditAction.ContactMessageReviewed]: {
      label: "Marked reviewed",
      detail: () => "Admin marked this thread as reviewed",
    },
    [AuditAction.ContactMessageReplied]: {
      label: "Reply saved",
      detail: (meta) => {
        if (meta.emailed === true) return "Reply emailed from the AINF address";
        if (typeof meta.emailWarning === "string" && meta.emailWarning) {
          return "Reply saved in inbox (email blocked by Resend test mode)";
        }
        if (meta.sendEmail === true) return "Reply emailed from the AINF address";
        return "Reply saved in inbox only (no email)";
      },
    },
    [AuditAction.ContactMessageArchived]: {
      label: "Archived",
      detail: () => "Moved out of the open inbox",
    },
    [AuditAction.ContactMessageReopened]: {
      label: "Reopened",
      detail: () => "Returned to New in the open inbox",
    },
    [AuditAction.ContactMessageReceived]: {
      label: "Message received",
      detail: () => "Submitted from the contact form",
    },
  };

  for (const entry of input.audits) {
    if (entry.action === AuditAction.ContactMessageReceived) continue;
    const copy = ACTION_COPY[entry.action];
    if (!copy) continue;
    const meta =
      entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
        ? (entry.metadata as Record<string, unknown>)
        : {};
    items.push({
      id: entry.id,
      label: copy.label,
      detail: copy.detail?.(meta) ?? null,
      when: formatDayTime(entry.createdAt),
      actor: actorName(entry.actor),
    });
  }

  // Fallback for older rows that have timestamps but no audit yet.
  const hasReviewed = items.some((item) => item.label === "Marked reviewed");
  const hasReplied = items.some((item) => item.label === "Reply saved");
  if (input.row.reviewedAt && !hasReviewed) {
    items.push({
      id: `reviewed-${input.row.id}`,
      label: "Marked reviewed",
      detail: "Admin marked this thread as reviewed",
      when: formatDayTime(input.row.reviewedAt),
      actor: null,
    });
  }
  if (input.row.repliedAt && !hasReplied) {
    items.push({
      id: `replied-${input.row.id}`,
      label: "Reply saved",
      detail: input.row.replySentEmail
        ? "Reply emailed from the AINF address"
        : "Reply saved in inbox only (no email)",
      when: formatDayTime(input.row.repliedAt),
      actor: null,
    });
  }

  return items;
}

export default async function AdminMessageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
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
  const { id } = await params;
  const row = await db.contactMessage.findUnique({ where: { id } });
  if (!row) notFound();

  const audits = await db.auditLog.findMany({
    where: { targetType: "contact_message", targetId: id },
    orderBy: { createdAt: "asc" },
    take: 40,
    include: {
      actor: { select: { email: true, firstName: true, lastName: true } },
    },
  });

  const activity = buildActivity({ row, audits });
  const delivery = describeResendDelivery(row.email);

  return (
    <DashShell role={role} currentPath="/admin/messages">
      <main className="pt-main">
        <div className="pt-pagehead pt-pagehead--msg">
          <div>
            <p className="pt-eyebrow" style={{ marginBottom: 6 }}>
              <Link href="/admin/messages" className="pt-crumb">
                ← Messages
              </Link>
            </p>
            <h1 className="pt-title">{row.name}</h1>
            <p className="pt-subtitle">
              Contact form · {formatDayTime(row.createdAt)}
            </p>
          </div>
          <span className={statusBadgeClass(row.status)}>{STATUS_LABEL[row.status]}</span>
        </div>

        <div className="pt-grid pt-grid--2 pt-grid--equal" style={{ marginBottom: 16 }}>
          <section className="pt-card pt-card--stack">
            <h2 className="pt-section-title">Their message</h2>
            <p className="pt-contact-body">{row.body}</p>
            {row.replyBody ? (
              <div className="pt-msg-reply-preview">
                <p className="pt-section-title" style={{ fontSize: 14, marginBottom: 8 }}>
                  Saved reply
                </p>
                <p className="pt-contact-body">{row.replyBody}</p>
                <p className="pt-dossier-meta" style={{ marginTop: 8 }}>
                  {row.repliedAt ? formatDayTime(row.repliedAt) : ""}
                  {row.replySentEmail ? " · Email sent from AINF" : " · Saved without email"}
                </p>
              </div>
            ) : null}
          </section>

          <section className="pt-card pt-card--stack">
            <h2 className="pt-section-title">Contact</h2>
            <dl className="pt-kv">
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${row.email}`}>{row.email}</a>
              </dd>
              <dt>Phone</dt>
              <dd>
                {row.phone ? <a href={`tel:${row.phone.replace(/\s+/g, "")}`}>{row.phone}</a> : "—"}
              </dd>
              <dt>Received</dt>
              <dd>{formatDayTime(row.createdAt)}</dd>
              <dt>Status</dt>
              <dd>
                <span className={statusBadgeClass(row.status)}>{STATUS_LABEL[row.status]}</span>
              </dd>
              {row.reviewedAt ? (
                <>
                  <dt>Reviewed</dt>
                  <dd>{formatDayTime(row.reviewedAt)}</dd>
                </>
              ) : null}
              {row.repliedAt ? (
                <>
                  <dt>Replied</dt>
                  <dd>{formatDayTime(row.repliedAt)}</dd>
                </>
              ) : null}
            </dl>
            <div className="pt-card__foot pt-btn-row">
              <a className="pt-btn pt-btn--secondary pt-btn--pop" href={`mailto:${row.email}`}>
                Open mail app
              </a>
              {row.phone ? (
                <a
                  className="pt-btn pt-btn--ghost pt-btn--pop"
                  href={`tel:${row.phone.replace(/\s+/g, "")}`}
                >
                  Call
                </a>
              ) : null}
            </div>
          </section>
        </div>

        <ContactMessageActions
          id={row.id}
          status={row.status}
          emailConfigured={isResendConfigured}
          canEmailRecipient={delivery.canEmail}
          emailHint={delivery.hint}
          activity={activity}
        />
      </main>
    </DashShell>
  );
}
