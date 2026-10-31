"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isMobileAccountEmail, telHref, whatsappHref } from "@/lib/account-contact";
import { formatDayTime } from "@/lib/format-date";
import {
  noticeChannelLabel,
  noticeErrorLabel,
  suspensionMessage,
  suspensionNoticeChannel,
  type ManualNoticeChannel,
} from "@/lib/suspension";

export type SuspensionNoticeState = {
  channel: string | null;
  /** ISO time the member was told; null while they have not been. */
  sentAt: string | null;
  /** Why the last automatic email / SMS did not go, when known. */
  error?: string | null;
};

const MARK_OPTIONS: { value: ManualNoticeChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "call", label: "Phone call" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" },
];

/**
 * How the admin makes sure a suspended member knows why and for how long.
 * The automatic email / SMS can fail (email in test mode, no DLT template for
 * SMS), so the same message can go by WhatsApp or the admin's own email,
 * be copied, or be said on a call — then marked as told, which is audited.
 */
export function SuspensionNoticeTools({
  userId,
  firstName,
  contact,
  reason,
  until,
  notice,
}: {
  userId: string;
  firstName: string | null;
  contact: { email: string; phone: string | null };
  reason: string;
  /** ISO end of a timed suspension; null = until reinstated. */
  until: string | null;
  notice: SuspensionNoticeState;
}) {
  const router = useRouter();
  const [state, setState] = useState<SuspensionNoticeState>(notice);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setState(notice), [notice.channel, notice.sentAt, notice.error]); // eslint-disable-line react-hooks/exhaustive-deps

  const message = suspensionMessage({ firstName, reason, until: until ? new Date(until) : null });
  const wa = whatsappHref(contact.phone, message);
  const tel = telHref(contact.phone);
  const realEmail = isMobileAccountEmail(contact.email) ? null : contact.email;
  const mail = realEmail
    ? `mailto:${realEmail}?subject=${encodeURIComponent("Your AINF account is suspended")}&body=${encodeURIComponent(message)}`
    : null;
  const auto = suspensionNoticeChannel(contact);
  const told = Boolean(state.sentAt);
  const why = told ? null : noticeErrorLabel(state.error);
  const canRetry = !told && auto === "email";

  async function send(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      // A lapsed session answers with the sign-in page, not JSON: not a success.
      if (!response.ok || payload?.ok !== true) {
        setError(payload?.message ?? "That did not save. Refresh the page, sign in again if asked, and retry.");
        return;
      }
      if (payload.notice) setState(payload.notice);
      router.refresh();
    } catch {
      setError("The connection dropped. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy is blocked in this browser. Select the message above and copy it.");
    }
  }

  return (
    <div className="pt-notice-tools">
      <p className={`pt-notice-tools__status ${told ? "is-told" : "is-pending"}`}>
        <span className="pt-notice-tools__dot" aria-hidden="true" />
        {told
          ? `Told by ${noticeChannelLabel(state.channel)} · ${formatDayTime(new Date(state.sentAt!))}`
          : "Not told yet"}
      </p>
      {why ? <p className="pt-notice-tools__why">{why}</p> : null}
      {!told ? (
        <p className="pt-notice-tools__why">
          Send the message below yourself, then mark how you told them. They also see it when they sign in.
        </p>
      ) : null}

      <details className="pt-notice-tools__message" open={!told}>
        <summary>Message for the member</summary>
        <pre>{message}</pre>
      </details>

      <div className="pt-notice-tools__row">
        {wa ? (
          <a className="pt-btn pt-btn--sm pt-btn--whatsapp" href={wa} target="_blank" rel="noopener noreferrer">
            Send on WhatsApp
          </a>
        ) : null}
        {mail ? (
          <a className="pt-btn pt-btn--sm pt-btn--secondary" href={mail}>
            Email from my inbox
          </a>
        ) : null}
        {tel ? (
          <a className="pt-btn pt-btn--sm pt-btn--secondary" href={tel}>
            Call
          </a>
        ) : null}
        <button type="button" className="pt-btn pt-btn--sm pt-btn--ghost" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy message"}
        </button>
      </div>
      {!wa && !mail && !tel ? (
        <p className="pt-notice-tools__why">No usable email or mobile is on file; copy the message for another channel.</p>
      ) : null}

      <div className="pt-notice-tools__mark" role="group" aria-label="Mark as told">
        <span>{told ? "Told them again? Mark it:" : "Mark as told by:"}</span>
        {MARK_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="pt-notice-tools__chip"
            disabled={busy !== null}
            onClick={() => void send({ action: "recordNotice", channel: option.value }, option.value)}
          >
            {busy === option.value ? "Saving…" : option.label}
          </button>
        ))}
      </div>
      {canRetry ? (
        <button
          type="button"
          className="pt-btn pt-btn--sm pt-btn--ghost pt-notice-tools__retry"
          disabled={busy !== null}
          onClick={() => void send({ action: "resendNotice" }, "retry")}
        >
          {busy === "retry" ? "Sending…" : "Try the automatic email again"}
        </button>
      ) : null}
      {error ? <p className="pt-alert pt-alert--error">{error}</p> : null}
    </div>
  );
}
