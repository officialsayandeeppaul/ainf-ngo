"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { shortId } from "@/lib/audit-display";
import { formatInr } from "@/lib/membership";
import { CopyId } from "./CopyId";

type PaymentDetail = {
  id: string;
  status: string;
  amountPaise: number;
  currency: string;
  method: string | null;
  email: string | null;
  contact: string | null;
  orderId: string | null;
  captured: boolean;
  refundedPaise: number;
  errorCode: string | null;
  errorDescription: string | null;
  createdAt: string | null;
  dashboardUrl: string;
};

async function writeClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

function statusLabel(detail: PaymentDetail) {
  const raw = (detail.status || "").toLowerCase();
  if (raw === "captured" || (detail.captured && (raw === "authorized" || raw === ""))) {
    return "Captured";
  }
  if (!raw) return detail.captured ? "Captured" : "Unknown";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Compact payment cell + right-side drawer for Razorpay detail. */
export function PaymentRef({
  paymentId,
  orderId,
}: {
  paymentId: string | null | undefined;
  orderId?: string | null;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => setVisible(true));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.documentElement.classList.add("pt-modal-open");
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("pt-modal-open");
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const load = useCallback(async () => {
    if (!paymentId) return;
    setBusy(true);
    setError(null);
    setDetail(null);
    setOpen(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch(`/api/admin/razorpay/payments/${encodeURIComponent(paymentId)}`, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        payment?: PaymentDetail;
        message?: string;
      };
      if (!response.ok || !payload.payment) {
        setError(payload.message ?? "Could not load Razorpay payment.");
        return;
      }
      setDetail(payload.payment);
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      setError(aborted ? "Razorpay is taking too long. Try again." : "Could not reach Razorpay. Try again.");
    } finally {
      window.clearTimeout(timer);
      setBusy(false);
    }
  }, [paymentId]);

  const copyPaymentId = useCallback(async () => {
    if (!paymentId) return;
    const ok = await writeClipboard(paymentId);
    setCopiedAll(ok);
    window.setTimeout(() => setCopiedAll(false), 1600);
  }, [paymentId]);

  if (!paymentId) {
    return <span className="pt-dossier-meta">—</span>;
  }

  const resolvedOrder = orderId || detail?.orderId || null;
  const dashUrl =
    detail?.dashboardUrl ?? `https://dashboard.razorpay.com/app/payments/${encodeURIComponent(paymentId)}`;

  const drawer =
    mounted && open
      ? createPortal(
          <div className={`pt-sheet${visible ? " is-open" : ""}`} role="presentation">
            <button
              type="button"
              className="pt-sheet__backdrop"
              aria-label="Close payment details"
              tabIndex={-1}
              onClick={close}
            />
            <aside
              className="pt-sheet__panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              <header className="pt-sheet__head">
                <div>
                  <p className="pt-eyebrow" style={{ margin: 0 }}>
                    Razorpay
                  </p>
                  <h2 className="pt-sheet__title" id={titleId}>
                    Payment detail
                  </h2>
                </div>
                <button type="button" className="pt-btn pt-btn--ghost pt-btn--sm pt-btn--pop" onClick={close}>
                  Close
                </button>
              </header>

              <div className="pt-sheet__body">
                <div className="pt-sheet__ids">
                  <div>
                    <span className="pt-dossier-meta">Payment id</span>
                    <CopyId value={paymentId} label="Copy payment id" display={paymentId} />
                  </div>
                  {resolvedOrder ? (
                    <div>
                      <span className="pt-dossier-meta">Order id</span>
                      <CopyId value={resolvedOrder} label="Copy order id" display={resolvedOrder} />
                    </div>
                  ) : null}
                </div>

                {busy && !detail ? (
                  <div className="pt-sheet__skel" aria-busy="true" aria-live="polite">
                    <span className="visually-hidden">Loading payment detail</span>
                    <div className="pt-sheet__skel-row">
                      <span className="pt-skel" style={{ width: 72, height: 12, borderRadius: 6 }} />
                      <span className="pt-skel" style={{ width: 96, height: 24, borderRadius: 999 }} />
                    </div>
                    <div className="pt-sheet__skel-row">
                      <span className="pt-skel" style={{ width: 64, height: 12, borderRadius: 6 }} />
                      <span className="pt-skel" style={{ width: 72, height: 22, borderRadius: 8 }} />
                    </div>
                    <div className="pt-sheet__skel-row">
                      <span className="pt-skel" style={{ width: 58, height: 12, borderRadius: 6 }} />
                      <span className="pt-skel" style={{ width: "55%", height: 14, borderRadius: 6 }} />
                    </div>
                    <div className="pt-sheet__skel-row">
                      <span className="pt-skel" style={{ width: 48, height: 12, borderRadius: 6 }} />
                      <span className="pt-skel" style={{ width: "70%", height: 14, borderRadius: 6 }} />
                    </div>
                    <div className="pt-sheet__skel-row">
                      <span className="pt-skel" style={{ width: 68, height: 12, borderRadius: 6 }} />
                      <span className="pt-skel" style={{ width: "40%", height: 14, borderRadius: 6 }} />
                    </div>
                  </div>
                ) : null}

                {error ? (
                  <div className="pt-sheet__error">
                    <p className="pt-pay-ref__error">{error}</p>
                    <button
                      type="button"
                      className="pt-btn pt-btn--secondary pt-btn--sm pt-btn--pop"
                      onClick={() => void load()}
                      disabled={busy}
                    >
                      Retry
                    </button>
                  </div>
                ) : null}

                {detail ? (
                  <dl className="pt-kv pt-sheet__kv">
                    <dt>Status</dt>
                    <dd>
                      <span
                        className={`pt-badge pt-badge--lift ${
                          statusLabel(detail) === "Captured"
                            ? "pt-badge--success"
                            : statusLabel(detail).toLowerCase().includes("fail")
                              ? "pt-badge--danger"
                              : "pt-badge--neutral"
                        }`}
                      >
                        {statusLabel(detail)}
                      </span>
                    </dd>
                    <dt>Amount</dt>
                    <dd>
                      <span className="pt-money">{formatInr(detail.amountPaise)}</span>
                      {detail.currency && detail.currency !== "INR" ? ` · ${detail.currency}` : ""}
                    </dd>
                    <dt>Method</dt>
                    <dd className="pt-sheet__method">{detail.method || "—"}</dd>
                    <dt>Payer</dt>
                    <dd>
                      <div className="pt-dossier-plan">{detail.email || "—"}</div>
                      {detail.contact ? <div className="pt-dossier-meta">{detail.contact}</div> : null}
                    </dd>
                    {detail.refundedPaise > 0 ? (
                      <>
                        <dt>Refunded</dt>
                        <dd>{formatInr(detail.refundedPaise)}</dd>
                      </>
                    ) : null}
                    {detail.errorCode || detail.errorDescription ? (
                      <>
                        <dt>Error</dt>
                        <dd>
                          {detail.errorCode ? (
                            <span className="pt-pill pt-pill--muted">{detail.errorCode}</span>
                          ) : null}{" "}
                          {detail.errorDescription || ""}
                        </dd>
                      </>
                    ) : null}
                    {detail.createdAt ? (
                      <>
                        <dt>Captured</dt>
                        <dd>{detail.createdAt}</dd>
                      </>
                    ) : null}
                  </dl>
                ) : null}
              </div>

              <footer className="pt-sheet__foot">
                <button
                  type="button"
                  className="pt-btn pt-btn--secondary pt-btn--pop"
                  onClick={() => void copyPaymentId()}
                >
                  {copiedAll ? "Copied id" : "Copy payment id"}
                </button>
                <a
                  className="pt-btn pt-btn--primary pt-btn--pop"
                  href={dashUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Razorpay
                </a>
              </footer>
            </aside>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="pt-pay-ref">
        <code className="pt-pay-ref__id" title={paymentId}>
          {shortId(paymentId)}
        </code>
        <div className="pt-pay-ref__row">
          <button type="button" className="pt-pay-ref__link" onClick={() => void copyPaymentId()}>
            {copiedAll ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            className="pt-btn pt-btn--secondary pt-btn--sm pt-btn--pop"
            onClick={() => void load()}
            disabled={busy}
          >
            {busy ? "…" : "Details"}
          </button>
        </div>
      </div>
      {drawer}
    </>
  );
}
