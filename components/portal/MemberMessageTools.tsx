"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDayTime } from "@/lib/format-date";

export type SentMemberMessage = {
  id: string;
  body: string;
  /** ISO times. */
  at: string;
  readAt: string | null;
};

/**
 * CRM: write straight to a member's dashboard inbox. Nothing is emailed; it
 * shows under Messages, and on the suspended page while they are suspended.
 */
export function MemberMessageTools({
  userId,
  suspended,
  sent,
}: {
  userId: string;
  suspended: boolean;
  sent: SentMemberMessage[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function send() {
    if (busy || body.trim().length < 2) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) {
        setError(payload?.message ?? "That did not send. Refresh the page, sign in again if asked, and retry.");
        return;
      }
      setBody("");
      setNotice(
        suspended
          ? "Sent. They see it on their suspended page as soon as they sign in."
          : "Sent. They see it under Messages on their dashboard."
      );
      router.refresh();
    } catch {
      setError("The connection dropped. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-inbox-form">
      <p className="pt-hint" style={{ margin: 0 }}>
        {suspended
          ? "This member is suspended. The message shows on their suspended page when they sign in. No email or text is sent."
          : "Shows under Messages on their dashboard. No email or text is sent."}
      </p>
      <label className="pt-label" htmlFor={`member-message-${userId}`}>
        Message
        <textarea
          id={`member-message-${userId}`}
          className="pt-input pt-textarea"
          rows={4}
          maxLength={4000}
          value={body}
          disabled={busy}
          placeholder="Write a clear, warm message…"
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <div className="pt-btn-row">
        <button
          type="button"
          className="pt-btn pt-btn--primary"
          disabled={busy || body.trim().length < 2}
          onClick={() => void send()}
        >
          {busy ? "Sending…" : "Send to their dashboard"}
        </button>
      </div>
      {notice ? (
        <p className="pt-hint" style={{ margin: 0, color: "var(--ainf-green-dark)" }} role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="pt-alert pt-alert--error" role="alert">
          {error}
        </p>
      ) : null}

      {sent.length > 0 ? (
        <ul className="pt-inbox pt-inbox--sent">
          {sent.map((row) => (
            <li key={row.id} className="pt-inbox__item pt-inbox__item--team">
              <div className="pt-inbox__head">
                <span className="pt-inbox__from">Sent</span>
                <span className={`pt-pill${row.readAt ? "" : " pt-pill--muted"}`}>
                  {row.readAt ? `Read ${formatDayTime(new Date(row.readAt))}` : "Not read yet"}
                </span>
                <time className="pt-inbox__when">{formatDayTime(new Date(row.at))}</time>
              </div>
              <p className="pt-inbox__body">{row.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
