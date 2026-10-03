"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { discountLabel, formatInr, yearlyPaise, type YearlyDiscountKind } from "@/lib/membership";
import { ConfirmDialog } from "@/components/portal/ConfirmDialog";
import { PlanBenefitStack } from "@/components/portal/PlanBenefits";
import { parsePlanBenefits, type PlanBenefit } from "@/lib/plan-benefits";

type Plan = {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  benefits?: PlanBenefit[] | unknown;
  monthlyPaise: number;
  yearlyDiscountKind: YearlyDiscountKind;
  yearlyDiscountValue: number;
};

type PaymentRow = {
  id: string;
  when: string;
  tierName: string;
  interval: string;
  amount: string;
  status: string;
  recurring: boolean;
  changeKind?: string;
};

type Quote = {
  kind: "new" | "same" | "upgrade" | "downgrade" | "interval";
  listPaise: number;
  listLabel: string;
  offerName: string | null;
  offerOffPaise: number;
  offerOffLabel: string | null;
  payablePaise: number;
  creditPaise: number;
  creditLabel: string;
  leftoverPaise: number;
  duePaise: number;
  dueLabel: string;
  expiresAt: string;
  expiresLabel: string;
  cta: string;
};

type RazorpaySuccess = {
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Could not load Razorpay Checkout.")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout."));
    document.body.appendChild(script);
  });
}

function changeLabel(kind?: string) {
  if (kind === "UPGRADE") return "upgrade";
  if (kind === "DOWNGRADE") return "downgrade";
  if (kind === "INTERVAL_CHANGE") return "cycle change";
  if (kind === "RENEWAL") return "renewal";
  return null;
}

export function MembershipPay({
  plans,
  razorpayOn,
  current,
  payments,
}: {
  plans: Plan[];
  razorpayOn: boolean;
  current: {
    tierId: string;
    badge: string;
    badgeColor: string;
    name: string;
    interval: string;
    expiresAt: string;
    cancelAtPeriodEnd: boolean;
    recurring: boolean;
  } | null;
  payments: PaymentRow[];
}) {
  const router = useRouter();
  const [interval, setInterval] = useState<"MONTHLY" | "YEARLY">(
    current?.interval === "YEARLY" ? "YEARLY" : "MONTHLY"
  );
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    null | { type: "end" } | { type: "stop" } | { type: "switch"; plan: Plan; quote: Quote }
  >(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetch("/api/membership/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const payload = await result.json().catch(() => ({}));
      if (!cancelled && result.ok) setQuotes(payload.quotes ?? {});
    })().catch(() => {
      if (!cancelled) setQuotes({});
    });
    return () => {
      cancelled = true;
    };
  }, [interval]);

  async function pay(plan: Plan) {
    const quote = quotes[plan.id];
    if (!razorpayOn || quote?.kind === "same") return;
    if (quote && quote.kind !== "new") {
      setDialog({ type: "switch", plan, quote });
      return;
    }
    await runPay(plan);
  }

  async function runPay(plan: Plan) {
    setBusyId(plan.id);
    setError(null);
    try {
      const started = await fetch("/api/membership/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tierId: plan.id, interval }),
      });
      const order = await started.json();
      if (!started.ok) throw new Error(order.message ?? "Could not start payment.");
      if (order.applied) {
        router.refresh();
        return;
      }

      await loadCheckout();
      if (!window.Razorpay) throw new Error("Razorpay Checkout did not load.");

      await new Promise<void>((resolve, reject) => {
        const checkout = new window.Razorpay!({
          key: order.keyId,
          amount: order.amountPaise,
          currency: order.currency,
          name: order.name,
          description: order.description,
          ...(order.razorpaySubscriptionId
            ? { subscription_id: order.razorpaySubscriptionId }
            : { order_id: order.razorpayOrderId }),
          prefill: order.prefill,
          theme: { color: "#39a46b" },
          handler: async (response: RazorpaySuccess) => {
            try {
              const confirm = await fetch("/api/membership/confirm", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(response),
              });
              const payload = await confirm.json().catch(() => ({}));
              if (!confirm.ok) throw new Error(payload.message ?? "Could not confirm payment.");
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => reject(new Error("Payment was closed before it finished.")),
          },
        });
        checkout.open();
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment did not complete.");
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(immediate: boolean) {
    setBusyId("cancel");
    setError(null);
    const result = await fetch("/api/membership/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ immediate }),
    });
    const payload = await result.json().catch(() => ({}));
    if (!result.ok) {
      setBusyId(null);
      setError(payload.message ?? "Could not cancel.");
      return;
    }
    setDialog(null);
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="pt-verify-stack">
      {current ? (
        <section className="pt-card">
          <h2 className="pt-section-title">Your membership</h2>
          <div className="pt-membership-now">
            <div className="pt-membership-now__copy">
              <p style={{ margin: "0 0 8px" }}>
                <span className="pt-plan-badge" style={{ background: `${current.badgeColor}22`, color: current.badgeColor }}>
                  {current.badge}
                </span>
              </p>
              <p className="pt-hint" style={{ marginTop: 0 }}>
                {current.name} · {current.interval === "YEARLY" ? "yearly" : "monthly"} · until {current.expiresAt}
                {current.recurring && !current.cancelAtPeriodEnd ? " · auto-renews" : ""}
                {current.cancelAtPeriodEnd ? " · auto-renew stopped; badge stays until this date" : ""}
              </p>
              <p className="pt-hint">
                Switch any time. Unused days become credit, the new plan starts today, and the next
                renewal date moves to today&apos;s date next month or year.
              </p>
            </div>
            <div className="pt-btn-row">
              {current.recurring && !current.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  className="pt-btn pt-btn--secondary"
                  disabled={busyId !== null}
                  onClick={() => setDialog({ type: "stop" })}
                >
                  Stop auto-renew
                </button>
              ) : null}
              <button
                type="button"
                className="pt-btn pt-btn--ghost"
                disabled={busyId !== null}
                onClick={() => setDialog({ type: "end" })}
              >
                End now (remove badge)
              </button>
            </div>
          </div>
        </section>
      ) : (
        <div className="pt-alert pt-alert--info">
          <p className="pt-alert__title">No active badge</p>
          <p>Pay monthly or yearly. You can upgrade or downgrade later; unused time is credited.</p>
        </div>
      )}

      {!razorpayOn ? (
        <div className="pt-alert pt-alert--warning">
          <p className="pt-alert__title">Payments are not live yet</p>
          <p>Razorpay keys are missing on this instance.</p>
        </div>
      ) : null}

      <div className="pt-segment" role="radiogroup" aria-label="Billing interval">
        <button
          type="button"
          className={`pt-segment__btn${interval === "MONTHLY" ? " is-on" : ""}`}
          aria-pressed={interval === "MONTHLY"}
          onClick={() => setInterval("MONTHLY")}
        >
          Monthly
        </button>
        <button
          type="button"
          className={`pt-segment__btn${interval === "YEARLY" ? " is-on" : ""}`}
          aria-pressed={interval === "YEARLY"}
          onClick={() => setInterval("YEARLY")}
        >
          Yearly (discount applied)
        </button>
      </div>

      {error ? <p className="pt-alert pt-alert--error">{error}</p> : null}

      {plans.length === 0 ? (
        <p className="pt-empty">No member types are offered yet.</p>
      ) : (
        <div className="pt-plan-list">
          {plans.map((plan) => {
            const pricing = {
              monthlyPaise: plan.monthlyPaise,
              yearlyDiscountKind: plan.yearlyDiscountKind,
              yearlyDiscountValue: plan.yearlyDiscountValue,
            };
            const amount = interval === "YEARLY" ? yearlyPaise(pricing) : plan.monthlyPaise;
            const quote = quotes[plan.id];
            const currentCard = quote?.kind === "same" || (current?.tierId === plan.id && current.interval === interval);
            return (
              <article className={`pt-plan-card${currentCard ? " pt-plan-card--current" : ""}`} key={plan.id}>
                <div className="pt-plan-card__head">
                  <span className="pt-plan-badge" style={{ background: `${plan.badgeColor}22`, color: plan.badgeColor }}>
                    {plan.badge}
                  </span>
                  <span className="pt-badge pt-badge--success" style={{ visibility: currentCard ? "visible" : "hidden" }}>
                    current
                  </span>
                </div>
                <h3 className="pt-plan-card__title">{plan.name}</h3>
                <p className="pt-plan-card__desc">{plan.description || "\u00a0"}</p>
                <p className="pt-plan-card__price">
                  {quote?.offerOffPaise ? (
                    <>
                      <span className="pt-plan-card__was">{formatInr(amount)}</span> {formatInr(quote.payablePaise)}
                    </>
                  ) : (
                    formatInr(amount)
                  )}{" "}
                  <small>/ {interval === "YEARLY" ? "year" : "month"}</small>
                </p>
                {quote?.offerName ? (
                  <p className="pt-plan-card__meta">
                    {quote.offerName}
                    {quote.offerOffLabel ? ` · ${quote.offerOffLabel} off` : ""}
                  </p>
                ) : interval === "YEARLY" ? (
                  <p className="pt-plan-card__meta">
                    {discountLabel(plan.yearlyDiscountKind, plan.yearlyDiscountValue)}
                  </p>
                ) : (
                  <p className="pt-plan-card__meta">Billed every month</p>
                )}
                {quote && quote.kind !== "same" && quote.kind !== "new" ? (
                  <p className="pt-plan-card__meta">
                    Pay {quote.dueLabel} today
                    {quote.creditPaise > 0 ? ` after ${quote.creditLabel} unused credit` : ""}. New term until{" "}
                    {quote.expiresLabel}.
                  </p>
                ) : null}
                <PlanBenefitStack benefits={parsePlanBenefits(plan.benefits)} />
                <div className="pt-plan-card__cta">
                  <button
                    type="button"
                    className={`pt-btn pt-btn--block ${currentCard ? "pt-btn--secondary" : "pt-btn--primary"}`}
                    disabled={!razorpayOn || busyId !== null || currentCard}
                    onClick={() => pay(plan)}
                  >
                    {currentCard
                      ? "Current plan"
                      : busyId === plan.id
                        ? "Working…"
                        : (quote?.cta ?? "Pay with Razorpay")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="pt-card pt-card--flush">
        <div className="pt-card__head">
          <h2 className="pt-section-title" style={{ margin: 0 }}>
            Your payments
          </h2>
        </div>
        {payments.length === 0 ? (
          <p className="pt-empty">No payments yet.</p>
        ) : (
          <div className="pt-activity">
            {payments.map((row) => (
              <div className="pt-activity__row" key={row.id}>
                <span className="pt-activity__action">
                  {row.tierName} · {row.interval === "YEARLY" ? "yearly" : "monthly"} · {row.amount}
                  {changeLabel(row.changeKind) ? ` · ${changeLabel(row.changeKind)}` : ""}
                  {row.recurring ? " · recurring" : ""}
                </span>
                <span className="pt-activity__time">{row.when}</span>
                <span
                  className={`pt-badge ${
                    row.status === "PAID"
                      ? "pt-badge--success"
                      : row.status === "CANCELLED"
                        ? "pt-badge--warning"
                        : row.status === "FAILED"
                          ? "pt-badge--danger"
                          : "pt-badge--neutral"
                  }`}
                >
                  {row.status.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={dialog !== null}
        title={
          dialog?.type === "stop"
            ? "Stop automatic renewal?"
            : dialog?.type === "switch"
              ? dialog.quote.cta
              : "End membership now?"
        }
        body={
          dialog?.type === "stop"
            ? "The badge stays until the current end date. No further charges are taken after that."
            : dialog?.type === "switch"
              ? `Unused credit ${dialog.quote.creditLabel} is applied. The new term starts today and runs until ${dialog.quote.expiresLabel}.`
              : "The badge is removed immediately. Unused days are not refunded. You can join a plan again afterwards."
        }
        confirmLabel={
          dialog?.type === "stop" ? "Stop auto-renew" : dialog?.type === "switch" ? "Continue to pay" : "End membership"
        }
        tone={dialog?.type === "end" ? "danger" : dialog?.type === "stop" ? "secondary" : "primary"}
        busy={busyId === "cancel" || (busyId !== null && dialog?.type === "switch")}
        onCancel={() => {
          if (busyId !== "cancel") setDialog(null);
        }}
        onConfirm={() => {
          if (dialog?.type === "stop") void cancel(false);
          else if (dialog?.type === "switch") {
            const plan = dialog.plan;
            setDialog(null);
            void runPay(plan);
          } else void cancel(true);
        }}
      />
    </div>
  );
}
