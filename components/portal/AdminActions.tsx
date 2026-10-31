"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Role, UserStatus } from "@/lib/prisma-enums-client";
import { ConfirmDialog } from "@/components/portal/ConfirmDialog";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { SuspensionNoticeTools, type SuspensionNoticeState } from "@/components/portal/SuspensionNotice";
import { displayPhone } from "@/lib/account-contact";
import {
  SUSPENSION_PERIODS,
  SUSPENSION_REASON_MAX,
  SUSPENSION_REASON_MIN,
  noticeChannelLabel,
  suspensionNoticeChannel,
  type SuspensionPeriod,
} from "@/lib/suspension";

const ROLE_LABEL: Record<Role, string> = {
  [Role.USER]: "Member",
  [Role.VERIFIED_USER]: "Verified member",
  [Role.SUPER_ADMIN]: "Super admin",
};

const ROLE_OPTIONS = [
  { value: Role.USER, label: "Member" },
  { value: Role.VERIFIED_USER, label: "Verified member" },
  { value: Role.SUPER_ADMIN, label: "Super admin" },
];

async function patchUser(id: string, body: unknown) {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  // A lapsed session answers with the sign-in page, not JSON: not a success.
  if (response.ok && payload?.ok !== true) {
    return { ok: false, payload: { message: "That did not save. Refresh the page, sign in again if asked, and retry." } };
  }
  return { ok: response.ok, payload };
}

/** Role selector plus suspend/reinstate for one user row. Changes always ask first. */
export function UserRowActions({
  userId,
  role,
  status,
  isSelf,
  contact,
  firstName = null,
  suspension = null,
}: {
  userId: string;
  role: Role;
  status: UserStatus;
  isSelf: boolean;
  /** Where the suspension notice goes; shown to the admin before they confirm. */
  contact?: { email: string; phone: string | null };
  firstName?: string | null;
  /** The current suspension, so the admin can see and finish telling the member. */
  suspension?: { reason: string | null; until: string | null; notice: SuspensionNoticeState } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextRole, setNextRole] = useState<Role | null>(null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reinstateOpen, setReinstateOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [period, setPeriod] = useState<SuspensionPeriod>("7d");
  const [tell, setTell] = useState<{
    reason: string;
    until: string | null;
    notice: SuspensionNoticeState;
    fresh?: boolean;
  } | null>(null);

  useEffect(() => {
    setNextRole(null);
    setSuspendOpen(false);
    setReinstateOpen(false);
    setReason("");
    setPeriod("7d");
    setError(null);
  }, [role, status, userId]);

  const reasonShort = reason.trim().length < SUSPENSION_REASON_MIN;
  const channel = contact ? suspensionNoticeChannel(contact) : null;
  const noticeHint =
    channel === "email"
      ? `They are emailed at ${contact!.email}. Next you can also send it on WhatsApp or from your own inbox.`
      : channel === "sms"
        ? `They signed up with a mobile number (${displayPhone(contact!.phone)}). Next you can send the message on WhatsApp or call them.`
        : contact
          ? "This account has no email or mobile on file, so no notice can be sent. They see the reason when they sign in."
          : "They are emailed, or sent an SMS if they signed up with a mobile number.";

  if (isSelf) {
    return <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>Your own account</span>;
  }

  async function run(body: unknown): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError(null);
    let result: { ok: boolean; payload: Record<string, unknown> };
    try {
      result = await patchUser(userId, body);
    } catch {
      setBusy(false);
      setError("The connection dropped. Try again.");
      return null;
    }
    setBusy(false);
    if (!result.ok) {
      setError((result.payload?.message as string) ?? "Action failed.");
      return null;
    }
    setNextRole(null);
    setSuspendOpen(false);
    setReinstateOpen(false);
    startTransition(() => router.refresh());
    return result.payload;
  }

  async function suspendNow() {
    const text = reason.trim();
    const payload = await run({ action: "setStatus", status: UserStatus.SUSPENDED, reason: text, period });
    if (!payload) return;
    setTell({
      reason: text,
      until: (payload.suspendedUntil as string | null) ?? null,
      notice: (payload.notice as SuspensionNoticeState | null) ?? { channel: null, sentAt: null, error: null },
      fresh: true,
    });
  }

  const suspended = status !== UserStatus.ACTIVE;
  const disabled = busy || pending;
  const rolePending = Boolean(nextRole && nextRole !== role);

  return (
    <div className="pt-row-actions">
      <div className="pt-row-actions__main">
        <PortalSelect
          size="sm"
          value={nextRole ?? role}
          disabled={disabled}
          ariaLabel="Role"
          options={ROLE_OPTIONS}
          onChange={(value) => {
            const next = value as Role;
            if (next === role) {
              setNextRole(null);
              return;
            }
            setNextRole(next);
          }}
        />

        <button
          type="button"
          className={`pt-btn pt-btn--sm ${suspended ? "pt-btn--secondary" : "pt-btn--danger"}`}
          disabled={disabled}
          onClick={() => (suspended ? setReinstateOpen(true) : setSuspendOpen(true))}
        >
          {suspended ? "Reinstate" : "Suspend"}
        </button>
      </div>
      {suspended && suspension && contact ? (
        suspension.notice.sentAt ? (
          <span className="pt-told">Told by {noticeChannelLabel(suspension.notice.channel)}</span>
        ) : (
          <button
            type="button"
            className="pt-told pt-told--pending"
            onClick={() =>
              setTell({ reason: suspension.reason ?? "", until: suspension.until, notice: suspension.notice })
            }
          >
            Not told yet · Tell member
          </button>
        )
      ) : null}
      {error ? (
        <span className="pt-row-actions__error">{error}</span>
      ) : null}

      <ConfirmDialog
        open={rolePending}
        title="Confirm role change"
        body={
          nextRole
            ? `Change this account from ${ROLE_LABEL[role]} to ${ROLE_LABEL[nextRole]}? The change is audited and takes effect immediately.`
            : undefined
        }
        confirmLabel="Yes, change role"
        cancelLabel="Cancel"
        tone={nextRole === Role.SUPER_ADMIN ? "danger" : "primary"}
        busy={disabled}
        onCancel={() => setNextRole(null)}
        onConfirm={() => {
          if (nextRole) void run({ action: "setRole", role: nextRole });
        }}
      />
      <ConfirmDialog
        open={suspendOpen}
        title="Suspend this account?"
        body="They cannot use member services while suspended. They are told the reason and how long it lasts, and the change is audited."
        confirmLabel="Suspend and notify"
        tone="danger"
        busy={disabled}
        confirmDisabled={reasonShort}
        onCancel={() => {
          setSuspendOpen(false);
          setError(null);
        }}
        onConfirm={() => {
          if (!reasonShort) void suspendNow();
        }}
      >
        <div className="pt-suspend-form">
          <label className="pt-label" htmlFor={`suspend-reason-${userId}`}>
            Reason the member will see
          </label>
          <textarea
            id={`suspend-reason-${userId}`}
            className="pt-textarea"
            rows={3}
            maxLength={SUSPENSION_REASON_MAX}
            placeholder="For example: the payment on this membership was reversed by the bank."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="pt-hint pt-suspend-form__count">
            {reason.trim().length}/{SUSPENSION_REASON_MAX}
            {reasonShort ? ` · at least ${SUSPENSION_REASON_MIN} characters` : ""}
          </p>
          <span className="pt-label">How long</span>
          <div className="pt-suspend-form__periods" role="radiogroup" aria-label="How long">
            {SUSPENSION_PERIODS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={period === option.value}
                className={`pt-suspend-form__period${period === option.value ? " is-on" : ""}`}
                onClick={() => setPeriod(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="pt-hint pt-suspend-form__notice">{noticeHint}</p>
        </div>
        {error ? <p className="pt-alert pt-alert--error">{error}</p> : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={reinstateOpen}
        title="Reinstate this account?"
        body="They can sign in and use the portal again, and are told their account is active. The change is audited."
        confirmLabel="Yes, reinstate"
        busy={disabled}
        onCancel={() => setReinstateOpen(false)}
        onConfirm={() => void run({ action: "setStatus", status: UserStatus.ACTIVE })}
      />
      <ConfirmDialog
        open={tell !== null && Boolean(contact)}
        title={tell?.fresh ? "Suspended. Now tell the member" : "Tell the member"}
        confirmLabel="Done"
        hideCancel
        onCancel={() => setTell(null)}
        onConfirm={() => setTell(null)}
      >
        {tell && contact ? (
          <SuspensionNoticeTools
            userId={userId}
            firstName={firstName}
            contact={contact}
            reason={tell.reason}
            until={tell.until}
            notice={tell.notice}
          />
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

/** Approve / decline control for the manual verification queue. */
export function KycReviewActions({ kycId }: { kycId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<null | "approve" | "decline">(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(decision: "approve" | "decline") {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/admin/kyc/${kycId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, note: note.trim() || undefined }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(payload?.message ?? "Action failed.");
      return;
    }
    setOpen(null);
    setNote("");
    startTransition(() => router.refresh());
  }

  const disabled = busy || pending;

  return (
    <>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          type="button"
          className="pt-btn pt-btn--sm pt-btn--primary"
          disabled={disabled}
          onClick={() => setOpen("approve")}
        >
          Approve
        </button>
        <button
          type="button"
          className="pt-btn pt-btn--sm pt-btn--secondary"
          disabled={disabled}
          onClick={() => setOpen("decline")}
        >
          Decline
        </button>
      </div>
      <ConfirmDialog
        open={open === "approve"}
        title="Approve this verification?"
        body="The member becomes a verified user. You can add an optional note for the audit log."
        confirmLabel="Yes, approve"
        busy={disabled}
        onCancel={() => {
          setOpen(null);
          setNote("");
          setError(null);
        }}
        onConfirm={() => void submit("approve")}
      >
        <label className="pt-label" htmlFor={`note-approve-${kycId}`}>
          Note (optional)
        </label>
        <textarea maxLength={500}
          id={`note-approve-${kycId}`}
          className="pt-textarea"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error ? <p className="pt-alert pt-alert--error">{error}</p> : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={open === "decline"}
        title="Decline this verification?"
        body="The member is emailed. Add a reason they can act on."
        confirmLabel="Yes, decline"
        tone="danger"
        busy={disabled}
        confirmDisabled={note.trim().length < 3}
        onCancel={() => {
          setOpen(null);
          setNote("");
          setError(null);
        }}
        onConfirm={() => {
          if (note.trim().length >= 3) void submit("decline");
        }}
      >
        <label className="pt-label" htmlFor={`note-decline-${kycId}`}>
          Reason
        </label>
        <textarea maxLength={500}
          id={`note-decline-${kycId}`}
          className="pt-textarea"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Shared with the member by email"
        />
        {error ? <p className="pt-alert pt-alert--error">{error}</p> : null}
      </ConfirmDialog>
    </>
  );
}
