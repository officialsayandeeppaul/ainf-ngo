"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const EXIT_MS = 220;
let scrollLocks = 0;

function lockScroll() {
  scrollLocks += 1;
  if (scrollLocks === 1) document.documentElement.classList.add("pt-modal-open");
}

function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.documentElement.classList.remove("pt-modal-open");
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  busy = false,
  confirmDisabled = false,
  hideCancel = false,
  children,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger" | "secondary";
  busy?: boolean;
  confirmDisabled?: boolean;
  /** Acknowledge-only windows: a single button that closes. */
  hideCancel?: boolean;
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [present, setPresent] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      if (document.activeElement instanceof HTMLElement) {
        previousFocus.current = document.activeElement;
      }
      setPresent(true);
      setVisible(true);
      return;
    }

    setVisible(false);
    if (prefersReducedMotion()) {
      setPresent(false);
      return;
    }
    const hide = window.setTimeout(() => setPresent(false), EXIT_MS);
    return () => window.clearTimeout(hide);
  }, [open]);

  useEffect(() => {
    if (!present) return;
    lockScroll();
    return () => unlockScroll();
  }, [present]);

  // Parents pass a new onCancel on every render; reading it through a ref keeps
  // the effects below from re-running (and stealing focus) on each keystroke.
  const cancelRef = useRef({ busy, onCancel });
  useEffect(() => {
    cancelRef.current = { busy, onCancel };
  });

  // Focus once per opening: the first field when the window has one, else the confirm button.
  useEffect(() => {
    if (!visible) return;
    const field = panelRef.current?.querySelector<HTMLElement>(
      "textarea:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled])"
    );
    (field ?? confirmRef.current)?.focus({ preventScroll: true });
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !cancelRef.current.busy) cancelRef.current.onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible]);

  useEffect(() => {
    if (present) return;
    previousFocus.current?.focus({ preventScroll: true });
  }, [present]);

  if (!mounted || !present) return null;

  return createPortal(
    <div className={`pt-modal${visible ? " is-open" : ""}`} role="presentation">
      <button
        type="button"
        className="pt-modal__backdrop"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={busy ? undefined : onCancel}
      />
      <div ref={panelRef} className="pt-modal__panel" role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 className={`pt-modal__title${tone === "danger" ? " pt-modal__title--danger" : ""}`} id={titleId}>
          {title}
        </h2>
        {body ? <p className="pt-modal__body">{body}</p> : null}
        {children}
        <div className="pt-modal__actions">
          {hideCancel ? null : (
            <button type="button" className="pt-btn pt-btn--ghost" disabled={busy} onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            className={`pt-btn ${tone === "danger" ? "pt-btn--danger" : tone === "secondary" ? "pt-btn--secondary" : "pt-btn--primary"}`}
            disabled={busy || confirmDisabled}
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
