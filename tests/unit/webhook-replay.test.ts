import { describe, expect, it } from "vitest";
import { canonicalJson, signatureHeaders } from "../../scripts/replay-didit-webhook.mjs";
import { canonicalJson as serverCanonicalJson } from "@/lib/crypto";
import { verifyWebhookSignature } from "@/lib/didit";

/**
 * Pins the replay harness to the server's verifier.
 *
 * scripts/replay-didit-webhook.mjs re-implements canonical JSON and HMAC
 * signing so it can run as a standalone Node script with no build step. That
 * duplication is the risk these tests cover: if lib/crypto's canonicalisation
 * ever changes, the harness would start emitting signatures the app rejects,
 * and the resulting failures would look like a broken webhook handler rather
 * than a broken test tool.
 */

const SECRET = "replay-harness-test-secret";

const payload = {
  session_id: "sess_abc123",
  status: "Approved",
  webhook_type: "status.updated",
  vendor_data: "user_123",
  // Deliberately awkward: unsorted keys, nesting, non-ASCII, null, array,
  // numbers. Canonicalisation has to agree on all of it.
  decision: {
    kyc: { status: "Approved", document_type: "PAN" },
    reason: null,
    names: ["Ananya", "Ravi"],
    score: 0.975,
    note: "verified ✓ naïve",
  },
  created_at: 1_767_225_600,
};

function headersFrom(record: Record<string, string>): Headers {
  return new Headers(record);
}

describe("replay harness canonical JSON", () => {
  it("matches the server implementation byte for byte", () => {
    expect(canonicalJson(payload)).toBe(serverCanonicalJson(payload));
  });

  it("agrees on primitives, arrays, and nested objects", () => {
    for (const value of [
      null,
      0,
      -1.5,
      "plain",
      "unicode ✓ ✗ naïve",
      true,
      [],
      [1, "two", null],
      {},
      { b: 1, a: 2 },
      { z: { y: { x: [1, { w: null }] } } },
    ]) {
      expect(canonicalJson(value)).toBe(serverCanonicalJson(value));
    }
  });

  it("is independent of key insertion order", () => {
    const reordered = {
      created_at: payload.created_at,
      decision: payload.decision,
      webhook_type: payload.webhook_type,
      vendor_data: payload.vendor_data,
      status: payload.status,
      session_id: payload.session_id,
    };
    expect(canonicalJson(reordered)).toBe(canonicalJson(payload));
  });
});

describe("replay harness signatures are accepted by the server verifier", () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify(payload);

  it("V2", () => {
    const result = verifyWebhookSignature({
      rawBody: body,
      headers: headersFrom(signatureHeaders({ scheme: "V2", secret: SECRET, body, timestamp })),
      secret: SECRET,
      nowSeconds: timestamp,
    });
    expect(result).toEqual({ ok: true, scheme: "V2", trustsPayload: true });
  });

  it("RAW, over the exact transmitted bytes", () => {
    const result = verifyWebhookSignature({
      rawBody: body,
      headers: headersFrom(signatureHeaders({ scheme: "RAW", secret: SECRET, body, timestamp })),
      secret: SECRET,
      nowSeconds: timestamp,
    });
    expect(result).toEqual({ ok: true, scheme: "RAW", trustsPayload: true });
  });

  it("SIMPLE, and the decision stays untrusted", () => {
    const result = verifyWebhookSignature({
      rawBody: body,
      headers: headersFrom(signatureHeaders({ scheme: "SIMPLE", secret: SECRET, body, timestamp })),
      secret: SECRET,
      nowSeconds: timestamp,
    });
    expect(result).toEqual({ ok: true, scheme: "SIMPLE", trustsPayload: false });
  });
});

describe("replay harness rejection cases really are rejected", () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify(payload);

  it("a stale timestamp fails even though the signature is valid", () => {
    const stale = timestamp - 3600;
    const result = verifyWebhookSignature({
      rawBody: body,
      headers: headersFrom(
        signatureHeaders({ scheme: "V2", secret: SECRET, body, timestamp: stale })
      ),
      secret: SECRET,
      nowSeconds: timestamp,
    });
    expect(result.ok).toBe(false);
  });

  it("a body swapped after signing fails", () => {
    const headers = signatureHeaders({ scheme: "V2", secret: SECRET, body, timestamp });
    const tampered = JSON.stringify({ ...payload, vendor_data: "attacker" });
    const result = verifyWebhookSignature({
      rawBody: tampered,
      headers: headersFrom(headers),
      secret: SECRET,
      nowSeconds: timestamp,
    });
    expect(result.ok).toBe(false);
  });

  it("a signature made with the wrong secret fails", () => {
    const headers = signatureHeaders({ scheme: "V2", secret: "wrong-secret", body, timestamp });
    const result = verifyWebhookSignature({
      rawBody: body,
      headers: headersFrom(headers),
      secret: SECRET,
      nowSeconds: timestamp,
    });
    expect(result.ok).toBe(false);
  });

  it("RAW signed over re-serialised JSON fails, proving byte-exactness matters", () => {
    // Same object, different bytes: whitespace added the way a naive
    // implementation would.
    const pretty = JSON.stringify(payload, null, 2);
    const headers = signatureHeaders({ scheme: "RAW", secret: SECRET, body: pretty, timestamp });
    const result = verifyWebhookSignature({
      rawBody: body,
      headers: headersFrom(headers),
      secret: SECRET,
      nowSeconds: timestamp,
    });
    expect(result.ok).toBe(false);
  });
});
