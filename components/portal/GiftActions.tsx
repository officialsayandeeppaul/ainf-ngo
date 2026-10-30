"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/portal/ConfirmDialog";

/** Return and receipt actions for one received gift in the admin ledger. */
export function GiftActions({
  id,
  who,
  amount,
  target,
  email,
}: {
  id: string;
  who: string;
  amount: string;
  target: string;
  email: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<null | "return" | "receipt">(null);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function post(path: string) {
    const response = await fetch(path, { method: "POST" });
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    return { ok: response.ok, message: body.message };
  }

  async function giveBack() {
    setBusy("return");
    setMessage(null);
    const result = await post(`/api/admin/donations/${id}/refund`);
    setBusy(null);
    setConfirm(false);
    if (!result.ok) {
      setMessage({ text: result.message ?? "Could not return this donation.", error: true });
      return;
    }
    startTransition(() => router.refresh());
  }

  async function emailReceipt() {
    setBusy("receipt");
    setMessage(null);
    const result = await post(`/api/admin/donations/${id}/receipt`);
    setBusy(null);
    setMessage(
      result.ok
        ? { text: `Receipt sent to ${email}.`, error: false }
        : { text: result.message ?? "The receipt could not be sent.", error: true }
    );
    if (result.ok) startTransition(() => router.refresh());
  }

  const disabled = busy !== null || pending;

  return (
    <div className="pt-pay-actions">
      <button type="button" className="pt-btn pt-btn--ghost pt-btn--sm" disabled={disabled} onClick={() => void emailReceipt()}>
        {busy === "receipt" ? "Sending…" : "Email receipt"}
      </button>
      <button type="button" className="pt-btn pt-btn--secondary pt-btn--sm" disabled={disabled} onClick={() => setConfirm(true)}>
        Return
      </button>
      {message ? (
        <span className={`pt-gift-action-note${message.error ? " is-error" : ""}`} role="status">
          {message.text}
        </span>
      ) : null}
      <ConfirmDialog
        open={confirm}
        title="Return this donation in full?"
        body={`${amount} for ${target} goes back to ${who} through Razorpay, and they are emailed. This cannot be undone.`}
        confirmLabel="Yes, return it"
        tone="danger"
        busy={busy === "return"}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void giveBack()}
      />
    </div>
  );
}
