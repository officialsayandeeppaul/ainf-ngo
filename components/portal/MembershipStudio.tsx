"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BADGE_COLORS,
  discountLabel,
  formatInr,
  paiseToRupees,
  yearlyPaise,
  yearlySavingsPaise,
  type YearlyDiscountKind,
} from "@/lib/membership";
import { ConfirmDialog } from "@/components/portal/ConfirmDialog";
import { PlanBenefitEditor, PlanBenefitStack } from "@/components/portal/PlanBenefits";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { parsePlanBenefits, type PlanBenefit } from "@/lib/plan-benefits";

type StudioSettings = {
  yearlyDiscountKind: YearlyDiscountKind;
  yearlyDiscountValue: number;
};

type StudioTier = {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  benefits?: unknown;
  monthlyPaise: number;
  yearlyDiscountKind: YearlyDiscountKind;
  yearlyDiscountValue: number;
  active: boolean;
};

type Draft = {
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  benefits: PlanBenefit[];
  monthlyRupees: string;
  yearlyDiscountKind: YearlyDiscountKind;
  yearlyDiscountValue: string;
  active: boolean;
};

function emptyDraft(settings: StudioSettings): Draft {
  return {
    name: "",
    badge: "",
    badgeColor: BADGE_COLORS[0].id,
    description: "",
    benefits: [],
    monthlyRupees: "499",
    yearlyDiscountKind: settings.yearlyDiscountKind,
    yearlyDiscountValue: String(
      settings.yearlyDiscountKind === "FLAT"
        ? paiseToRupees(settings.yearlyDiscountValue)
        : settings.yearlyDiscountValue
    ),
    active: true,
  };
}

function preview(draft: Draft) {
  const monthlyPaise = Math.round(Number(draft.monthlyRupees || 0) * 100);
  const value =
    draft.yearlyDiscountKind === "FLAT"
      ? Math.round(Number(draft.yearlyDiscountValue || 0) * 100)
      : Number(draft.yearlyDiscountValue || 0);
  const input = {
    monthlyPaise,
    yearlyDiscountKind: draft.yearlyDiscountKind,
    yearlyDiscountValue: value,
  };
  return {
    monthly: formatInr(monthlyPaise),
    yearly: formatInr(yearlyPaise(input)),
    save: formatInr(yearlySavingsPaise(input)),
    label: discountLabel(draft.yearlyDiscountKind, value),
  };
}

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, payload };
}

export function MembershipStudio({
  tiers,
  settings,
  razorpayOn,
  webhookOn,
}: {
  tiers: StudioTier[];
  settings: StudioSettings;
  razorpayOn: boolean;
  webhookOn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(settings));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const look = useMemo(() => preview(draft), [draft]);

  function fillFrom(tier: StudioTier) {
    setEditingId(tier.id);
    setDraft({
      name: tier.name,
      badge: tier.badge,
      badgeColor: tier.badgeColor,
      description: tier.description,
      benefits: parsePlanBenefits(tier.benefits),
      monthlyRupees: String(paiseToRupees(tier.monthlyPaise)),
      yearlyDiscountKind: tier.yearlyDiscountKind,
      yearlyDiscountValue: String(
        tier.yearlyDiscountKind === "FLAT"
          ? paiseToRupees(tier.yearlyDiscountValue)
          : tier.yearlyDiscountValue
      ),
      active: tier.active,
    });
    setError(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      name: draft.name,
      badge: draft.badge || draft.name,
      badgeColor: draft.badgeColor,
      description: draft.description,
      benefits: draft.benefits,
      monthlyRupees: Number(draft.monthlyRupees),
      yearlyDiscountKind: draft.yearlyDiscountKind,
      yearlyDiscountValue: Number(draft.yearlyDiscountValue || 0),
      active: draft.active,
    };
    const result = editingId
      ? await send(`/api/admin/membership/tiers/${editingId}`, "PATCH", body)
      : await send("/api/admin/membership/tiers", "POST", body);
    setBusy(false);
    if (!result.ok) {
      setError(result.payload?.message ?? "Could not save this plan.");
      return;
    }
    setEditingId(null);
    setDraft(emptyDraft(settings));
    startTransition(() => router.refresh());
  }

  async function remove(id: string) {
    setBusy(true);
    const result = await send(`/api/admin/membership/tiers/${id}`, "DELETE");
    setBusy(false);
    if (!result.ok) {
      setError(result.payload?.message ?? "Could not delete.");
      return;
    }
    if (editingId === id) {
      setEditingId(null);
      setDraft(emptyDraft(settings));
    }
    setRemoveId(null);
    startTransition(() => router.refresh());
  }

  async function saveDefaults(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const result = await send("/api/admin/membership/settings", "PATCH", {
      yearlyDiscountKind: form.get("yearlyDiscountKind"),
      yearlyDiscountValue: Number(form.get("yearlyDiscountValue") || 0),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.payload?.message ?? "Could not save defaults.");
      return;
    }
    startTransition(() => router.refresh());
  }

  const locked = busy || pending;

  return (
    <div className="pt-verify-stack">
      <section className="pt-card">
        <h2 className="pt-section-title">Payments</h2>
        <p className="pt-hint" style={{ marginTop: 0 }}>
          Members pay from <code>/account/membership</code>. Checkout uses the test key. Webhooks use a
          separate secret from the Razorpay dashboard.
        </p>
        <p className="pt-chips" style={{ marginTop: 12 }}>
          {razorpayOn ? (
            <span className="pt-badge pt-badge--success">Razorpay test keys on</span>
          ) : (
            <span className="pt-badge pt-badge--warning">Razorpay keys missing</span>
          )}
          {webhookOn ? (
            <span className="pt-badge pt-badge--success">Webhook secret on</span>
          ) : (
            <span className="pt-badge pt-badge--warning">Webhook secret waiting</span>
          )}
        </p>
        <p className="pt-hint">
          Webhook URL to paste in Razorpay: <code>/api/webhooks/razorpay</code> on your ngrok https origin.
          Events: <code>payment.captured</code> and <code>order.paid</code>.
        </p>
      </section>

      <section className="pt-card">
        <h2 className="pt-section-title">Default yearly discount</h2>
        <p className="pt-hint" style={{ marginTop: 0 }}>
          Pre-fills the form when you add a new member type. Each plan can still override this.
        </p>
        <form onSubmit={saveDefaults} className="pt-toolbar" style={{ padding: 0, border: 0, background: "none" }}>
          <div className="pt-toolbar__field">
            <label className="pt-label" htmlFor="def-kind">
              Type
            </label>
            <PortalSelect
              id="def-kind"
              name="yearlyDiscountKind"
              defaultValue={settings.yearlyDiscountKind}
              disabled={locked}
              options={[
                { value: "NONE", label: "No discount" },
                { value: "PERCENT", label: "Percent off" },
                { value: "FLAT", label: "Flat ₹ off" },
              ]}
            />
          </div>
          <div className="pt-toolbar__field pt-toolbar__field--sm">
            <label className="pt-label" htmlFor="def-value">
              Value
            </label>
            <input
              id="def-value"
              name="yearlyDiscountValue"
              className="pt-input"
              type="number"
              min={0}
              step="0.01"
              max={settings.yearlyDiscountKind === "PERCENT" ? 90 : undefined}
              defaultValue={
                settings.yearlyDiscountKind === "FLAT"
                  ? paiseToRupees(settings.yearlyDiscountValue)
                  : settings.yearlyDiscountValue
              }
              disabled={locked}
            />
          </div>
          <button type="submit" className="pt-btn pt-btn--secondary" disabled={locked}>
            Save default
          </button>
        </form>
      </section>

      <section className="pt-card">
        <h2 className="pt-section-title">{editingId ? "Edit member type" : "Add member type"}</h2>
        <form onSubmit={save}>
          <div className="pt-plan-grid">
            <div>
              <label className="pt-label" htmlFor="plan-name">
                Name
              </label>
              <input
                id="plan-name"
                className="pt-input"
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Gold member"
              />
            </div>
            <div>
              <label className="pt-label" htmlFor="plan-badge">
                Badge
              </label>
              <input
                id="plan-badge"
                className="pt-input"
                value={draft.badge}
                onChange={(e) => setDraft({ ...draft, badge: e.target.value })}
                placeholder="Gold"
              />
            </div>
            <div>
              <label className="pt-label">Badge colour</label>
              <div className="pt-color-row">
                {BADGE_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    className={`pt-color${draft.badgeColor === color.id ? " is-on" : ""}`}
                    style={{ background: color.id }}
                    aria-label={color.label}
                    onClick={() => setDraft({ ...draft, badgeColor: color.id })}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="pt-label" htmlFor="plan-month">
                Monthly (₹)
              </label>
              <input
                id="plan-month"
                className="pt-input"
                type="number"
                min={1}
                step="1"
                required
                value={draft.monthlyRupees}
                onChange={(e) => setDraft({ ...draft, monthlyRupees: e.target.value })}
              />
            </div>
            <div>
              <label className="pt-label" htmlFor="plan-kind">
                Yearly discount
              </label>
              <PortalSelect
                id="plan-kind"
                value={draft.yearlyDiscountKind}
                options={[
                  { value: "NONE", label: "No discount" },
                  { value: "PERCENT", label: "Percent off" },
                  { value: "FLAT", label: "Flat ₹ off" },
                ]}
                onChange={(next) =>
                  setDraft({ ...draft, yearlyDiscountKind: next as YearlyDiscountKind })
                }
              />
            </div>
            <div>
              <label className="pt-label" htmlFor="plan-off">
                {draft.yearlyDiscountKind === "FLAT" ? "₹ off the year" : "% off the year"}
              </label>
              <input
                id="plan-off"
                className="pt-input"
                type="number"
                min={0}
                step="0.01"
                max={draft.yearlyDiscountKind === "PERCENT" ? 90 : undefined}
                disabled={draft.yearlyDiscountKind === "NONE"}
                value={draft.yearlyDiscountValue}
                onChange={(e) => setDraft({ ...draft, yearlyDiscountValue: e.target.value })}
              />
            </div>
          </div>
          <label className="pt-label" htmlFor="plan-desc" style={{ marginTop: 14 }}>
            Short summary
          </label>
          <textarea
            id="plan-desc"
            className="pt-textarea"
            rows={2}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="One line under the plan name. Use the list below for what is and is not included."
          />
          <PlanBenefitEditor
            value={draft.benefits}
            disabled={locked}
            onChange={(benefits) => setDraft({ ...draft, benefits })}
          />
          <label className="pt-check">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Offer this plan
          </label>
          <div className="pt-plan-preview">
            <span>
              Monthly <strong>{look.monthly}</strong>
            </span>
            <span>
              Yearly <strong>{look.yearly}</strong>
            </span>
            <span>{look.label}</span>
            <span>Save {look.save} vs 12 months</span>
          </div>
          {error ? <p className="pt-alert pt-alert--error">{error}</p> : null}
          <div className="pt-btn-row" style={{ marginTop: 14 }}>
            <button type="submit" className="pt-btn pt-btn--primary" disabled={locked}>
              {editingId ? "Save changes" : "Add member type"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="pt-btn pt-btn--ghost"
                onClick={() => {
                  setEditingId(null);
                  setDraft(emptyDraft(settings));
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>

      {tiers.length === 0 ? (
        <p className="pt-empty">No member types yet. Add Gold, Patron, or whatever badge you want to sell.</p>
      ) : (
        <div className="pt-plan-list">
          {tiers.map((tier) => {
            const pricing = {
              monthlyPaise: tier.monthlyPaise,
              yearlyDiscountKind: tier.yearlyDiscountKind,
              yearlyDiscountValue: tier.yearlyDiscountValue,
            };
            return (
              <article className="pt-plan-card" key={tier.id}>
                <div className="pt-plan-card__head">
                  <span className="pt-plan-badge" style={{ background: `${tier.badgeColor}22`, color: tier.badgeColor }}>
                    {tier.badge}
                  </span>
                  {tier.active ? (
                    <span className="pt-badge pt-badge--success">offered</span>
                  ) : (
                    <span className="pt-badge pt-badge--neutral">hidden</span>
                  )}
                </div>
                <h3 className="pt-plan-card__title">{tier.name}</h3>
                {tier.description ? <p className="pt-plan-card__desc">{tier.description}</p> : null}
                <p className="pt-plan-card__price">
                  {formatInr(tier.monthlyPaise)} <small>/ month</small>
                </p>
                <p className="pt-plan-card__meta">
                  {formatInr(yearlyPaise(pricing))} / year · {discountLabel(tier.yearlyDiscountKind, tier.yearlyDiscountValue)}
                </p>
                <PlanBenefitStack benefits={parsePlanBenefits(tier.benefits)} />
                <div className="pt-plan-card__cta">
                  <div className="pt-btn-row">
                    <button type="button" className="pt-btn pt-btn--secondary pt-btn--sm" onClick={() => fillFrom(tier)}>
                      Edit
                    </button>
                    <button type="button" className="pt-btn pt-btn--ghost pt-btn--sm" onClick={() => setRemoveId(tier.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(removeId)}
        title="Remove this member type?"
        body="People who already hold this badge keep it until their term ends. New checkouts will not offer it."
        confirmLabel="Remove plan"
        tone="danger"
        busy={busy}
        onCancel={() => setRemoveId(null)}
        onConfirm={() => {
          if (removeId) void remove(removeId);
        }}
      />
    </div>
  );
}
