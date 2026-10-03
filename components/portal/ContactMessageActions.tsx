"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/portal/ConfirmDialog";

export type MessageActivityItem = {
  id: string;
  label: string;
  detail?: string | null;
  when: string;
  actor?: string | null;
};

async function patchMessage(id: string, body: unknown) {
  const response = await fetch(`/api/admin/messages/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, payload };
}

/** CRM-style dossier actions: review / archive + reply with email or save-only. */
export function ContactMessageActions({
  id,
  status,
  emailConfigured,
  emailHint,
  canEmailRecipient,
  activity,
}: {
  id: string;
  status: string;
  emailConfigured: boolean;
  emailHint?: string | null;
  canEmailRecipient?: boolean;
  activity: MessageActivityItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sendEmail, setSendEmail] = useState(Boolean(emailConfigured && canEmailRecipient !== false));
  const [confirmReply, setConfirmReply] = useState(false);

  const disabled = busy || pending;
  const canReply = reply.trim().length >= 5;
  const emailAllowed = Boolean(emailConfigured && canEmailRecipient !== false);

  async function run(body: unknown) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const { ok, payload } = await patchMessage(id, body);
    setBusy(false);
    if (!ok) {
      setError(payload?.message ?? "Action failed.");
      return false;
    }
    if (typeof payload?.warning === "string" && payload.warning) {
      setNotice(payload.warning);
    }
    startTransition(() => router.refresh());
    return true;
  }

  return (
    <div className="pt-msg-actions">
      <section className="pt-card pt-card--stack">
        <h2 className="pt-section-title">Inbox actions</h2>
        <p className="pt-hint" style={{ marginTop: -4, marginBottom: 12 }}>
          Keep the queue clean — review first, archive when done, or reopen later.
        </p>
        <div className="pt-btn-row">
          {status === "NEW" ? (
            <button
              type="button"
              className="pt-btn pt-btn--secondary pt-btn--pop"
              disabled={disabled}
              onClick={() => void run({ action: "markReviewed" })}
            >
              Mark reviewed
            </button>
          ) : null}
          {status === "REVIEWED" || status === "REPLIED" ? (
            <span className="pt-pill pt-pill--muted">
              {status === "REPLIED" ? "Already replied" : "Reviewed"}
            </span>
          ) : null}
          {status !== "ARCHIVED" ? (
            <button
              type="button"
              className="pt-btn pt-btn--ghost pt-btn--pop"
              disabled={disabled}
              onClick={() => void run({ action: "archive" })}
            >
              Archive
            </button>
          ) : (
            <button
              type="button"
              className="pt-btn pt-btn--secondary pt-btn--pop"
              disabled={disabled}
              onClick={() => void run({ action: "reopen" })}
            >
              Reopen
            </button>
          )}
        </div>

        <div className="pt-msg-activity">
          <p className="pt-section-title" style={{ fontSize: 14, marginBottom: 10 }}>
            Activity
          </p>
          {activity.length === 0 ? (
            <p className="pt-hint">No admin actions yet.</p>
          ) : (
            <ul className="pt-msg-activity__list">
              {activity.map((item) => (
                <li key={item.id} className="pt-msg-activity__item">
                  <div className="pt-msg-activity__dot" aria-hidden="true" />
                  <div className="pt-msg-activity__body">
                    <div className="pt-msg-activity__label">{item.label}</div>
                    {item.detail ? <div className="pt-dossier-meta">{item.detail}</div> : null}
                    <div className="pt-msg-activity__meta">
                      <time>{item.when}</time>
                      {item.actor ? <span>· {item.actor}</span> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="pt-card pt-card--stack">
        <h2 className="pt-section-title">Reply</h2>
        <p className="pt-hint" style={{ marginTop: -4, marginBottom: 14 }}>
          Standard AINF letter. Pick email or inbox-only, then confirm.
        </p>

        <div className="pt-segment pt-segment--block" role="group" aria-label="Reply delivery">
          <button
            type="button"
            className={`pt-segment__btn${sendEmail ? " is-on" : ""}`}
            disabled={disabled || !emailAllowed}
            onClick={() => setSendEmail(true)}
          >
            Send by email
          </button>
          <button
            type="button"
            className={`pt-segment__btn${!sendEmail ? " is-on" : ""}`}
            disabled={disabled}
            onClick={() => setSendEmail(false)}
          >
            Save in inbox only
          </button>
        </div>
        {!emailConfigured ? (
          <p className="pt-hint" style={{ marginTop: 8 }}>
            Resend is not configured — replies stay in the inbox only.
          </p>
        ) : emailHint ? (
          <p className="pt-hint" style={{ marginTop: 8 }}>
            {emailHint}
          </p>
        ) : (
          <p className="pt-hint" style={{ marginTop: 8 }}>
            {sendEmail
              ? "Email goes from the AINF address to their inbox, with their message quoted."
              : "No email is sent. The reply is stored on this thread only."}
          </p>
        )}

        <label className="pt-label" htmlFor={`reply-${id}`} style={{ marginTop: 14 }}>
          Your reply
          <textarea
            id={`reply-${id}`}
            className="pt-input pt-textarea"
            rows={7}
            value={reply}
            disabled={disabled}
            placeholder="Write a clear, warm reply…"
            onChange={(event) => setReply(event.target.value)}
          />
        </label>

        <div className="pt-card__foot">
          <div className="pt-btn-row">
            <button
              type="button"
              className="pt-btn pt-btn--primary pt-btn--pop"
              disabled={disabled || !canReply}
              onClick={() => setConfirmReply(true)}
            >
              {sendEmail ? "Send reply email" : "Save reply"}
            </button>
          </div>
          {error ? (
            <p className="pt-hint" style={{ color: "#8a3b3b", marginTop: 10 }}>
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="pt-hint" style={{ color: "var(--ainf-green-dark)", marginTop: 10 }}>
              {notice}
            </p>
          ) : null}
        </div>
      </section>

      <ConfirmDialog
        open={confirmReply}
        title={sendEmail ? "Send reply from AINF?" : "Save reply without email?"}
        body={
          sendEmail
            ? "This sends a standard AINF-formatted email to their address, and stores the reply here."
            : "The reply is stored on this message only. No email will be sent."
        }
        confirmLabel={sendEmail ? "Send email" : "Save reply"}
        busy={disabled}
        onCancel={() => setConfirmReply(false)}
        onConfirm={() => {
          void (async () => {
            const ok = await run({
              action: "reply",
              body: reply.trim(),
              sendEmail,
            });
            if (ok) {
              setConfirmReply(false);
              setReply("");
            }
          })();
        }}
      />
    </div>
  );
}
