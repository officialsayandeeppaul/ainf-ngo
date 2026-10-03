import { KycStatus } from "@prisma/client";
import { canonicalJson, hmacSha256Hex, safeEqualHex } from "./crypto";
import { env, isDiditConfigured, requireDiditEnv, requireDiditWebhookEnv } from "./env";

/**
 * Didit identity verification (API v3).
 *
 * Two things here are load-bearing for security:
 *  - `verifyWebhookSignature` authenticates the payload before any of it is
 *    used to change a role, and rejects stale timestamps to stop replays.
 *  - The SIMPLE signature scheme only covers status fields, not the decision
 *    body, so callers must treat that path as unauthenticated for decision data
 *    and re-fetch from the API. `trustsPayload` on the result says which it is.
 */

export const DIDIT_SESSION_PATH = "/v3/session/";
const TIMESTAMP_TOLERANCE_SECONDS = 300;

export class DiditError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "DiditError";
    this.status = status;
    this.body = body;
  }
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

/** Didit reports human-readable statuses; normalise before storing. */
export function mapDiditStatus(raw: string | null | undefined): KycStatus {
  const key = (raw ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  switch (key) {
    case "APPROVED":
      return KycStatus.APPROVED;
    case "DECLINED":
    case "REJECTED":
      return KycStatus.DECLINED;
    case "IN_REVIEW":
    case "IN_MANUAL_REVIEW":
      return KycStatus.IN_REVIEW;
    case "IN_PROGRESS":
    case "STARTED":
      return KycStatus.IN_PROGRESS;
    case "ABANDONED":
      return KycStatus.ABANDONED;
    case "EXPIRED":
    case "KYC_EXPIRED":
      return KycStatus.EXPIRED;
    case "NOT_STARTED":
    default:
      return KycStatus.NOT_STARTED;
  }
}

export const TERMINAL_STATUSES: KycStatus[] = [
  KycStatus.APPROVED,
  KycStatus.DECLINED,
  KycStatus.ABANDONED,
  KycStatus.EXPIRED,
];

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

export type DiditSession = {
  sessionId: string;
  url: string;
  sessionNumber?: number;
  status: KycStatus;
};

export async function createVerificationSession(params: {
  vendorData: string;
  callbackUrl: string;
  contactEmail?: string | null;
}): Promise<DiditSession> {
  const { DIDIT_API_KEY, DIDIT_WORKFLOW_ID } = requireDiditEnv();

  const response = await fetch(`${env.DIDIT_API_BASE}${DIDIT_SESSION_PATH}`, {
    method: "POST",
    headers: {
      "x-api-key": DIDIT_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      workflow_id: DIDIT_WORKFLOW_ID,
      // vendor_data carries our own user id back through the webhook, which is
      // how a decision is attributed to an account.
      vendor_data: params.vendorData,
      callback: params.callbackUrl,
      contact_details: params.contactEmail ? { email: params.contactEmail } : undefined,
    }),
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    // Didit answers auth failures with 403, never 401.
    throw new DiditError(
      response.status === 403
        ? "Didit rejected the API key or workflow. Check DIDIT_API_KEY and DIDIT_WORKFLOW_ID."
        : `Didit session creation failed (HTTP ${response.status}).`,
      response.status,
      text.slice(0, 800)
    );
  }

  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new DiditError("Didit returned a non-JSON session response.", response.status, text.slice(0, 800));
  }

  const sessionId = payload.session_id ?? payload.id;
  // v3 names this field `url`; older docs and v2 called it `verification_url`.
  const url = payload.url ?? payload.verification_url;
  if (!sessionId || !url) {
    throw new DiditError(
      "Didit session response missing session_id or url.",
      response.status,
      text.slice(0, 800)
    );
  }

  return {
    sessionId: String(sessionId),
    url: String(url),
    sessionNumber: typeof payload.session_number === "number" ? payload.session_number : undefined,
    status: mapDiditStatus(payload.status),
  };
}

/**
 * Authoritative session fetch. Used on the Didit return URL (query params are
 * not trusted) and whenever a webhook payload was not fully signed.
 */
export async function fetchSession(sessionId: string): Promise<{
  status: KycStatus;
  decision: unknown;
  raw: Record<string, unknown>;
}> {
  const { DIDIT_API_KEY } = requireDiditEnv();
  const response = await fetch(
    `${env.DIDIT_API_BASE}/v3/session/${encodeURIComponent(sessionId)}/`,
    {
      headers: { "x-api-key": DIDIT_API_KEY, accept: "application/json" },
      cache: "no-store",
    }
  );
  const text = await response.text();
  if (!response.ok) {
    try {
      const decision = await fetchSessionDecision(sessionId);
      const nested = (decision as { status?: string; kyc?: { status?: string } }) ?? {};
      return {
        status: mapDiditStatus(nested.status ?? nested.kyc?.status),
        decision,
        raw: typeof decision === "object" && decision ? (decision as Record<string, unknown>) : {},
      };
    } catch {
      throw new DiditError(
        `Didit session fetch failed (HTTP ${response.status}).`,
        response.status,
        text.slice(0, 800)
      );
    }
  }
  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new DiditError("Didit returned a non-JSON session.", response.status, text.slice(0, 800));
  }
  let status = mapDiditStatus(payload.status ?? payload.session_status);
  let decision = payload.decision ?? payload;
  if (status === KycStatus.IN_PROGRESS || status === KycStatus.NOT_STARTED) {
    try {
      const extra = await fetchSessionDecision(sessionId);
      const nested = extra as { status?: string; kyc?: { status?: string } };
      const mapped = mapDiditStatus(nested.status ?? nested.kyc?.status);
      if (mapped !== KycStatus.NOT_STARTED && mapped !== KycStatus.IN_PROGRESS) {
        status = mapped;
        decision = extra;
      }
    } catch {
      // Session GET remains authoritative when the decision endpoint is empty.
    }
  }
  return {
    status,
    decision,
    raw: payload,
  };
}

/**
 * Authoritative decision fetch. Used whenever the webhook payload itself was
 * not cryptographically covered, so decision data always has a trusted source.
 */
export async function fetchSessionDecision(sessionId: string): Promise<any> {
  const { DIDIT_API_KEY } = requireDiditEnv();
  const response = await fetch(
    `${env.DIDIT_API_BASE}/v3/session/${encodeURIComponent(sessionId)}/decision/`,
    {
      headers: { "x-api-key": DIDIT_API_KEY, accept: "application/json" },
      cache: "no-store",
    }
  );
  const text = await response.text();
  if (!response.ok) {
    throw new DiditError(
      `Didit decision fetch failed (HTTP ${response.status}).`,
      response.status,
      text.slice(0, 800)
    );
  }
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// Webhook verification
// ---------------------------------------------------------------------------

export type SignatureScheme = "V2" | "RAW" | "SIMPLE";

export type WebhookVerification =
  | {
      ok: true;
      scheme: SignatureScheme;
      /** False for SIMPLE: only status fields were signed, not the decision. */
      trustsPayload: boolean;
    }
  | { ok: false; reason: string };

export function isFreshTimestamp(
  timestampHeader: string | null,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (!timestampHeader) return false;
  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) return false;
  return Math.abs(nowSeconds - timestamp) <= TIMESTAMP_TOLERANCE_SECONDS;
}

/**
 * Verifies a Didit webhook against the shared secret.
 *
 * Order matters: freshness first (cheap, kills replays), then the strongest
 * available signature. `rawBody` must be the exact bytes received — any
 * re-serialisation invalidates the RAW scheme.
 */
export function verifyWebhookSignature(params: {
  rawBody: Buffer | string;
  headers: Headers;
  secret?: string;
  nowSeconds?: number;
}): WebhookVerification {
  const secret = params.secret ?? env.DIDIT_WEBHOOK_SECRET;
  if (!secret) return { ok: false, reason: "webhook_secret_missing" };

  const timestampHeader = params.headers.get("x-timestamp");
  if (!isFreshTimestamp(timestampHeader, params.nowSeconds)) {
    return { ok: false, reason: "stale_or_missing_timestamp" };
  }

  const raw = Buffer.isBuffer(params.rawBody) ? params.rawBody : Buffer.from(params.rawBody, "utf8");

  const v2 = params.headers.get("x-signature-v2");
  if (v2) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString("utf8"));
    } catch {
      return { ok: false, reason: "invalid_json" };
    }
    const expected = hmacSha256Hex(secret, canonicalJson(parsed));
    if (safeEqualHex(expected, v2)) {
      return { ok: true, scheme: "V2", trustsPayload: true };
    }
    return { ok: false, reason: "signature_mismatch_v2" };
  }

  const rawSignature = params.headers.get("x-signature");
  if (rawSignature) {
    const expected = hmacSha256Hex(secret, raw);
    if (safeEqualHex(expected, rawSignature)) {
      return { ok: true, scheme: "RAW", trustsPayload: true };
    }
    return { ok: false, reason: "signature_mismatch_raw" };
  }

  const simple = params.headers.get("x-signature-simple");
  if (simple) {
    let parsed: any;
    try {
      parsed = JSON.parse(raw.toString("utf8"));
    } catch {
      return { ok: false, reason: "invalid_json" };
    }
    const message = `${timestampHeader}:${parsed?.session_id}:${parsed?.status}:${parsed?.webhook_type}`;
    const expected = hmacSha256Hex(secret, message);
    if (safeEqualHex(expected, simple)) {
      // Only the four fields above are authenticated. The decision body that
      // arrived alongside them is not, so the caller must re-fetch it.
      return { ok: true, scheme: "SIMPLE", trustsPayload: false };
    }
    return { ok: false, reason: "signature_mismatch_simple" };
  }

  return { ok: false, reason: "no_signature_header" };
}

export function assertDiditReady(): void {
  if (!isDiditConfigured) requireDiditEnv();
  requireDiditWebhookEnv();
}
