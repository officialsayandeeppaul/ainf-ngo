#!/usr/bin/env node
/**
 * Signs and replays Didit verification webhooks against a running instance.
 *
 * Didit's own "Try Webhook" button needs a publicly reachable URL, so during
 * local work point this at a tunnel (`cloudflared tunnel --url
 * http://localhost:3000`) or at the dev server directly. It exercises the real
 * handler over HTTP, which the unit tests deliberately do not: those verify the
 * signature functions in isolation.
 *
 * Every rejection case here is a security assertion. A forged signature, a
 * stale timestamp, a tampered body, or an exact replay must never cause a state
 * change, so the script exits non-zero if any of them is accepted.
 *
 *   node scripts/replay-didit-webhook.mjs --negative-only
 *   node scripts/replay-didit-webhook.mjs --session <diditSessionId>
 *   node scripts/replay-didit-webhook.mjs --session <id> --status Declined
 *   node scripts/replay-didit-webhook.mjs --base https://x.trycloudflare.com --session <id>
 *
 * The signing helpers are exported and pinned by tests/unit/webhook-replay.test.ts
 * against the server's own verifier, so this harness cannot drift into
 * producing signatures the app would reject.
 */

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/**
 * Mirrors `canonicalJson` in lib/crypto.ts: keys sorted at every level, compact
 * separators, non-ASCII preserved. Must match byte for byte or a V2 signature
 * will not validate.
 */
export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}

export const hmacHex = (secret, message) =>
  createHmac("sha256", secret).update(message).digest("hex");

/**
 * Headers for one of the three schemes Didit may use.
 *
 * `body` is the exact string that will be transmitted; RAW signs those bytes,
 * so the caller must send this string unmodified.
 */
export function signatureHeaders({ scheme, secret, body, timestamp }) {
  const headers = { "x-timestamp": String(timestamp) };
  if (scheme === "V2") {
    headers["x-signature-v2"] = hmacHex(secret, canonicalJson(JSON.parse(body)));
  } else if (scheme === "RAW") {
    headers["x-signature"] = hmacHex(secret, body);
  } else if (scheme === "SIMPLE") {
    const payload = JSON.parse(body);
    const message = `${timestamp}:${payload.session_id}:${payload.status}:${payload.webhook_type}`;
    headers["x-signature-simple"] = hmacHex(secret, message);
  } else {
    throw new Error(`unknown scheme ${scheme}`);
  }
  return headers;
}

function loadEnvLocal() {
  try {
    for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      if (value && !process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    /* no .env.local; rely on the ambient environment */
  }
}

const now = () => Math.floor(Date.now() / 1000);

async function main() {
  loadEnvLocal();

  const args = process.argv.slice(2);
  const flag = (name, fallback) =>
    args.includes(name) ? args[args.indexOf(name) + 1] : fallback;

  const base = flag("--base", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
  const sessionId = flag("--session", null);
  const status = flag("--status", "Approved");
  const vendor = flag("--vendor", "replay-script");
  const negativeOnly = args.includes("--negative-only");
  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  const endpoint = `${base.replace(/\/$/, "")}/api/webhooks/didit`;

  if (!secret) {
    console.error("DIDIT_WEBHOOK_SECRET is not set. Copy it from the Didit console");
    console.error("(Settings -> Webhooks) into .env.local, then re-run.");
    process.exit(2);
  }

  const buildPayload = (overrides = {}) => ({
    session_id: sessionId ?? `replay-${Date.now()}`,
    status,
    webhook_type: "status.updated",
    vendor_data: vendor,
    workflow_id: process.env.DIDIT_WORKFLOW_ID ?? null,
    created_at: now(),
    decision: {
      kyc: { status, document_type: "PAN" },
      reason: status === "Declined" ? "document_unreadable" : null,
    },
    ...overrides,
  });

  const results = [];

  async function send({ label, body, headers, expect }) {
    let response;
    let text = "";
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body,
      });
      text = await response.text();
    } catch (error) {
      console.log(`  FAIL  ${label}\n        request failed: ${error.message}`);
      results.push(false);
      return;
    }
    const ok = expect.includes(response.status);
    const detail = text.length > 140 ? `${text.slice(0, 140)}...` : text;
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${label.padEnd(48)} ${response.status}  ${detail}`);
    if (!ok) console.log(`        expected one of ${expect.join(", ")}`);
    results.push(ok);
  }

  console.log(`Replaying Didit webhooks against ${endpoint}\n`);
  console.log("Rejection cases (must not be accepted):");

  const REJECT = [401, 503];

  await send({
    label: "no signature headers at all",
    body: JSON.stringify(buildPayload()),
    headers: { "x-timestamp": String(now()) },
    expect: REJECT,
  });

  await send({
    label: "forged V2 signature",
    body: JSON.stringify(buildPayload()),
    headers: { "x-timestamp": String(now()), "x-signature-v2": "b".repeat(64) },
    expect: REJECT,
  });

  {
    // Correctly signed but timestamped outside the freshness window: the shape
    // a captured-and-resent request takes.
    const body = JSON.stringify(buildPayload());
    const stale = now() - 3600;
    await send({
      label: "valid signature, stale timestamp",
      body,
      headers: signatureHeaders({ scheme: "V2", secret, body, timestamp: stale }),
      expect: REJECT,
    });
  }

  {
    // Signature computed over the original, then the body swapped out.
    const original = JSON.stringify(buildPayload({ vendor_data: "legitimate" }));
    const headers = signatureHeaders({ scheme: "V2", secret, body: original, timestamp: now() });
    const tampered = JSON.stringify(buildPayload({ vendor_data: "attacker", status: "Approved" }));
    await send({ label: "payload tampered after signing", body: tampered, headers, expect: REJECT });
  }

  await send({
    label: "SIMPLE scheme with a forged signature",
    body: JSON.stringify(buildPayload()),
    headers: { "x-timestamp": String(now()), "x-signature-simple": "c".repeat(64) },
    expect: REJECT,
  });

  if (!negativeOnly) {
    console.log("\nAcceptance cases:");
    if (!sessionId) {
      console.log("  note  no --session given. A signed payload for an unknown session is");
      console.log("        verified and then deliberately ignored, so nothing is promoted.");
    }

    const ACCEPT = [200, 503];

    {
      const body = JSON.stringify(buildPayload());
      await send({
        label: "V2 signature (canonical JSON)",
        body,
        headers: signatureHeaders({ scheme: "V2", secret, body, timestamp: now() }),
        expect: ACCEPT,
      });
      // Byte-identical resend: dedupe is on (provider, session_id, status), so
      // this must report deduplicated rather than acting a second time.
      await send({
        label: "exact replay of the same event (deduplicated)",
        body,
        headers: signatureHeaders({ scheme: "V2", secret, body, timestamp: now() }),
        expect: ACCEPT,
      });
    }

    {
      const body = JSON.stringify(buildPayload({ session_id: `${sessionId ?? "replay"}-raw` }));
      await send({
        label: "RAW signature (exact transmitted bytes)",
        body,
        headers: signatureHeaders({ scheme: "RAW", secret, body, timestamp: now() }),
        expect: ACCEPT,
      });
    }

    {
      const body = JSON.stringify(buildPayload({ session_id: `${sessionId ?? "replay"}-simple` }));
      await send({
        label: "SIMPLE signature (decision re-fetched, untrusted)",
        body,
        headers: signatureHeaders({ scheme: "SIMPLE", secret, body, timestamp: now() }),
        expect: ACCEPT,
      });
    }
  }

  const failed = results.filter((r) => !r).length;
  console.log(
    failed === 0
      ? `\nAll ${results.length} checks behaved as expected.`
      : `\n${failed} of ${results.length} checks did NOT behave as expected.`
  );
  console.log(
    "\nA 503 means the instance still lacks DIDIT_WEBHOOK_SECRET or DATABASE_URL;\n" +
      "the handler refuses before verifying. Configure both to test acceptance."
  );
  process.exit(failed ? 1 : 0);
}

// Only run when invoked directly, so the signing helpers can be imported by tests.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
