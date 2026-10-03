import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { KycStatus } from "@prisma/client";
import {
  isFreshTimestamp,
  mapDiditStatus,
  verifyWebhookSignature,
} from "@/lib/didit";
import { canonicalJson } from "@/lib/crypto";

const SECRET = "test_didit_webhook_secret";

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function sign(secret: string, message: string | Buffer) {
  return createHmac("sha256", secret).update(message).digest("hex");
}

function headersFor(entries: Record<string, string>) {
  return new Headers(entries);
}

const payload = {
  session_id: "sess_abc123",
  status: "Approved",
  webhook_type: "status.updated",
  vendor_data: "user_1",
  decision: { kyc: { document_type: "Passport", first_name: "Ada" } },
};

describe("timestamp freshness", () => {
  it("accepts a timestamp inside the 5 minute window", () => {
    expect(isFreshTimestamp(String(nowSeconds()))).toBe(true);
    expect(isFreshTimestamp(String(nowSeconds() - 299))).toBe(true);
  });

  it("rejects a replayed timestamp outside the window", () => {
    expect(isFreshTimestamp(String(nowSeconds() - 301))).toBe(false);
    expect(isFreshTimestamp(String(nowSeconds() - 86_400))).toBe(false);
  });

  it("rejects a timestamp too far in the future", () => {
    expect(isFreshTimestamp(String(nowSeconds() + 600))).toBe(false);
  });

  it("rejects missing and non-numeric timestamps", () => {
    expect(isFreshTimestamp(null)).toBe(false);
    expect(isFreshTimestamp("not-a-number")).toBe(false);
    expect(isFreshTimestamp("")).toBe(false);
  });
});

describe("X-Signature-V2 (canonical JSON)", () => {
  it("accepts a correctly signed payload", () => {
    const ts = String(nowSeconds());
    const raw = JSON.stringify(payload);
    const result = verifyWebhookSignature({
      rawBody: raw,
      headers: headersFor({
        "x-timestamp": ts,
        "x-signature-v2": sign(SECRET, canonicalJson(payload)),
      }),
      secret: SECRET,
    });
    expect(result).toEqual({ ok: true, scheme: "V2", trustsPayload: true });
  });

  it("accepts the same payload with keys in a different order", () => {
    const ts = String(nowSeconds());
    // Canonicalisation sorts keys, so wire order must not matter.
    const reordered = {
      decision: payload.decision,
      vendor_data: payload.vendor_data,
      webhook_type: payload.webhook_type,
      status: payload.status,
      session_id: payload.session_id,
    };
    const result = verifyWebhookSignature({
      rawBody: JSON.stringify(reordered),
      headers: headersFor({
        "x-timestamp": ts,
        "x-signature-v2": sign(SECRET, canonicalJson(payload)),
      }),
      secret: SECRET,
    });
    expect(result.ok).toBe(true);
  });

  it("preserves non-ASCII characters when canonicalising", () => {
    const unicode = { ...payload, decision: { kyc: { first_name: "Ana María 中文" } } };
    const result = verifyWebhookSignature({
      rawBody: JSON.stringify(unicode),
      headers: headersFor({
        "x-timestamp": String(nowSeconds()),
        "x-signature-v2": sign(SECRET, canonicalJson(unicode)),
      }),
      secret: SECRET,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a forged signature", () => {
    const result = verifyWebhookSignature({
      rawBody: JSON.stringify(payload),
      headers: headersFor({
        "x-timestamp": String(nowSeconds()),
        "x-signature-v2": "deadbeef".repeat(8),
      }),
      secret: SECRET,
    });
    expect(result).toEqual({ ok: false, reason: "signature_mismatch_v2" });
  });

  it("rejects a signature made with the wrong secret", () => {
    const result = verifyWebhookSignature({
      rawBody: JSON.stringify(payload),
      headers: headersFor({
        "x-timestamp": String(nowSeconds()),
        "x-signature-v2": sign("attacker_secret", canonicalJson(payload)),
      }),
      secret: SECRET,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a payload tampered with after signing", () => {
    const signature = sign(SECRET, canonicalJson(payload));
    const tampered = { ...payload, status: "Approved", vendor_data: "user_999" };
    const result = verifyWebhookSignature({
      rawBody: JSON.stringify(tampered),
      headers: headersFor({ "x-timestamp": String(nowSeconds()), "x-signature-v2": signature }),
      secret: SECRET,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a valid signature carried on a stale timestamp", () => {
    const result = verifyWebhookSignature({
      rawBody: JSON.stringify(payload),
      headers: headersFor({
        "x-timestamp": String(nowSeconds() - 4000),
        "x-signature-v2": sign(SECRET, canonicalJson(payload)),
      }),
      secret: SECRET,
    });
    expect(result).toEqual({ ok: false, reason: "stale_or_missing_timestamp" });
  });
});

describe("X-Signature (raw bytes)", () => {
  it("accepts a signature over the exact received bytes", () => {
    // Whitespace that JSON.stringify would not produce, to prove the raw bytes
    // are what get signed rather than a re-serialisation.
    const raw = '{ "session_id": "sess_abc123",  "status": "Approved" }';
    const result = verifyWebhookSignature({
      rawBody: raw,
      headers: headersFor({
        "x-timestamp": String(nowSeconds()),
        "x-signature": sign(SECRET, Buffer.from(raw, "utf8")),
      }),
      secret: SECRET,
    });
    expect(result).toEqual({ ok: true, scheme: "RAW", trustsPayload: true });
  });

  it("rejects when a byte changes", () => {
    const raw = '{"session_id":"sess_abc123","status":"Approved"}';
    const signature = sign(SECRET, Buffer.from(raw, "utf8"));
    const result = verifyWebhookSignature({
      rawBody: raw.replace("Approved", "approved"),
      headers: headersFor({ "x-timestamp": String(nowSeconds()), "x-signature": signature }),
      secret: SECRET,
    });
    expect(result.ok).toBe(false);
  });
});

describe("X-Signature-Simple", () => {
  const simpleMessage = (ts: string) =>
    `${ts}:${payload.session_id}:${payload.status}:${payload.webhook_type}`;

  it("accepts a valid simple signature but does not trust the payload", () => {
    const ts = String(nowSeconds());
    const result = verifyWebhookSignature({
      rawBody: JSON.stringify(payload),
      headers: headersFor({
        "x-timestamp": ts,
        "x-signature-simple": sign(SECRET, simpleMessage(ts)),
      }),
      secret: SECRET,
    });
    expect(result).toEqual({ ok: true, scheme: "SIMPLE", trustsPayload: false });
  });

  it("cannot be used to smuggle an unsigned decision body", () => {
    // The decision is swapped but the four signed fields are untouched, so the
    // signature still validates. trustsPayload=false is what protects us here.
    const ts = String(nowSeconds());
    const smuggled = { ...payload, decision: { kyc: { first_name: "Attacker" } } };
    const result = verifyWebhookSignature({
      rawBody: JSON.stringify(smuggled),
      headers: headersFor({
        "x-timestamp": ts,
        "x-signature-simple": sign(SECRET, simpleMessage(ts)),
      }),
      secret: SECRET,
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.trustsPayload).toBe(false);
  });

  it("rejects a forged simple signature", () => {
    const ts = String(nowSeconds());
    const result = verifyWebhookSignature({
      rawBody: JSON.stringify(payload),
      headers: headersFor({ "x-timestamp": ts, "x-signature-simple": "0".repeat(64) }),
      secret: SECRET,
    });
    expect(result.ok).toBe(false);
  });
});

describe("missing headers and secret", () => {
  it("rejects a request with no signature header at all", () => {
    const result = verifyWebhookSignature({
      rawBody: JSON.stringify(payload),
      headers: headersFor({ "x-timestamp": String(nowSeconds()) }),
      secret: SECRET,
    });
    expect(result).toEqual({ ok: false, reason: "no_signature_header" });
  });

  it("rejects when no secret is configured", () => {
    const result = verifyWebhookSignature({
      rawBody: JSON.stringify(payload),
      headers: headersFor({
        "x-timestamp": String(nowSeconds()),
        "x-signature-v2": "abc",
      }),
      secret: "",
    });
    expect(result).toEqual({ ok: false, reason: "webhook_secret_missing" });
  });

  it("rejects malformed JSON on the V2 path", () => {
    const result = verifyWebhookSignature({
      rawBody: "{not json",
      headers: headersFor({
        "x-timestamp": String(nowSeconds()),
        "x-signature-v2": "abc",
      }),
      secret: SECRET,
    });
    expect(result).toEqual({ ok: false, reason: "invalid_json" });
  });
});

describe("status mapping", () => {
  it("maps Didit's human-readable statuses", () => {
    expect(mapDiditStatus("Approved")).toBe(KycStatus.APPROVED);
    expect(mapDiditStatus("Declined")).toBe(KycStatus.DECLINED);
    expect(mapDiditStatus("In Review")).toBe(KycStatus.IN_REVIEW);
    expect(mapDiditStatus("In Progress")).toBe(KycStatus.IN_PROGRESS);
    expect(mapDiditStatus("Abandoned")).toBe(KycStatus.ABANDONED);
    expect(mapDiditStatus("Expired")).toBe(KycStatus.EXPIRED);
    expect(mapDiditStatus("Kyc Expired")).toBe(KycStatus.EXPIRED);
    expect(mapDiditStatus("Not Started")).toBe(KycStatus.NOT_STARTED);
  });

  it("is insensitive to case, spacing, and hyphens", () => {
    expect(mapDiditStatus("  approved ")).toBe(KycStatus.APPROVED);
    expect(mapDiditStatus("in-review")).toBe(KycStatus.IN_REVIEW);
    expect(mapDiditStatus("IN_PROGRESS")).toBe(KycStatus.IN_PROGRESS);
  });

  it("falls back to NOT_STARTED for anything unrecognised", () => {
    // Fail safe: an unknown status must never read as APPROVED.
    expect(mapDiditStatus("something-new")).toBe(KycStatus.NOT_STARTED);
    expect(mapDiditStatus(null)).toBe(KycStatus.NOT_STARTED);
    expect(mapDiditStatus(undefined)).toBe(KycStatus.NOT_STARTED);
  });
});

describe("canonical JSON", () => {
  it("sorts keys at every depth", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it("preserves array order", () => {
    expect(canonicalJson({ a: [3, 1, 2] })).toBe('{"a":[3,1,2]}');
  });

  it("sorts keys inside array elements", () => {
    expect(canonicalJson([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
  });
});
