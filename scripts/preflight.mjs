#!/usr/bin/env node
/**
 * Configuration doctor: reports which capabilities are live and which are
 * still waiting on credentials, and where to get each one.
 *
 * The app degrades deliberately rather than crashing when a key is absent —
 * guarded endpoints answer 503 `not_configured` and portal pages render a
 * setup notice — so "the site loads" is not evidence that anything is wired
 * up. This makes the gaps explicit.
 *
 *   npm run preflight
 *
 * Never prints a secret value, only whether one is present.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function loadEnvLocal() {
  try {
    for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      if (value && !process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    console.log("No .env.local found. Copy .env.example to .env.local first.\n");
  }
}

loadEnvLocal();

const isSet = (key) => {
  const value = process.env[key];
  // Treat leftover template text as absent; otherwise a half-filled file reads
  // as configured and fails later with a confusing runtime error.
  return Boolean(value) && !/^(xxx|your[_-]|replace|changeme|placeholder|<)/i.test(value);
};

const CAPABILITIES = [
  {
    name: "Public marketing site",
    keys: [],
    enables: "the 25 Framer HTML routes and configured redirects",
  },
  {
    name: "Clerk authentication",
    keys: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
    enables: "sign-in/sign-up, sessions, MFA, and every portal page",
    where: "Clerk dashboard -> API keys (or `clerk env pull`)",
  },
  {
    name: "Database (Neon Postgres)",
    keys: ["DATABASE_URL"],
    enables: "users, roles, KYC/PAN records, audit log, webhook idempotency",
    where: "Neon console -> connection string (pooled). Then `npm run db:migrate`",
  },
  {
    name: "Distributed rate limiting",
    keys: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    enables: "shared rate limits across instances",
    where: "Upstash console -> Redis -> REST API",
    note: "Without this, production fails closed (429) and dev uses an in-memory window.",
  },
  {
    name: "Clerk user webhook",
    keys: ["CLERK_WEBHOOK_SIGNING_SECRET"],
    enables: "keeping the User table in sync with Clerk user events",
    where: "Clerk dashboard -> Webhooks -> add endpoint /api/webhooks/clerk",
  },
  {
    name: "Didit KYC session creation",
    keys: ["DIDIT_API_KEY", "DIDIT_WORKFLOW_ID"],
    enables: "starting identity verification from /account/verify",
    where: "Didit console",
  },
  {
    name: "Didit webhook verification",
    keys: ["DIDIT_WEBHOOK_SECRET"],
    enables: "USER -> VERIFIED_USER promotion on an approved decision",
    where: "Didit console -> Settings -> Webhooks",
    note: "Promotion is impossible without this: the handler refuses unsigned callbacks.",
  },
  {
    name: "APITXT PAN verification and SMS",
    keys: ["APITXT_AUTH_KEY"],
    enables: "PAN checks and transactional SMS",
    where: "APITXT dashboard",
  },
  {
    name: "Resend email",
    keys: ["RESEND_API_KEY"],
    enables: "verification approved/declined mail and admin security alerts",
    where: "Resend dashboard -> API keys",
  },
  {
    name: "Razorpay membership payments",
    keys: ["NEXT_PUBLIC_RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
    enables: "creating Razorpay orders from /account/membership",
    where: "Razorpay dashboard -> API Keys (test mode)",
  },
  {
    name: "Razorpay webhooks",
    keys: ["RAZORPAY_WEBHOOK_SECRET"],
    enables: "marking membership orders paid from payment.captured",
    where: "Razorpay dashboard -> Webhooks -> URL /api/webhooks/razorpay",
  },
  {
    name: "Super admin bootstrap",
    keys: ["SUPER_ADMIN_BOOTSTRAP_KEY"],
    enables: "claiming the first SUPER_ADMIN role at /admin/bootstrap",
  },
  {
    name: "PAN hashing",
    keys: ["PAN_HASH_SALT"],
    enables: "storing PAN numbers as salted hashes instead of plaintext",
  },
];

const E2E_KEYS = [
  "E2E_USER_EMAIL",
  "E2E_USER_PASSWORD",
  "E2E_VERIFIED_EMAIL",
  "E2E_VERIFIED_PASSWORD",
  "E2E_ADMIN_EMAIL",
  "E2E_ADMIN_PASSWORD",
];

let blocking = 0;
const pending = [];

console.log("AINF platform preflight\n");

for (const capability of CAPABILITIES) {
  const missing = capability.keys.filter((key) => !isSet(key));
  const ready = missing.length === 0;
  console.log(`  ${ready ? "READY  " : "PENDING"}  ${capability.name}`);
  console.log(`           ${capability.enables}`);
  if (!ready) {
    blocking++;
    pending.push({ ...capability, missing });
    console.log(`           missing: ${missing.join(", ")}`);
    if (capability.where) console.log(`           get it: ${capability.where}`);
  }
  if (capability.note) console.log(`           note: ${capability.note}`);
  console.log("");
}

const e2eMissing = E2E_KEYS.filter((key) => !isSet(key));
console.log(
  e2eMissing.length === 0
    ? "  READY    Portal e2e credentials (all three roles)\n"
    : `  PENDING  Portal e2e credentials\n           missing: ${e2eMissing.join(", ")}\n           create these users in Clerk, then \`npx playwright test --project=portal\`\n`
);

if (blocking === 0) {
  console.log("Everything is configured. Run: npm run verify");
} else {
  console.log(`${blocking} capabilit${blocking === 1 ? "y" : "ies"} still pending.`);
  console.log("The site and portal run without them; the pending features answer 503.");
}
