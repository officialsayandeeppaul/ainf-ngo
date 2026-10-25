import { db } from "./db";
import { isPaymentsEnvPaused } from "./env";

/**
 * The admin switch for taking money online.
 *
 * While paused, self-serve checkout (gifts and membership plans) records the
 * visitor's interest instead of opening Razorpay. Payment links an admin sends,
 * confirmations of checkouts already open, webhooks, and existing auto-renew
 * mandates all keep working: the switch stops new checkouts, not settlement.
 */

export const DEFAULT_PAUSED_TITLE = "Thank you for your interest";

export const DEFAULT_PAUSED_MESSAGE =
  "We are not taking online payments right now, but we have saved your interest. " +
  "As soon as payments reopen, the AINF team will contact you with a secure payment link.";

export type PaymentSettingsRow = {
  enabled: boolean;
  pausedMessage: string;
  pausedAt: Date | null;
  updatedAt: Date | null;
  updatedByUserId: string | null;
};

export type PaymentSettingsView = {
  /** The admin switch as stored. */
  enabled: boolean;
  /** PAYMENTS_PAUSED is set, which overrides the switch. */
  envPaused: boolean;
  /** Whether self-serve checkout opens right now. */
  open: boolean;
  pausedMessage: string;
  pausedAt: string | null;
  updatedAt: string | null;
};

const DEFAULTS: PaymentSettingsRow = {
  enabled: true,
  pausedMessage: "",
  pausedAt: null,
  updatedAt: null,
  updatedByUserId: null,
};

let warnedMissingTable = false;

/**
 * Reads the singleton. A missing row or table means "open": the switch must
 * never take payments down because a migration has not landed yet.
 */
export async function getPaymentSettings(): Promise<PaymentSettingsRow> {
  try {
    const row = await db.paymentSettings.findUnique({ where: { id: "singleton" } });
    return row ?? DEFAULTS;
  } catch (error) {
    if (!warnedMissingTable) {
      warnedMissingTable = true;
      console.warn("[payments] settings unreadable, treating payments as open", error);
    }
    return DEFAULTS;
  }
}

export function paymentsOpenFor(row: Pick<PaymentSettingsRow, "enabled">, envPaused = isPaymentsEnvPaused): boolean {
  return row.enabled && !envPaused;
}

export async function paymentsOpen(): Promise<boolean> {
  return paymentsOpenFor(await getPaymentSettings());
}

export function pausedMessageFor(row: Pick<PaymentSettingsRow, "pausedMessage">): string {
  return row.pausedMessage.trim() || DEFAULT_PAUSED_MESSAGE;
}

export function toPaymentSettingsView(row: PaymentSettingsRow, envPaused = isPaymentsEnvPaused): PaymentSettingsView {
  return {
    enabled: row.enabled,
    envPaused,
    open: paymentsOpenFor(row, envPaused),
    pausedMessage: row.pausedMessage,
    pausedAt: row.pausedAt ? row.pausedAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}
