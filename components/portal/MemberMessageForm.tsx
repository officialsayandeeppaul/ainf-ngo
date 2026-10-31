"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Write to AINF from the dashboard. It goes through the contact form API, which
 * files it under the signed-in account, so the reply shows in this inbox.
 */
export function MemberMessageForm({
  name,
  email,
  phone,
}: {
  name: string;
  /** Empty for mobile sign-ups, who type an address the team can email. */
  email: string;
  phone: string;
}) {
  const router = useRouter();
  const id = useId();
  const [who, setWho] = useState(name);
  const [address, setAddress] = useState(email);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const canSend = who.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.trim()) && message.trim().length >= 5;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSend || busy) return;
    setBusy(true);
    setError(null);
    setSent(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ name: who.trim(), email: address.trim(), phone, message: message.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) {
        setError(payload?.message ?? "Your message did not send. Try again.");
        return;
      }
      setMessage("");
      setSent("Sent. The reply will appear in this inbox.");
      router.refresh();
    } catch {
      setError("The connection dropped. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="pt-inbox-form" onSubmit={(event) => void submit(event)} noValidate>
      {name ? (
        <p className="pt-hint" style={{ margin: 0 }}>
          From <strong>{name}</strong>
          {email ? ` · ${email}` : ""}
        </p>
      ) : (
        <label className="pt-label" htmlFor={`${id}-name`}>
          Your name
          <input
            id={`${id}-name`}
            className="pt-input"
            maxLength={120}
            value={who}
            autoComplete="name"
            onChange={(event) => setWho(event.target.value)}
          />
        </label>
      )}
      {email ? null : (
        <label className="pt-label" htmlFor={`${id}-email`}>
          Email for the reply
          <input
            id={`${id}-email`}
            className="pt-input"
            type="email"
            maxLength={200}
            value={address}
            autoComplete="email"
            onChange={(event) => setAddress(event.target.value)}
          />
        </label>
      )}
      <label className="pt-label" htmlFor={`${id}-message`}>
        Your message
        <textarea
          id={`${id}-message`}
          className="pt-input pt-textarea"
          rows={5}
          maxLength={4000}
          value={message}
          placeholder="Write to the AINF team…"
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>
      <div className="pt-btn-row">
        <button type="submit" className="pt-btn pt-btn--primary" disabled={!canSend || busy}>
          {busy ? "Sending…" : "Send message"}
        </button>
      </div>
      {sent ? (
        <p className="pt-hint" style={{ margin: 0, color: "var(--ainf-green-dark)" }} role="status">
          {sent}
        </p>
      ) : null}
      {error ? (
        <p className="pt-alert pt-alert--error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
