#!/usr/bin/env node
/**
 * Guards the 25 Framer HTML route handlers against regressions during runtime
 * upgrades. Hashes the decoded body of every route plus the configured
 * redirects, then compares against a stored baseline.
 *
 *   node scripts/verify-framer-routes.mjs --base http://localhost:3001 --save
 *   node scripts/verify-framer-routes.mjs --base http://localhost:3000
 */
import { createHash } from "node:crypto";
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const BASELINE = join(ROOT, "scripts", "framer-routes.baseline.json");

const args = process.argv.slice(2);
const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3000";
const save = args.includes("--save");

function discoverRoutes(dir = join(ROOT, "app"), acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      discoverRoutes(full, acc);
    } else if (entry === "route.ts") {
      // Only the static Framer pages declare force-static; API routes do not.
      if (!readFileSync(full, "utf8").includes('dynamic = "force-static"')) continue;
      const rel = relative(join(ROOT, "app"), dir).split(sep).join("/");
      acc.push(rel === "" ? "/" : `/${rel}`);
    }
  }
  return acc;
}

const REDIRECTS = [
  ["/about%20us", "/about-us"],
  ["/contact", "/contact-us"],
  ["/privacy", "/legal-pages/terms-conditions"],
  ["/terms-of-use", "/legal-pages/terms-conditions"],
  ["/terms-conditions", "/legal-pages/terms-conditions"],
];

async function hashRoute(path) {
  const res = await fetch(`${base}${path}`, { redirect: "manual" });
  if (res.status !== 200) return { status: res.status, hash: null };
  // fetch transparently decompresses, so this hashes the HTML itself rather
  // than the gzip envelope, which is what actually matters for correctness.
  const body = await res.text();
  return { status: 200, hash: createHash("sha256").update(body).digest("hex"), bytes: body.length };
}

async function main() {
  const routes = discoverRoutes().sort();
  console.log(`Checking ${routes.length} Framer routes against ${base}\n`);

  const current = {};
  let failed = 0;

  for (const route of routes) {
    try {
      const result = await hashRoute(route);
      current[route] = result;
      if (result.status !== 200) {
        console.log(`  FAIL  ${route} -> HTTP ${result.status}`);
        failed++;
      } else {
        console.log(`  ok    ${route}  ${String(result.bytes).padStart(8)} bytes`);
      }
    } catch (err) {
      current[route] = { status: 0, hash: null, error: String(err) };
      console.log(`  FAIL  ${route} -> ${err.message}`);
      failed++;
    }
  }

  console.log("\nRedirects:");
  for (const [from, to] of REDIRECTS) {
    try {
      const res = await fetch(`${base}${from}`, { redirect: "manual" });
      const location = res.headers.get("location") || "";
      const ok = res.status >= 300 && res.status < 400 && location.endsWith(to);
      console.log(`  ${ok ? "ok  " : "FAIL"}  ${from} -> ${location || res.status}`);
      if (!ok) failed++;
      current[`redirect:${from}`] = { status: res.status, location };
    } catch (err) {
      console.log(`  FAIL  ${from} -> ${err.message}`);
      failed++;
    }
  }

  if (save) {
    writeFileSync(BASELINE, JSON.stringify(current, null, 2));
    console.log(`\nBaseline written to ${relative(ROOT, BASELINE)} (${routes.length} routes)`);
    process.exit(failed ? 1 : 0);
  }

  if (!existsSync(BASELINE)) {
    console.log("\nNo baseline stored. Re-run with --save first.");
    process.exit(failed ? 1 : 0);
  }

  const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  let drifted = 0;
  console.log("\nComparing against baseline:");
  for (const [key, expected] of Object.entries(baseline)) {
    const actual = current[key];
    if (!actual) {
      console.log(`  MISSING  ${key}`);
      drifted++;
    } else if (expected.hash && expected.hash !== actual.hash) {
      console.log(`  DRIFT    ${key}  ${expected.bytes} -> ${actual.bytes} bytes`);
      drifted++;
    } else if (expected.location && expected.location !== actual.location) {
      console.log(`  DRIFT    ${key}  ${expected.location} -> ${actual.location}`);
      drifted++;
    }
  }
  console.log(drifted === 0 ? "  All routes byte-identical to baseline." : `  ${drifted} route(s) drifted.`);
  process.exit(failed || drifted ? 1 : 0);
}

main();
