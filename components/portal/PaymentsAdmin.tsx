"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/portal/ConfirmDialog";
import { NON_REFUNDABLE_PAYMENT } from "@/lib/payment-policy";

export type InterestRow = {
  id: string;
  purpose: "DONATION" | "MEMBERSHIP";
  status: "OPEN" | "CONTACTED" | "LINK_SENT" | "PAID" | "DISMISSED";
  name: string;
  email: string;
  phone: string | null;
  what: string;
  amountPaise: number;
  amountLabel: string;
  attempts: number;
  firstLabel: string;
  lastLabel: string;
  source: string | null;
  adminNote: string | null;
  crmHref: string | null;
  link: {
    id: string;
    status: "CREATED" | "PAID" | "EXPIRED" | "CANCELLED" | "FAILED";
    shortUrl: string | null;
    amountLabel: string;
    expiresLabel: string | null;
    expired: boolean;
    paidLabel: string | null;
    emailed: boolean;
    lastError: string | null;
  } | null;
};

export type LinkRow = {
  id: string;
  purpose: "DONATION" | "MEMBERSHIP";
  status: "CREATED" | "PAID" | "EXPIRED" | "CANCELLED" | "FAILED";
  who: string;
  email: string;
  what: string;
  amountLabel: string;
  createdLabel: string;
  expiresLabel: string | null;
  expired: boolean;
  paidLabel: string | null;
  shortUrl: string | null;
  paymentId: string | null;
  lastError: string | null;
};

type Settings = {
  enabled: boolean;
  envPaused: boolean;
  open: boolean;
  pausedMessage: string;
  pausedAt: string | null;
  updatedAt: string | null;
};

type QueueNav = {
  current: string;
  tabs: Array<{ key: string; label: string; count: number; href: string }>;
  purpose: "all" | "gift" | "membership";
  search: string;
  purposeHref: Record<"all" | "gift" | "membership", string>;
};

const STATUS_LABEL: Record<InterestRow["status"], string> = {
  OPEN: "New",
  CONTACTED: "Contacted",
  LINK_SENT: "Link sent",
  PAID: "Paid",
  DISMISSED: "Dismissed",
};

const STATUS_TONE: Record<InterestRow["status"], string> = {
  OPEN: "pt-badge--warning",
  CONTACTED: "pt-badge--info",
  LINK_SENT: "pt-badge--info",
  PAID: "pt-badge--success",
  DISMISSED: "pt-badge--neutral",
};

const LINK_LABEL: Record<LinkRow["status"], string> = {
  CREATED: "Waiting for payment",
  PAID: "Paid",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  FAILED: "Not created",
};

const LINK_TONE: Record<LinkRow["status"], string> = {
  CREATED: "pt-badge--info",
  PAID: "pt-badge--success",
  EXPIRED: "pt-badge--neutral",
  CANCELLED: "pt-badge--neutral",
  FAILED: "pt-badge--danger",
};

const EXPIRY = [1, 3, 7, 14, 30];

function rupeesToPaise(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

async function send(url: string, method: "POST" | "PATCH", body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, payload };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  }
}

export function PaymentsAdmin({
  settings,
  webhookOn,
  interests,
  links,
  queue,
}: {
  settings: Settings;
  webhookOn: boolean;
  interests: InterestRow[];
  links: LinkRow[];
  queue: QueueNav;
}) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [message, setMessage] = useState(settings.pausedMessage);
  const [switchTo, setSwitchTo] = useState<boolean | null>(null);

  const [linkFor, setLinkFor] = useState<InterestRow | null>(null);
  const [amount, setAmount] = useState("");
  const [expiry, setExpiry] = useState(7);
  const [sms, setSms] = useState(true);
  const [rzpEmail, setRzpEmail] = useState(false);
  const [ainfEmail, setAinfEmail] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [made, setMade] = useState<{ url: string; who: string; emailNote: string } | null>(null);

  const [noteFor, setNoteFor] = useState<InterestRow | null>(null);
  const [noteText, setNoteText] = useState("");
  const [confirm, setConfirm] = useState<null | { kind: "dismiss" | "cancel"; id: string; label: string }>(null);

  useEffect(() => setMessage(settings.pausedMessage), [settings.pausedMessage]);

  function refresh(text?: string) {
    if (text) setNotice(text);
    startTransition(() => router.refresh());
  }

  function fail(text: string) {
    setError(text);
    setNotice(null);
  }

  async function saveSettings(enabled: boolean) {
    setBusy("settings");
    setError(null);
    const { ok, payload } = await send("/api/admin/payments/settings", "PATCH", { enabled, pausedMessage: message });
    setBusy(null);
    setSwitchTo(null);
    if (!ok) return fail(String(payload.message ?? "Could not save the payment switch."));
    refresh(
      enabled === settings.enabled
        ? "Message saved."
        : enabled
          ? "Online payments are live again. Send links to the waiting list below."
          : "Online payments are paused. New attempts are saved as interest."
    );
  }

  function openLink(row: InterestRow) {
    setLinkFor(row);
    setAmount(String(row.amountPaise / 100));
    setExpiry(7);
    setSms(Boolean(row.phone));
    setRzpEmail(false);
    setAinfEmail(true);
    setLinkError(null);
  }

  async function createLink() {
    if (!linkFor) return;
    const paise = rupeesToPaise(amount);
    if (paise == null || paise < 100) {
      setLinkError("Enter an amount in rupees, at least ₹1.");
      return;
    }
    setBusy("link");
    setLinkError(null);
    const { ok, payload } = await send(`/api/admin/payments/interests/${linkFor.id}/link`, "POST", {
      amountPaise: paise,
      expiresInDays: expiry,
      notifySms: sms,
      notifyEmail: rzpEmail,
      sendAinfEmail: ainfEmail,
    });
    setBusy(null);
    if (!ok) {
      setLinkError(String(payload.message ?? "Could not create the link."));
      return;
    }
    const link = payload.link as { shortUrl: string | null } | undefined;
    const email = payload.email as { sent: boolean; error: string | null } | null;
    setMade({
      url: link?.shortUrl ?? "",
      who: linkFor.name,
      emailNote: email
        ? email.sent
          ? `Emailed to ${linkFor.email}.`
          : `AINF email not sent: ${email.error ?? "unknown reason"}. Share the link yourself.`
        : "No AINF email sent.",
    });
    setLinkFor(null);
    refresh();
  }

  async function interestAction(row: InterestRow, action: "contacted" | "dismiss" | "reopen" | "note", note?: string) {
    setBusy(`${action}:${row.id}`);
    setError(null);
    const { ok, payload } = await send(`/api/admin/payments/interests/${row.id}`, "PATCH", {
      action,
      ...(note !== undefined ? { note } : {}),
    });
    setBusy(null);
    if (!ok) return fail(String(payload.message ?? "Could not update this request."));
    refresh(
      action === "contacted"
        ? `${row.name} marked as contacted.`
        : action === "dismiss"
          ? `${row.name}'s request dismissed.`
          : action === "reopen"
            ? `${row.name}'s request is back in the queue.`
            : "Note saved."
    );
  }

  async function linkAction(id: string, action: "sync" | "cancel" | "resend") {
    setBusy(`${action}:${id}`);
    setError(null);
    const { ok, payload } = await send(`/api/admin/payments/links/${id}`, "POST", { action });
    setBusy(null);
    if (!ok) return fail(String(payload.message ?? "Razorpay did not answer."));
    if (action === "sync") {
      refresh(payload.changed ? `Updated from Razorpay: ${String(payload.status).toLowerCase()}.` : "Already up to date with Razorpay.");
    } else if (action === "cancel") {
      refresh("Link cancelled. The request is back in the queue for a new link.");
    } else {
      const bits = [
        payload.emailed ? "email sent" : `email not sent${payload.emailError ? ` (${String(payload.emailError)})` : ""}`,
        payload.sms ? "Razorpay SMS sent" : null,
      ].filter(Boolean);
      refresh(`Link resent: ${bits.join(", ")}.`);
    }
  }

  async function copy(url: string) {
    const ok = await copyText(url);
    setNotice(ok ? "Link copied." : "Copy failed. Select the link and copy it by hand.");
  }

  const disabled = busy !== null || refreshing;
  const pendingSwitch = switchTo !== null;

  return (
    <div className="pt-pay-desk">
      {error ? (
        <p className="pt-alert pt-alert--error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="pt-alert pt-alert--success" role="status">
          {notice}
        </p>
      ) : null}

      <section className={`pt-card pt-pay-switch${settings.open ? "" : " is-paused"}`}>
        <div className="pt-pay-switch__head">
          <div>
            <h2 className="pt-section-title" style={{ margin: 0 }}>
              Online payments
            </h2>
            <p className="pt-hint" style={{ margin: "6px 0 0" }}>
              {settings.envPaused
                ? "Paused by the PAYMENTS_PAUSED environment variable. Remove it on the host to use this switch."
                : settings.open
                  ? "Donations and membership plans open Razorpay checkout as normal."
                  : `Paused${settings.pausedAt ? ` since ${new Date(settings.pausedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : ""}. Anyone who tries to pay sees a thank-you window and lands in the queue below.`}
            </p>
          </div>
          <label className="pt-switch">
            <input
              type="checkbox"
              role="switch"
              checked={settings.enabled}
              aria-checked={settings.enabled}
              disabled={disabled || settings.envPaused}
              onChange={(event) => setSwitchTo(event.target.checked)}
            />
            <span className="pt-switch__track" aria-hidden="true" />
            <span className="pt-switch__label">{settings.enabled ? "On" : "Off"}</span>
          </label>
        </div>

        <label className="pt-label" htmlFor="pay-paused-message" style={{ marginTop: 16 }}>
          Message people see while payments are off
        </label>
        <textarea
          id="pay-paused-message"
          className="pt-textarea"
          rows={3}
          maxLength={600}
          value={message}
          placeholder="We are not taking online payments right now, but we have saved your interest. As soon as payments reopen, the AINF team will contact you with a secure payment link."
          onChange={(event) => setMessage(event.target.value)}
        />
        <div className="pt-btn-row" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="pt-btn pt-btn--secondary"
            disabled={disabled || message === settings.pausedMessage}
            onClick={() => void saveSettings(settings.enabled)}
          >
            Save message
          </button>
          <span className="pt-hint" style={{ margin: 0 }}>
            Leave empty for the standard wording. What they asked for and their email are always shown under it.
          </span>
        </div>
        <ul className="pt-pay-switch__facts">
          <li>Payment links you send keep working while payments are off.</li>
          <li>Existing auto-renew mandates keep charging; stop them per member in the CRM.</li>
          <li>
            {webhookOn
              ? "Razorpay webhook is set: paid links settle on their own. Enable the payment_link.paid, payment_link.expired, and payment_link.cancelled events on it."
              : "No Razorpay webhook secret: paid links settle when the payer returns, or when you press Check status."}
          </li>
        </ul>
      </section>

      <section className="pt-card pt-card--flush">
        <div className="pt-card__head pt-pay-queue__head">
          <h2 className="pt-section-title" style={{ margin: 0 }}>
            People who asked to pay
          </h2>
          <form className="pt-pay-search" method="get" role="search">
            {queue.current !== "active" ? <input type="hidden" name="queue" value={queue.current} /> : null}
            {queue.purpose !== "all" ? <input type="hidden" name="purpose" value={queue.purpose} /> : null}
            <input
              className="pt-input"
              type="search"
              name="q"
              defaultValue={queue.search}
              placeholder="Name, email, phone, or cause"
              aria-label="Search requests"
            />
          </form>
        </div>
        <div className="pt-pay-tabs">
          <nav className="pt-segment pt-segment--wrap" aria-label="Request status">
            {queue.tabs.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                className={`pt-segment__btn${queue.current === tab.key ? " is-on" : ""}`}
                aria-current={queue.current === tab.key ? "page" : undefined}
              >
                {tab.label} <span className="pt-pay-tabs__n">{tab.count}</span>
              </Link>
            ))}
          </nav>
          <nav className="pt-segment pt-segment--wrap" aria-label="Request type">
            {(["all", "gift", "membership"] as const).map((key) => (
              <Link
                key={key}
                href={queue.purposeHref[key]}
                className={`pt-segment__btn${queue.purpose === key ? " is-on" : ""}`}
                aria-current={queue.purpose === key ? "page" : undefined}
              >
                {key === "all" ? "Donations and plans" : key === "gift" ? "Donations" : "Plans"}
              </Link>
            ))}
          </nav>
        </div>

        {interests.length === 0 ? (
          <p className="pt-empty">
            {queue.search ? "No requests match that search." : "Nobody is waiting. Requests appear here while payments are paused."}
          </p>
        ) : (
          <div className="pt-table-wrap">
            <table className="pt-table pt-table--dossier pt-pay-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Asked for</th>
                  <th>Amount</th>
                  <th>When</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {interests.map((row) => {
                  const linkOut = row.link?.status === "CREATED";
                  return (
                    <tr key={row.id}>
                      <td>
                        {row.crmHref ? (
                          <Link href={row.crmHref} className="pt-user-link">
                            <div className="pt-dossier-plan">{row.name}</div>
                          </Link>
                        ) : (
                          <div className="pt-dossier-plan">{row.name}</div>
                        )}
                        <div className="pt-dossier-meta">
                          <a href={`mailto:${row.email}`}>{row.email}</a>
                          {row.phone ? (
                            <>
                              {" · "}
                              <a href={`tel:${row.phone.replace(/[^\d+]/g, "")}`}>{row.phone}</a>
                            </>
                          ) : null}
                        </div>
                        {row.adminNote ? <div className="pt-dossier-meta pt-pay-note">Note: {row.adminNote}</div> : null}
                      </td>
                      <td>
                        <div className="pt-dossier-plan">{row.what}</div>
                        <div className="pt-dossier-meta">
                          {row.purpose === "MEMBERSHIP" ? "Membership" : "Donation"}
                          {row.attempts > 1 ? ` · tried ${row.attempts} times` : ""}
                          {row.source ? ` · ${row.source}` : ""}
                        </div>
                        {row.link && row.link.status === "FAILED" ? (
                          <div className="pt-dossier-meta pt-pay-note">
                            Last attempt failed{row.link.lastError ? `: ${row.link.lastError}` : ""}. You can send a new link.
                          </div>
                        ) : row.link ? (
                          <div className="pt-dossier-meta">
                            Link {LINK_LABEL[row.link.status].toLowerCase()}
                            {row.link.status === "CREATED" && row.link.expiresLabel
                              ? row.link.expired
                                ? " · expired"
                                : ` · until ${row.link.expiresLabel}`
                              : ""}
                            {row.link.paidLabel ? ` · ${row.link.paidLabel}` : ""}
                            {row.link.lastError && row.link.status !== "PAID" ? ` · ${row.link.lastError}` : ""}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <span className="pt-money">{row.link ? row.link.amountLabel : row.amountLabel}</span>
                      </td>
                      <td className="pt-dossier-when">
                        {row.lastLabel}
                        {row.attempts > 1 ? <div className="pt-dossier-meta">first {row.firstLabel}</div> : null}
                      </td>
                      <td>
                        <span className={`pt-badge pt-badge--lift ${STATUS_TONE[row.status]}`}>{STATUS_LABEL[row.status]}</span>
                      </td>
                      <td>
                        <div className="pt-pay-actions">
                          {row.status !== "PAID" && row.status !== "DISMISSED" && !linkOut ? (
                            <button
                              type="button"
                              className="pt-btn pt-btn--primary pt-btn--sm"
                              disabled={disabled}
                              onClick={() => openLink(row)}
                            >
                              Send payment link
                            </button>
                          ) : null}
                          {linkOut && row.link?.shortUrl ? (
                            <>
                              <button
                                type="button"
                                className="pt-btn pt-btn--secondary pt-btn--sm"
                                disabled={disabled}
                                onClick={() => void copy(row.link!.shortUrl!)}
                              >
                                Copy link
                              </button>
                              <button
                                type="button"
                                className="pt-btn pt-btn--ghost pt-btn--sm"
                                disabled={disabled || row.link.expired}
                                onClick={() => void linkAction(row.link!.id, "resend")}
                              >
                                Resend
                              </button>
                              <button
                                type="button"
                                className="pt-btn pt-btn--ghost pt-btn--sm"
                                disabled={disabled}
                                onClick={() => void linkAction(row.link!.id, "sync")}
                              >
                                Check status
                              </button>
                              <button
                                type="button"
                                className="pt-btn pt-btn--ghost pt-btn--sm"
                                disabled={disabled}
                                onClick={() => setConfirm({ kind: "cancel", id: row.link!.id, label: row.name })}
                              >
                                Cancel link
                              </button>
                            </>
                          ) : null}
                          {row.status === "OPEN" ? (
                            <button
                              type="button"
                              className="pt-btn pt-btn--ghost pt-btn--sm"
                              disabled={disabled}
                              onClick={() => void interestAction(row, "contacted")}
                            >
                              Mark contacted
                            </button>
                          ) : null}
                          {row.status === "DISMISSED" ? (
                            <button
                              type="button"
                              className="pt-btn pt-btn--ghost pt-btn--sm"
                              disabled={disabled}
                              onClick={() => void interestAction(row, "reopen")}
                            >
                              Reopen
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="pt-btn pt-btn--ghost pt-btn--sm"
                            disabled={disabled}
                            onClick={() => {
                              setNoteFor(row);
                              setNoteText(row.adminNote ?? "");
                            }}
                          >
                            Note
                          </button>
                          {row.status === "OPEN" || row.status === "CONTACTED" ? (
                            <button
                              type="button"
                              className="pt-btn pt-btn--ghost pt-btn--sm pt-pay-actions__quiet"
                              disabled={disabled}
                              onClick={() => setConfirm({ kind: "dismiss", id: row.id, label: row.name })}
                            >
                              Dismiss
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="pt-card pt-card--flush">
        <div className="pt-card__head">
          <h2 className="pt-section-title" style={{ margin: 0 }}>
            Payment links
          </h2>
          <span className="pt-hint" style={{ margin: 0 }}>
            Newest 30
          </span>
        </div>
        {links.length === 0 ? (
          <p className="pt-empty">No payment links yet. Send one from a request above.</p>
        ) : (
          <div className="pt-table-wrap">
            <table className="pt-table pt-table--dossier pt-pay-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>For</th>
                  <th>Amount</th>
                  <th>Sent</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.id}>
                    <td>
                      <div className="pt-dossier-plan">{link.who}</div>
                      <div className="pt-dossier-meta">{link.email}</div>
                    </td>
                    <td>
                      <div className="pt-dossier-plan">{link.what}</div>
                      {link.paymentId ? <div className="pt-dossier-meta">Payment {link.paymentId}</div> : null}
                      {link.lastError && link.status !== "PAID" ? (
                        <div className="pt-dossier-meta pt-pay-note">{link.lastError}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className="pt-money">{link.amountLabel}</span>
                    </td>
                    <td className="pt-dossier-when">
                      {link.createdLabel}
                      {link.status === "CREATED" && link.expiresLabel ? (
                        <div className="pt-dossier-meta">{link.expired ? "expired" : `until ${link.expiresLabel}`}</div>
                      ) : null}
                      {link.paidLabel ? <div className="pt-dossier-meta">paid {link.paidLabel}</div> : null}
                    </td>
                    <td>
                      <span className={`pt-badge pt-badge--lift ${LINK_TONE[link.status]}`}>{LINK_LABEL[link.status]}</span>
                    </td>
                    <td>
                      <div className="pt-pay-actions">
                        {link.shortUrl && link.status === "CREATED" ? (
                          <button
                            type="button"
                            className="pt-btn pt-btn--secondary pt-btn--sm"
                            disabled={disabled}
                            onClick={() => void copy(link.shortUrl!)}
                          >
                            Copy
                          </button>
                        ) : null}
                        {link.status === "CREATED" || link.status === "EXPIRED" || link.status === "CANCELLED" ? (
                          <button
                            type="button"
                            className="pt-btn pt-btn--ghost pt-btn--sm"
                            disabled={disabled}
                            onClick={() => void linkAction(link.id, "sync")}
                          >
                            Check status
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingSwitch}
        title={switchTo ? "Turn online payments back on?" : "Pause online payments?"}
        body={
          switchTo
            ? "Donation and membership checkout opens again for everyone. People in the queue are not charged automatically; send each of them a payment link."
            : "Nobody can pay through the site until you turn this back on. Anyone who tries sees a thank-you window, their request is saved here, and you can send them a payment link later."
        }
        confirmLabel={switchTo ? "Yes, turn on" : "Yes, pause payments"}
        tone={switchTo ? "primary" : "danger"}
        busy={busy === "settings"}
        onCancel={() => setSwitchTo(null)}
        onConfirm={() => {
          if (switchTo !== null) void saveSettings(switchTo);
        }}
      />

      <ConfirmDialog
        open={linkFor !== null}
        title={linkFor ? `Payment link for ${linkFor.name}` : "Payment link"}
        body={linkFor ? `${linkFor.what}. They asked to pay ${linkFor.amountLabel}.` : undefined}
        confirmLabel="Create and send link"
        busy={busy === "link"}
        onCancel={() => {
          if (busy !== "link") setLinkFor(null);
        }}
        onConfirm={() => void createLink()}
      >
        {linkFor ? (
          <div className="pt-pay-form">
            <label className="pt-label" htmlFor="pay-link-amount">
              Amount (₹)
            </label>
            <input
              id="pay-link-amount"
              className="pt-input"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            {linkFor.purpose === "MEMBERSHIP" ? (
              <p className="pt-hint" style={{ margin: "6px 0 0" }}>
                Paying activates the plan and issues the card, exactly like a checkout.
              </p>
            ) : (
              <p className="pt-hint" style={{ margin: "6px 0 0" }}>
                Paying records the donation and emails the receipt, exactly like a checkout.
              </p>
            )}
            <p className="pt-hint" style={{ margin: "4px 0 0" }}>
              The email and the Razorpay page both say: {NON_REFUNDABLE_PAYMENT}
            </p>

            <p className="pt-label" style={{ margin: "14px 0 6px" }}>
              Link works for
            </p>
            <div className="pt-segment pt-segment--wrap" role="radiogroup" aria-label="Link lifetime">
              {EXPIRY.map((days) => (
                <button
                  key={days}
                  type="button"
                  role="radio"
                  aria-checked={expiry === days}
                  className={`pt-segment__btn${expiry === days ? " is-on" : ""}`}
                  onClick={() => setExpiry(days)}
                >
                  {days === 1 ? "1 day" : `${days} days`}
                </button>
              ))}
            </div>

            <p className="pt-label" style={{ margin: "14px 0 0" }}>
              How to send it
            </p>
            <label className="pt-check">
              <input type="checkbox" checked={ainfEmail} onChange={(event) => setAinfEmail(event.target.checked)} />
              AINF email to {linkFor.email}
            </label>
            <label className="pt-check">
              <input
                type="checkbox"
                checked={sms && Boolean(linkFor.phone)}
                disabled={!linkFor.phone}
                onChange={(event) => setSms(event.target.checked)}
              />
              Razorpay SMS {linkFor.phone ? `to ${linkFor.phone}` : "(no phone on file)"}
            </label>
            <label className="pt-check">
              <input type="checkbox" checked={rzpEmail} onChange={(event) => setRzpEmail(event.target.checked)} />
              Razorpay email as well
            </label>
            {linkError ? <p className="pt-alert pt-alert--error">{linkError}</p> : null}
          </div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={made !== null}
        title="Payment link ready"
        body={made ? `${made.emailNote} You can also share it with ${made.who} on WhatsApp or SMS.` : undefined}
        confirmLabel="Done"
        hideCancel
        onCancel={() => setMade(null)}
        onConfirm={() => setMade(null)}
      >
        {made?.url ? (
          <div className="pt-pay-made">
            <input className="pt-input pt-input--mono" readOnly value={made.url} onFocus={(event) => event.target.select()} />
            <button type="button" className="pt-btn pt-btn--secondary pt-btn--sm" onClick={() => void copy(made.url)}>
              Copy
            </button>
          </div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={noteFor !== null}
        title={noteFor ? `Note on ${noteFor.name}` : "Note"}
        body="Only admins see this."
        confirmLabel="Save note"
        busy={busy?.startsWith("note:") ?? false}
        onCancel={() => setNoteFor(null)}
        onConfirm={() => {
          if (noteFor) {
            const row = noteFor;
            setNoteFor(null);
            void interestAction(row, "note", noteText.trim());
          }
        }}
      >
        <textarea
          className="pt-textarea"
          rows={3}
          maxLength={1000}
          value={noteText}
          aria-label="Note"
          placeholder="e.g. Called on 12 Nov, will pay after salary"
          onChange={(event) => setNoteText(event.target.value)}
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "cancel" ? "Cancel this payment link?" : "Dismiss this request?"}
        body={
          confirm?.kind === "cancel"
            ? `The link for ${confirm.label} stops working. The request goes back to the queue so you can send a new one.`
            : `${confirm?.label ?? "This person"} will not be contacted from this queue. You can reopen it from the Dismissed tab.`
        }
        confirmLabel={confirm?.kind === "cancel" ? "Yes, cancel link" : "Yes, dismiss"}
        tone="danger"
        busy={busy !== null}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          const target = confirm;
          setConfirm(null);
          if (target.kind === "cancel") void linkAction(target.id, "cancel");
          else {
            const row = interests.find((item) => item.id === target.id);
            if (row) void interestAction(row, "dismiss");
          }
        }}
      />
    </div>
  );
}
