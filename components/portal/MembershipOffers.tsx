"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatInr, paiseToRupees } from "@/lib/membership";
import { ConfirmDialog } from "@/components/portal/ConfirmDialog";
import { PortalDateField } from "@/components/portal/PortalDateField";
import { PortalSelect } from "@/components/portal/PortalSelect";

type OfferRow = {
  id: string;
  name: string;
  kind: "PERCENT" | "FLAT";
  value: number;
  interval: "MONTHLY" | "YEARLY" | null;
  active: boolean;
  firstCycleOnly: boolean;
  startsAt: string | null;
  endsAt: string | null;
  tierIds: string[];
};

type PlanOption = { id: string; name: string; badge: string };

function toDay(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function MembershipOffers({
  offers,
  plans,
}: {
  offers: OfferRow[];
  plans: PlanOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"PERCENT" | "FLAT">("PERCENT");
  const [value, setValue] = useState("10");
  const [interval, setInterval] = useState<"" | "MONTHLY" | "YEARLY">("");
  const [firstCycleOnly, setFirstCycleOnly] = useState(true);
  const [active, setActive] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [tierIds, setTierIds] = useState<string[]>([]);
  const [removeId, setRemoveId] = useState<string | null>(null);

  function reset() {
    setEditingId(null);
    setName("");
    setKind("PERCENT");
    setValue("10");
    setInterval("");
    setFirstCycleOnly(true);
    setActive(true);
    setStartsAt("");
    setEndsAt("");
    setTierIds([]);
    setError(null);
  }

  function fill(offer: OfferRow) {
    setEditingId(offer.id);
    setName(offer.name);
    setKind(offer.kind);
    setValue(String(offer.kind === "FLAT" ? paiseToRupees(offer.value) : offer.value));
    setInterval(offer.interval ?? "");
    setFirstCycleOnly(offer.firstCycleOnly);
    setActive(offer.active);
    setStartsAt(toDay(offer.startsAt));
    setEndsAt(toDay(offer.endsAt));
    setTierIds(offer.tierIds);
    setError(null);
  }

  function toggleTier(id: string) {
    setTierIds((current) => (current.includes(id) ? current.filter((row) => row !== id) : [...current, id]));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (tierIds.length === 0) {
      setError("Attach the offer to at least one plan.");
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      name,
      kind,
      value: Number(value),
      interval: interval || null,
      firstCycleOnly,
      active,
      startsAt: startsAt ? new Date(`${startsAt}T00:00:00`).toISOString() : null,
      endsAt: endsAt ? new Date(`${endsAt}T23:59:59`).toISOString() : null,
      tierIds,
    };
    const result = await fetch(editingId ? `/api/admin/membership/offers/${editingId}` : "/api/admin/membership/offers", {
      method: editingId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await result.json().catch(() => ({}));
    setBusy(false);
    if (!result.ok) {
      setError(payload.message ?? "Could not save this offer.");
      return;
    }
    reset();
    startTransition(() => router.refresh());
  }

  async function remove(id: string) {
    setBusy(true);
    const result = await fetch(`/api/admin/membership/offers/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!result.ok) {
      setError("Could not delete this offer.");
      return;
    }
    if (editingId === id) reset();
    setRemoveId(null);
    startTransition(() => router.refresh());
  }

  const locked = busy || pending;

  return (
    <section className="pt-card">
      <h2 className="pt-section-title">{editingId ? "Edit offer" : "Plan offers"}</h2>
      <p className="pt-hint" style={{ marginTop: 0 }}>
        Attach a campaign to specific plans. Members see the cut on first cycle (and on upgrade /
        downgrade). Unused time is credited when they switch, like Jio or Netflix.
      </p>
      <form onSubmit={save}>
        <div className="pt-plan-grid">
          <div>
            <label className="pt-label" htmlFor="offer-name">
              Name
            </label>
            <input
              id="offer-name"
              className="pt-input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Founding 10% off"
            />
          </div>
          <div>
            <label className="pt-label" htmlFor="offer-kind">
              Discount
            </label>
            <PortalSelect
              id="offer-kind"
              value={kind}
              options={[
                { value: "PERCENT", label: "Percent off" },
                { value: "FLAT", label: "Flat ₹ off" },
              ]}
              onChange={(next) => setKind(next as "PERCENT" | "FLAT")}
            />
          </div>
          <div>
            <label className="pt-label" htmlFor="offer-value">
              {kind === "FLAT" ? "₹ off" : "% off"}
            </label>
            <input
              id="offer-value"
              className="pt-input"
              type="number"
              min={0}
              step="0.01"
              max={kind === "PERCENT" ? 90 : undefined}
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div>
            <label className="pt-label" htmlFor="offer-interval">
              Billing
            </label>
            <PortalSelect
              id="offer-interval"
              value={interval}
              options={[
                { value: "", label: "Monthly and yearly" },
                { value: "MONTHLY", label: "Monthly only" },
                { value: "YEARLY", label: "Yearly only" },
              ]}
              onChange={(next) => setInterval(next as "" | "MONTHLY" | "YEARLY")}
            />
          </div>
          <div>
            <label className="pt-label" htmlFor="offer-start">
              Starts
            </label>
            <PortalDateField
              id="offer-start"
              value={startsAt}
              placeholder="Starts"
              onChange={setStartsAt}
            />
          </div>
          <div>
            <label className="pt-label" htmlFor="offer-end">
              Ends
            </label>
            <PortalDateField id="offer-end" value={endsAt} placeholder="Ends" onChange={setEndsAt} />
          </div>
        </div>
        <p className="pt-label" style={{ marginTop: 14 }}>
          Attach to plans
        </p>
        <div className="pt-chips" style={{ marginTop: 8 }}>
          {plans.map((plan) => (
            <label className="pt-check" key={plan.id} style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={tierIds.includes(plan.id)}
                onChange={() => toggleTier(plan.id)}
              />
              {plan.badge}
            </label>
          ))}
        </div>
        <label className="pt-check">
          <input
            type="checkbox"
            checked={firstCycleOnly}
            onChange={(e) => setFirstCycleOnly(e.target.checked)}
          />
          First cycle only (not later auto-renewals)
        </label>
        <label className="pt-check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Offer is live
        </label>
        {error ? <p className="pt-alert pt-alert--error">{error}</p> : null}
        <div className="pt-btn-row" style={{ marginTop: 14 }}>
          <button type="submit" className="pt-btn pt-btn--primary" disabled={locked}>
            {editingId ? "Save offer" : "Add offer"}
          </button>
          {editingId ? (
            <button type="button" className="pt-btn pt-btn--ghost" onClick={reset}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      {offers.length === 0 ? (
        <p className="pt-hint">No offers yet. Attach one to Gold if you want a launch price.</p>
      ) : (
        <ul className="pt-log" style={{ marginTop: 18 }}>
          {offers.map((offer) => (
            <li className="pt-log__row" key={offer.id}>
              <div className="pt-log__who">
                {offer.name}
                <div className="pt-log__sub">
                  {offer.kind === "PERCENT" ? `${offer.value}% off` : `${formatInr(offer.value)} off`}
                  {offer.interval ? ` · ${offer.interval.toLowerCase()}` : " · both cycles"}
                  {offer.firstCycleOnly ? " · first cycle" : ""}
                  {offer.active ? "" : " · paused"}
                </div>
              </div>
              <div className="pt-btn-row">
                <button type="button" className="pt-btn pt-btn--secondary pt-btn--sm" onClick={() => fill(offer)}>
                  Edit
                </button>
                <button type="button" className="pt-btn pt-btn--ghost pt-btn--sm" onClick={() => setRemoveId(offer.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(removeId)}
        title="Remove this offer?"
        body="It is detached from every plan. Existing paid memberships are not changed."
        confirmLabel="Remove offer"
        tone="danger"
        busy={busy}
        onCancel={() => setRemoveId(null)}
        onConfirm={() => {
          if (removeId) void remove(removeId);
        }}
      />
    </section>
  );
}
