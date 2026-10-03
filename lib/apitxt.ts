import type { User } from "@prisma/client";
import { env, isApitxtConfigured, isTextOtpConfigured, requireApitxtEnv } from "./env";

/**
 * APITXT: PAN verification and transactional SMS.
 *
 * PAN verification spends a non-refundable credit per successful lookup, so
 * error codes are mapped to typed failures rather than being swallowed — a
 * caller must be able to tell "wrong PAN" (user's fault, don't retry) from
 * "insufficient balance" (our fault, retry after top-up) from "vendor down"
 * (transient, safe to retry).
 */

export type PanFailureKind =
  | "insufficient_balance"
  | "invalid_credentials"
  | "vendor_failure"
  | "invalid_pan"
  | "not_found"
  | "rate_limited"
  | "transport"
  | "unknown";

export class ApitxtError extends Error {
  readonly kind: PanFailureKind;
  readonly code: string | null;
  /** True when the credit was not consumed and a retry is worthwhile. */
  readonly retryable: boolean;

  constructor(params: {
    message: string;
    kind: PanFailureKind;
    code?: string | null;
    retryable?: boolean;
  }) {
    super(params.message);
    this.name = "ApitxtError";
    this.kind = params.kind;
    this.code = params.code ?? null;
    this.retryable = params.retryable ?? false;
  }
}

/** Documented APITXT status codes, mapped to actionable outcomes. */
const CODE_MAP: Record<string, { kind: PanFailureKind; message: string; retryable: boolean }> = {
  "301": {
    kind: "insufficient_balance",
    message: "PAN verification is temporarily unavailable. Please try again later.",
    retryable: true,
  },
  "302": {
    kind: "invalid_pan",
    message: "That PAN number could not be found. Check each character and try again.",
    retryable: false,
  },
  "304": {
    kind: "invalid_credentials",
    message: "PAN verification is misconfigured. Please contact support.",
    retryable: false,
  },
  "310": {
    kind: "vendor_failure",
    message: "The verification provider is not responding. Please try again in a few minutes.",
    retryable: true,
  },
};

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function normalisePan(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidPanFormat(value: string): boolean {
  return PAN_REGEX.test(normalisePan(value));
}

/** APITXT's panVerify endpoint wants DD/MM/YYYY. Internally we store dashes. */
export function normaliseDob(value: string): string {
  const digits = value.trim().replace(/\D/g, "").slice(0, 8);
  if (digits.length !== 8) {
    return value.trim().replace(/[./]/g, "-").replace(/\s+/g, "");
  }
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

export function dobForApitxt(value: string): string {
  return normaliseDob(value).replace(/-/g, "/");
}

export function isValidDob(value: string): boolean {
  const normalised = normaliseDob(value);
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(normalised);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export type PanVerifyResult = {
  matched: boolean;
  nameMatch: boolean | null;
  dobMatch: boolean | null;
  panStatusText: string | null;
  category: string | null;
  aadhaarSeedingStatus: string | null;
  requestId: string | null;
  /** Raw response minus anything that could contain the PAN itself. */
  raw: Record<string, unknown>;
};

function truthy(value: unknown): boolean | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value;
  const text = String(value).trim().toLowerCase();
  if (["y", "yes", "true", "1", "match", "matched"].includes(text)) return true;
  if (["n", "no", "false", "0", "mismatch", "not matched"].includes(text)) return false;
  return null;
}

/**
 * Verifies a PAN against name and date of birth.
 * The PAN is sent to APITXT but never returned in the result or logged.
 */
export async function panVerify(params: {
  pan: string;
  name: string;
  dob: string; // normalised then sent to APITXT as DD/MM/YYYY
}): Promise<PanVerifyResult> {
  const { APITXT_AUTH_KEY } = requireApitxtEnv();
  const pan = normalisePan(params.pan);

  if (!isValidPanFormat(pan)) {
    throw new ApitxtError({
      message: "PAN must be five letters, four digits, then one letter (for example ABCDE1234F).",
      kind: "invalid_pan",
    });
  }

  let response: Response;
  try {
    response = await fetch(`${env.APITXT_BASE_URL}/api/panVerify`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        authkey: APITXT_AUTH_KEY,
        pan,
        name: params.name.trim(),
        dob: dobForApitxt(params.dob),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new ApitxtError({
      message: "Could not reach the PAN verification service. Please try again.",
      kind: "transport",
      retryable: true,
    });
  }

  const text = await response.text();
  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ApitxtError({
      message: "The PAN verification service returned an unreadable response.",
      kind: "vendor_failure",
      retryable: true,
    });
  }

  const code = String(payload?.status ?? payload?.code ?? response.status);
  const mapped = CODE_MAP[code];
  if (mapped) {
    throw new ApitxtError({ ...mapped, code });
  }

  const success =
    response.ok &&
    (code === "200" ||
      code === "0" ||
      payload?.success === true ||
      String(payload?.status ?? "").toLowerCase() === "success");

  if (!success) {
    throw new ApitxtError({
      message:
        typeof payload?.message === "string"
          ? payload.message
          : "PAN verification failed. Please check the details and try again.",
      kind: "unknown",
      code,
    });
  }

  const data = payload?.data ?? payload?.result ?? payload;
  const nameMatch = truthy(data?.name_match ?? data?.nameMatch ?? data?.full_name_match);
  const dobMatch = truthy(data?.dob_match ?? data?.dobMatch);

  // Strip anything PAN-shaped before the payload is persisted or logged.
  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (typeof value === "string" && PAN_REGEX.test(value.toUpperCase())) continue;
    if (/^pan(_?number)?$/i.test(key)) continue;
    raw[key] = value;
  }

  return {
    matched: nameMatch !== false && dobMatch !== false,
    nameMatch,
    dobMatch,
    panStatusText: data?.pan_status ?? data?.status_text ?? null,
    category: data?.category ?? null,
    aadhaarSeedingStatus:
      data?.aadhaar_seeding_status ?? data?.aadhaarSeedingStatus ?? data?.seeding_status ?? null,
    requestId: payload?.request_id ?? payload?.requestId ?? null,
    raw,
  };
}

// ---------------------------------------------------------------------------
// Transactional SMS
// ---------------------------------------------------------------------------

export type SmsResult = { sent: boolean; error?: string };

/**
 * Sends a transactional SMS. Returns rather than throws: SMS is a courtesy
 * channel and must never fail the operation that triggered it.
 */
export function buildSmsParams(params: { to: string; message: string }): URLSearchParams | { error: string } {
  if (!isApitxtConfigured) return { error: "not_configured" };
  if (!env.APITXT_SENDER_ID) return { error: "no_sender_id" };
  const mobile = params.to.replace(/[^\d]/g, "").replace(/^0+/, "");
  if (mobile.length < 10) return { error: "invalid_number" };

  const body = new URLSearchParams({
    authkey: env.APITXT_AUTH_KEY!,
    mobiles: mobile,
    message: params.message,
    sender: env.APITXT_SENDER_ID,
    route: env.APITXT_ROUTE,
    country: "91",
  });

  // DLT is opt-in. Verification and OTP work without template / PE ids.
  const requireDlt = env.APITXT_REQUIRE_DLT === "true" || env.APITXT_REQUIRE_DLT === "1";
  if (requireDlt) {
    if (env.APITXT_DLT_TEMPLATE_ID) body.set("DLT_TE_ID", env.APITXT_DLT_TEMPLATE_ID);
    if (env.APITXT_PE_ID) body.set("PE_ID", env.APITXT_PE_ID);
  }
  return body;
}

export async function sendSms(params: { to: string; message: string }): Promise<SmsResult> {
  const built = buildSmsParams(params);
  if ("error" in built) {
    if (built.error === "not_configured") console.warn("[apitxt] SMS skipped — APITXT_AUTH_KEY not set");
    if (built.error === "no_sender_id") console.warn("[apitxt] SMS skipped — APITXT_SENDER_ID not set");
    return { sent: false, error: built.error };
  }

  try {
    const response = await fetch(`${env.APITXT_BASE_URL}/api/sendhttp.php`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: built,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.text()).slice(0, 300);
    if (!response.ok) return { sent: false, error: `http_${response.status}: ${body}` };
    if (/error|invalid|insufficient/i.test(body)) return { sent: false, error: body };
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[apitxt] SMS send failed", error);
    return { sent: false, error: message };
  }
}

export function sendKycOutcomeSms(
  user: Pick<User, "phone" | "firstName">,
  outcome: "approved" | "declined"
): Promise<SmsResult> {
  if (!user.phone) return Promise.resolve({ sent: false, error: "no_phone" });
  const message =
    outcome === "approved"
      ? "AINF: Your identity verification is approved. Your account is now a verified member account."
      : "AINF: We could not verify your identity. You can start a new attempt from your dashboard.";
  return sendSms({ to: user.phone, message });
}

export function buildTextOtpParams(params: { mobile: string; otp: string }): URLSearchParams | { error: string } {
  if (!isTextOtpConfigured) return { error: "not_configured" };
  const digits = params.mobile.replace(/\D/g, "").replace(/^0+/, "");
  const mobile = digits.length === 10 ? `91${digits}` : digits;
  if (mobile.length < 12 || !params.otp.trim()) return { error: "invalid_number" };
  return new URLSearchParams({
    authkey: env.APITXT_OTP_AUTH_KEY!,
    mobile,
    otp: params.otp.trim(),
    channel: "sms",
    country: "91",
  });
}

/** Text OTP through /api/sendOTP. No DLT template, sender, or PE id. */
export async function sendTextOtp(params: { mobile: string; otp: string }): Promise<SmsResult & { requestId?: string }> {
  const built = buildTextOtpParams(params);
  if ("error" in built) return { sent: false, error: built.error };
  try {
    const response = await fetch(`${env.APITXT_BASE_URL}/api/sendOTP`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: built,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const text = (await response.text()).slice(0, 400);
    let payload: { status?: string | number; message?: string; data?: { request_id?: string } } = {};
    try {
      payload = JSON.parse(text) as typeof payload;
    } catch {
      payload = {};
    }
    const ok = response.ok && (payload.status === "success" || payload.status === 200);
    if (!ok) return { sent: false, error: payload.message || text || `http_${response.status}` };
    return { sent: true, requestId: payload.data?.request_id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[apitxt] text OTP send failed", error);
    return { sent: false, error: message };
  }
}
