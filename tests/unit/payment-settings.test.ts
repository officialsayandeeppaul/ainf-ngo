import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: { paymentSettings: { findUnique: h.findUnique } },
}));

import {
  DEFAULT_PAUSED_MESSAGE,
  getPaymentSettings,
  pausedMessageFor,
  paymentsOpenFor,
  toPaymentSettingsView,
} from "@/lib/payment-settings";

beforeEach(() => {
  h.findUnique.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("payment switch", () => {
  it("is open only when the admin switch is on and the env kill switch is off", () => {
    expect(paymentsOpenFor({ enabled: true }, false)).toBe(true);
    expect(paymentsOpenFor({ enabled: false }, false)).toBe(false);
    expect(paymentsOpenFor({ enabled: true }, true)).toBe(false);
  });

  it("uses the standard wording unless the admin wrote their own", () => {
    expect(pausedMessageFor({ pausedMessage: "" })).toBe(DEFAULT_PAUSED_MESSAGE);
    expect(pausedMessageFor({ pausedMessage: "   " })).toBe(DEFAULT_PAUSED_MESSAGE);
    expect(pausedMessageFor({ pausedMessage: "Back on Monday." })).toBe("Back on Monday.");
  });

  it("treats a missing row as open", async () => {
    h.findUnique.mockResolvedValueOnce(null);
    const row = await getPaymentSettings();
    expect(row.enabled).toBe(true);
  });

  it("treats an unreadable table as open, so a late migration never stops payments", async () => {
    h.findUnique.mockRejectedValueOnce(new Error('relation "PaymentSettings" does not exist'));
    const row = await getPaymentSettings();
    expect(paymentsOpenFor(row, false)).toBe(true);
  });

  it("reports the env override in the admin view", () => {
    const view = toPaymentSettingsView(
      { enabled: true, pausedMessage: "", pausedAt: null, updatedAt: null, updatedByUserId: null },
      true
    );
    expect(view).toMatchObject({ enabled: true, envPaused: true, open: false });
  });
});
