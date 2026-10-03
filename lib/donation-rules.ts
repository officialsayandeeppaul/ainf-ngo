/**
 * Pure rules for open gifts and the sevak identity gate.
 * No database. The order API, webhook, and tests all use these.
 */

export const GIFT_MIN_PAISE = 100;
export const DEFAULT_GIFT_MIN_PAISE = 20_000;
export const DEFAULT_GIFT_MAX_PAISE = 10_000_000;
export const DEFAULT_SUGGESTED_PAISE = [20_000, 50_000, 100_000, 250_000];

export type GiftKind = "GENERAL" | "MISSION" | "PROJECT";

export function resolvedFloor(globalMin: number, own: number | null | undefined): number {
  const global = Math.max(GIFT_MIN_PAISE, Math.round(globalMin));
  if (own == null || !Number.isFinite(own) || own <= 0) return global;
  return Math.max(global, Math.round(own));
}

export function amountAllowed(amountPaise: number, floor: number, cap: number): boolean {
  if (!Number.isInteger(amountPaise)) return false;
  if (amountPaise < GIFT_MIN_PAISE) return false;
  if (amountPaise < floor) return false;
  if (amountPaise > cap) return false;
  return floor <= cap;
}

export function visibleSuggestions(suggested: number[], floor: number, cap: number): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const value of suggested) {
    if (!Number.isInteger(value)) continue;
    if (value < floor || value > cap) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export type PaymentCheck =
  | { ok: true }
  | { ok: false; reason: "status" | "amount" | "currency" };

/** A captured Razorpay payment may mark a gift paid only when the money matches the row. */
export function paymentMatchesGift(input: {
  storedPaise: number;
  paidPaise: number;
  currency: string | null | undefined;
  status: string | null | undefined;
  captured?: boolean;
}): PaymentCheck {
  const captured = input.captured === true || input.status === "captured";
  if (!captured) return { ok: false, reason: "status" };
  if ((input.currency ?? "").toUpperCase() !== "INR") return { ok: false, reason: "currency" };
  if (!Number.isInteger(input.paidPaise) || input.paidPaise !== input.storedPaise) {
    return { ok: false, reason: "amount" };
  }
  return { ok: true };
}

export function notesRecord(notes: unknown): Record<string, string> {
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(notes as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export function isDonationNote(notes: unknown): boolean {
  return notesRecord(notes).purpose === "donation";
}

const ACCOUNT_RETURNS = new Set(["/account/membership", "/account/verify"]);

/** Sign-in may return only to the membership plan or the identity page. */
export function safeAccountReturn(raw: string | null | undefined): "/account/membership" | "/account/verify" | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) return null;
  const path = trimmed.split("?")[0]?.split("#")[0]?.replace(/\/$/, "") ?? "";
  if (ACCOUNT_RETURNS.has(path)) return path as "/account/membership" | "/account/verify";
  return null;
}

/** Portal sign-in keeps account and admin returns, and drops any other address. */
export function safeSignInReturn(raw: string | null | undefined): string {
  const joined = safeAccountReturn(raw);
  if (joined) return joined;
  if (!raw) return "/account";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\") || trimmed.includes("://")) {
    return "/account";
  }
  const path = (trimmed.split("?")[0]?.split("#")[0] ?? "").replace(/\/$/, "") || "/";
  if (path === "/account" || path.startsWith("/account/") || path === "/admin" || path.startsWith("/admin/")) {
    return path;
  }
  return "/account";
}

export function identityReadyForMembership(
  user: { kycStatus: string; panVerified: boolean },
  policy: { didit: boolean; pan: boolean; otp: boolean }
): boolean {
  const anyMethod = policy.didit || policy.pan || policy.otp;
  if (!anyMethod) return true;
  if ((policy.didit || policy.otp) && user.kycStatus !== "APPROVED") return false;
  if (policy.pan && !user.panVerified) return false;
  return true;
}

export function joinDestination(identityReady: boolean): "/account/membership" | "/account/verify" {
  return identityReady ? "/account/membership" : "/account/verify";
}
