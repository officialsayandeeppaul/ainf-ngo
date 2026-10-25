"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/portal/ConfirmDialog";
import { PortalDateField } from "@/components/portal/PortalDateField";
import { PortalSelect } from "@/components/portal/PortalSelect";

export type GrantTier = { id: string; name: string; badge: string; active: boolean };

const LENGTHS = [
  { value: "1m", label: "1 month" },
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "1y", label: "1 year" },
  { value: "2y", label: "2 years" },
  { value: "5y", label: "5 years" },
  { value: "custom", label: "Until a date" },
] as const;

type Length = (typeof LENGTHS)[number]["value"];

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, payload };
}

/** Free membership on any plan for a signed-up account. Card issues automatically. */
export function GrantMembershipButton({
  userId,
  tiers,
  current,
  suspended,
}: {
  userId: string;
  tiers: GrantTier[];
  current: { tierName: string; untilLabel: string; recurring: boolean } | null;
  suspended: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tierId, setTierId] = useState(tiers.find((tier) => tier.active)?.id ?? tiers[0]?.id ?? "");
  const [length, setLength] = useState<Length>("1y");
  const [until, setUntil] = useState("");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (tiers.length === 0) {
    return <span className="pt-hint">Create a plan first to grant membership.</span>;
  }

  function close() {
    if (busy) return;
    setOpen(false);
    setError(null);
  }

  async function submit() {
    if (!tierId) {
      setError("Choose a plan.");
      return;
    }
    if (length === "custom" && !until) {
      setError("Pick the date the membership ends.");
      return;
    }
    setBusy(true);
    setError(null);
    const { ok, payload } = await postJson(`/api/admin/users/${userId}/membership/grant`, {
      tierId,
      length,
      until: length === "custom" ? until : undefined,
      note: note.trim() || undefined,
      notify,
    });
    setBusy(false);
    if (!ok) {
      setError(String(payload.message ?? "Could not grant membership."));
      return;
    }
    const regNo = payload.cardRegNo ? ` Card ${String(payload.cardRegNo)} issued.` : "";
    setDone(`Membership granted until ${String(payload.expiresLabel ?? "")}.${regNo}`);
    setOpen(false);
    setNote("");
    startTransition(() => router.refresh());
  }

  const chosen = tiers.find((tier) => tier.id === tierId);

  return (
    <>
      <button type="button" className="pt-btn pt-btn--primary" disabled={pending} onClick={() => setOpen(true)}>
        {current ? "Change or extend for free" : "Make member (free)"}
      </button>
      {done ? (
        <p className="pt-hint" role="status" style={{ margin: "8px 0 0" }}>
          {done}
        </p>
      ) : null}
      <ConfirmDialog
        open={open}
        title={current ? "Grant a new membership term" : "Make this account a member"}
        body="No payment and no identity check. The badge goes live now and the membership card is issued automatically."
        confirmLabel={chosen ? `Grant ${chosen.name}` : "Grant membership"}
        busy={busy}
        onCancel={close}
        onConfirm={() => void submit()}
      >
        <div className="pt-grant">
          <label className="pt-label" htmlFor={`grant-tier-${userId}`}>
            Plan and badge
          </label>
          <PortalSelect
            id={`grant-tier-${userId}`}
            ariaLabel="Plan"
            value={tierId}
            options={tiers.map((tier) => ({
              value: tier.id,
              label: tier.name,
              hint: `${tier.badge}${tier.active ? "" : " · hidden from members"}`,
            }))}
            onChange={setTierId}
          />

          <p className="pt-label" style={{ margin: "14px 0 6px" }}>
            How long
          </p>
          <div className="pt-segment pt-segment--wrap" role="radiogroup" aria-label="Membership length">
            {LENGTHS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={length === option.value}
                className={`pt-segment__btn${length === option.value ? " is-on" : ""}`}
                onClick={() => setLength(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {length === "custom" ? (
            <div style={{ marginTop: 10 }}>
              <PortalDateField
                id={`grant-until-${userId}`}
                ariaLabel="Membership ends on"
                value={until}
                placeholder="Ends on"
                onChange={setUntil}
              />
            </div>
          ) : null}

          <label className="pt-label" htmlFor={`grant-note-${userId}`} style={{ marginTop: 14 }}>
            Note for the audit log (optional)
          </label>
          <textarea
            id={`grant-note-${userId}`}
            className="pt-textarea"
            rows={2}
            maxLength={500}
            value={note}
            placeholder="Why this account is getting membership"
            onChange={(event) => setNote(event.target.value)}
          />
          <label className="pt-check">
            <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} />
            Email the member that they are now a member
          </label>

          {current ? (
            <p className="pt-alert pt-alert--warning" style={{ marginTop: 12 }}>
              This replaces the current {current.tierName} term (until {current.untilLabel}).
              {current.recurring ? " Their Razorpay auto-renew will be stopped so they are not charged again." : ""}
            </p>
          ) : null}
          {suspended ? (
            <p className="pt-alert pt-alert--warning" style={{ marginTop: 12 }}>
              This account is suspended. The badge is recorded now; the card is issued once they are reinstated.
            </p>
          ) : null}
          {error ? <p className="pt-alert pt-alert--error">{error}</p> : null}
        </div>
      </ConfirmDialog>
    </>
  );
}

/** Skip Didit, PAN, and OTP for one member, or take that back. */
export function IdentityAdminControls({
  userId,
  adminVerified,
  verified,
}: {
  userId: string;
  adminVerified: { atLabel: string; byEmail: string | null; note: string | null } | null;
  verified: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<null | "verify" | "remove">(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: "verify" | "remove") {
    setBusy(true);
    setError(null);
    const { ok, payload } = await postJson(
      `/api/admin/users/${userId}/identity`,
      action === "verify" ? { action, note: note.trim() || undefined, notify } : { action }
    );
    setBusy(false);
    if (!ok) {
      setError(String(payload.message ?? "Could not update verification."));
      return;
    }
    setOpen(null);
    setNote("");
    startTransition(() => router.refresh());
  }

  return (
    <div className="pt-identity-admin">
      {adminVerified ? (
        <div className="pt-identity-admin__state">
          <span className="pt-badge pt-badge--success">
            <span className="pt-badge__dot" aria-hidden="true" />
            Verified by admin
          </span>
          <span className="pt-hint">
            {adminVerified.atLabel}
            {adminVerified.byEmail ? ` · by ${adminVerified.byEmail}` : ""}
            {adminVerified.note ? ` · ${adminVerified.note}` : ""}
          </span>
        </div>
      ) : null}
      <div className="pt-btn-row">
        {adminVerified ? (
          <button type="button" className="pt-btn pt-btn--secondary" disabled={pending} onClick={() => setOpen("remove")}>
            Remove admin verification
          </button>
        ) : (
          <button type="button" className="pt-btn pt-btn--secondary" disabled={pending} onClick={() => setOpen("verify")}>
            {verified ? "Mark verified by admin" : "Verify identity (skip checks)"}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={open === "verify"}
        title="Verify this identity without checks?"
        body="Skips Didit, PAN, and the mobile code. The member becomes a verified member and can take any plan. This is recorded with your name."
        confirmLabel="Yes, verify"
        busy={busy}
        onCancel={() => {
          if (!busy) {
            setOpen(null);
            setError(null);
          }
        }}
        onConfirm={() => void submit("verify")}
      >
        <label className="pt-label" htmlFor={`identity-note-${userId}`}>
          Reason (optional)
        </label>
        <textarea
          id={`identity-note-${userId}`}
          className="pt-textarea"
          rows={2}
          maxLength={500}
          value={note}
          placeholder="e.g. Documents checked in person at the Nala office"
          onChange={(event) => setNote(event.target.value)}
        />
        <label className="pt-check">
          <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} />
          Email the member that they are verified
        </label>
        {error ? <p className="pt-alert pt-alert--error">{error}</p> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={open === "remove"}
        title="Remove admin verification?"
        body="Their identity status goes back to what their own Didit, PAN, and mobile-code records show. If those are not enough, they lose verified member access. An active membership is not ended."
        confirmLabel="Yes, remove"
        tone="danger"
        busy={busy}
        onCancel={() => {
          if (!busy) {
            setOpen(null);
            setError(null);
          }
        }}
        onConfirm={() => void submit("remove")}
      >
        {error ? <p className="pt-alert pt-alert--error">{error}</p> : null}
      </ConfirmDialog>
    </div>
  );
}
