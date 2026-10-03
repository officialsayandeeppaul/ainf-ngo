#!/usr/bin/env node
/**
 * Connectivity check for Clerk, Neon, and Upstash. Prints only pass/fail
 * plus public identifiers (hostnames, Clerk key prefix). Never prints secrets.
 *
 *   node scripts/check-integrations.mjs
 */
import { config as loadEnv } from "dotenv";
import { createRequire } from "node:module";

loadEnv({ path: ".env.local", quiet: true });

const require = createRequire(import.meta.url);

function present(key) {
  const value = process.env[key];
  return Boolean(value) && !/^(xxx|your[_-]|replace|changeme|placeholder)/i.test(value);
}

function hostOf(url) {
  try {
    return new URL(url.replace(/^postgresql:/, "http:")).host;
  } catch {
    return "(unparseable)";
  }
}

let failed = 0;
function ok(label, detail) {
  console.log(`  OK      ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label, detail) {
  failed++;
  console.log(`  FAIL    ${label}${detail ? ` — ${detail}` : ""}`);
}

async function checkClerk() {
  if (!present("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") || !present("CLERK_SECRET_KEY")) {
    fail("Clerk", "keys missing");
    return;
  }
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const sk = process.env.CLERK_SECRET_KEY;
  if (!pk.startsWith("pk_test_") && !pk.startsWith("pk_live_")) {
    fail("Clerk publishable key", "unexpected prefix");
    return;
  }
  if (!sk.startsWith("sk_test_") && !sk.startsWith("sk_live_")) {
    fail("Clerk secret key", "unexpected prefix");
    return;
  }
  const res = await fetch("https://api.clerk.com/v1/instance", {
    headers: { Authorization: `Bearer ${sk}` },
  });
  if (!res.ok) {
    fail("Clerk API", `HTTP ${res.status}`);
    return;
  }
  const body = await res.json();
  ok("Clerk API", `${pk.startsWith("pk_test_") ? "test" : "live"} instance`);
  if (body && typeof body.id === "string") {
    ok("Clerk instance", body.id.slice(0, 8) + "…");
  }
}

async function checkPostgres() {
  if (!present("DATABASE_URL")) {
    fail("Postgres", "DATABASE_URL missing");
    return;
  }
  const { Client } = require("pg");
  const pooled = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 15_000,
  });
  try {
    await pooled.connect();
    const tables = await pooled.query(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN
       ('User','KycVerification','PanVerification','AuditLog','WebhookEvent')`
    );
    const users = await pooled.query(`SELECT COUNT(*)::int AS n FROM "User"`);
    ok(
      "Neon Postgres (pooled)",
      `${hostOf(process.env.DATABASE_URL)} · ${tables.rows[0].n}/5 tables · ${users.rows[0].n} users`
    );
  } catch (error) {
    fail("Neon Postgres (pooled)", error.message.split("\n")[0]);
  } finally {
    await pooled.end().catch(() => {});
  }

  if (!present("DIRECT_URL")) return;
  const direct = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 15_000,
  });
  try {
    await direct.connect();
    const triggers = await direct.query(
      `SELECT COUNT(*)::int AS n FROM pg_trigger WHERE tgname IN
       ('audit_log_no_update','audit_log_no_delete')`
    );
    ok(
      "Neon Postgres (direct)",
      `${hostOf(process.env.DIRECT_URL)} · audit triggers ${triggers.rows[0].n}/2`
    );
  } catch (error) {
    fail("Neon Postgres (direct)", error.message.split("\n")[0]);
  } finally {
    await direct.end().catch(() => {});
  }
}

async function checkRedis() {
  if (!present("UPSTASH_REDIS_REST_URL") || !present("UPSTASH_REDIS_REST_TOKEN")) {
    fail("Upstash Redis", "REST keys missing");
    return;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, "");
  const res = await fetch(`${url}/ping`, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok && (body.result === "PONG" || body.result === true)) {
    ok("Upstash Redis", new URL(url).host);
  } else {
    fail("Upstash Redis", `HTTP ${res.status}`);
  }
}

console.log("Integration connectivity\n");
await checkClerk();
await checkPostgres();
await checkRedis();
console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed ? 1 : 0);
