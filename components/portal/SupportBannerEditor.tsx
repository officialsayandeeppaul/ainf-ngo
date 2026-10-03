"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LiveCountdown } from "@/components/portal/LiveCountdown";
import { PortalDateTimeField } from "@/components/portal/PortalDateTimeField";
import type { SupportBannerView } from "@/lib/support-banner";

function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInputValue(value: string) {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function demoEndsLocal() {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  date.setHours(18, 0, 0, 0);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

/** Admin editor + live preview for the support campaign banner. */
export function SupportBannerEditor({ initial }: { initial: SupportBannerView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [headline, setHeadline] = useState(initial.headline);
  const [message, setMessage] = useState(initial.message);
  const [ctaLabel, setCtaLabel] = useState(initial.ctaLabel || "Support AINF");
  const [ctaHref, setCtaHref] = useState(initial.ctaHref || "/donate-now");
  const [endsLocal, setEndsLocal] = useState(() => toLocalInputValue(initial.endsAt));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const endsAtIso = useMemo(() => fromLocalInputValue(endsLocal), [endsLocal]);
  const busy = pending;

  function loadDemo() {
    setHeadline("Winter warm kit drive");
    setMessage("Help us pack 200 kits for Nala families before the deadline.");
    setCtaLabel("Support AINF");
    setCtaHref("/donate-now");
    setEndsLocal(demoEndsLocal());
    setEnabled(true);
    setError(null);
    setNotice("Demo filled — turn Live on is already checked. Click Save to publish.");
  }

  async function save() {
    setError(null);
    setNotice(null);
    const response = await fetch("/api/admin/support-banner", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enabled,
        headline: headline.trim(),
        message: message.trim(),
        ctaLabel: ctaLabel.trim() || "Support AINF",
        ctaHref: ctaHref.trim() || "/donate-now",
        endsAt: endsAtIso,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload?.message ?? "Could not save the support banner.");
      return;
    }
    setNotice(enabled ? "Support banner is live." : "Support banner saved (currently off).");
    startTransition(() => router.refresh());
  }

  return (
    <section className="pt-card pt-support-admin">
      <div className="pt-support-admin__head">
        <div>
          <h2 className="pt-section-title" style={{ marginBottom: 4 }}>
            Support campaign
          </h2>
          <p className="pt-hint" style={{ margin: 0 }}>
            Temporary promo under Support — headline, optional countdown, donate button. Live =
            visible on portal + public site.
          </p>
        </div>
        <label className="pt-support-admin__switch">
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <span>{enabled ? "Live (visible)" : "Off (hidden)"}</span>
        </label>
      </div>

      <div className="pt-support-admin__grid">
        <label className="pt-label" htmlFor="support-headline">
          Headline
          <input
            id="support-headline"
            className="pt-input"
            value={headline}
            disabled={busy}
            maxLength={120}
            placeholder="Winter warm kit drive"
            onChange={(event) => setHeadline(event.target.value)}
          />
        </label>

        <div className="pt-label">
          Countdown ends (optional)
          <PortalDateTimeField
            id="support-ends"
            value={endsLocal}
            disabled={busy}
            placeholder="Pick date & time"
            ariaLabel="Countdown end date and time"
            onChange={setEndsLocal}
          />
          <span className="pt-hint" style={{ display: "block", marginTop: 4 }}>
            Live timer for visitors. Leave empty for message only.
          </span>
        </div>

        <label className="pt-label pt-support-admin__span" htmlFor="support-message">
          Message
          <textarea
            id="support-message"
            className="pt-input pt-textarea"
            rows={3}
            value={message}
            disabled={busy}
            maxLength={500}
            placeholder="Help us pack 200 kits for Nala families before the deadline."
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>

        <label className="pt-label" htmlFor="support-cta-label">
          Button label
          <input
            id="support-cta-label"
            className="pt-input"
            value={ctaLabel}
            disabled={busy}
            maxLength={40}
            onChange={(event) => setCtaLabel(event.target.value)}
          />
        </label>

        <label className="pt-label" htmlFor="support-cta-href">
          Button link
          <input
            id="support-cta-href"
            className="pt-input"
            value={ctaHref}
            disabled={busy}
            maxLength={200}
            placeholder="/donate-now"
            onChange={(event) => setCtaHref(event.target.value)}
          />
        </label>
      </div>

      <div className="pt-support-admin__preview" aria-label="Live preview">
        <p className="pt-dossier-meta" style={{ marginBottom: 10 }}>
          Preview
        </p>
        <div className={`pt-support-banner${enabled ? " is-live" : ""}`}>
          <div className="pt-support-banner__copy">
            <p className="pt-support-banner__kicker">{enabled ? "Live on site" : "Preview only"}</p>
            <p className="pt-support-banner__title">{headline.trim() || "Campaign headline"}</p>
            <p className="pt-support-banner__text">
              {message.trim() || "Your support message appears here."}
            </p>
          </div>
          {endsAtIso ? <LiveCountdown endsAt={endsAtIso} /> : null}
          <a className="pt-btn pt-btn--primary pt-btn--sm" href={ctaHref || "/donate-now"}>
            {ctaLabel.trim() || "Support AINF"}
          </a>
        </div>
      </div>

      <div className="pt-card__foot pt-btn-row">
        <button
          type="button"
          className="pt-btn pt-btn--primary pt-btn--pop"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save support banner"}
        </button>
        <button type="button" className="pt-btn pt-btn--secondary" disabled={busy} onClick={loadDemo}>
          Fill demo
        </button>
        {endsLocal ? (
          <button
            type="button"
            className="pt-btn pt-btn--ghost"
            disabled={busy}
            onClick={() => setEndsLocal("")}
          >
            Clear countdown
          </button>
        ) : null}
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
    </section>
  );
}
