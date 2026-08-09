#!/usr/bin/env node
/**
 * Verify AINF Hinglish content across routes and framer-site JS
 * Usage: node scripts/verify-ainf-content.js [--url http://localhost:3000]
 */
const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const MANIFEST = JSON.parse(
  fs.readFileSync(path.join(__dirname, "content/ainf-hinglish.json"), "utf8")
);

const baseUrl = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : "http://localhost:3000";

function extractHtml(source) {
  const start = source.indexOf('const HTML = "');
  if (start < 0) return "";
  let i = start + 'const HTML = "'.length;
  let out = "";
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\" && i + 1 < source.length) {
      const next = source[i + 1];
      if (next === "n") {
        out += "\n";
        i += 2;
        continue;
      }
      if (next === "t") {
        out += "\t";
        i += 2;
        continue;
      }
      if (next === "r") {
        out += "\r";
        i += 2;
        continue;
      }
      if (next === '"') {
        out += '"';
        i += 2;
        continue;
      }
      if (next === "\\") {
        out += "\\";
        i += 2;
        continue;
      }
      out += next;
      i += 2;
      continue;
    }
    if (ch === '"') break;
    out += ch;
    i++;
  }
  return out;
}

function getAllRoutes() {
  const routes = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name === "route.ts") routes.push(p);
    }
  }
  walk(path.join(ROOT, "app"));
  return routes;
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve({ status: res.statusCode, body: d }));
      })
      .on("error", reject);
  });
}

function scanFiles() {
  const failures = [];
  const files = [
    ...getAllRoutes().map((f) => ({ type: "route", path: f })),
    ...fs
      .readdirSync(path.join(ROOT, "public/framer-site"))
      .filter((f) => f.endsWith(".mjs"))
      .map((f) => ({
        type: "js",
        path: path.join(ROOT, "public/framer-site", f),
      })),
  ];

  for (const { type, path: fp } of files) {
    const text =
      type === "route"
        ? extractHtml(fs.readFileSync(fp, "utf8"))
        : fs.readFileSync(fp, "utf8");
    for (const banned of MANIFEST.banned) {
      if (text.includes(banned)) {
        failures.push({ file: fp, issue: `banned: "${banned}"` });
      }
    }
    if (type === "route" && text.includes(MANIFEST.brand.cdnPrefix)) {
      const scripts = (text.match(/framerusercontent\.com\/sites\/4rh1Ar3UIHjE7dNhomsEMN\/[^"'\s]+/g) || []).filter(
        (u) => !u.includes("searchIndex")
      );
      if (scripts.length) {
        failures.push({
          file: fp,
          issue: `CDN script URLs remain (${scripts.length})`,
        });
      }
    }
  }

  return failures;
}

async function scanHttp() {
  const failures = [];
  for (const route of MANIFEST.routes) {
    const url = baseUrl + (route === "/" ? "" : route);
    try {
      const res = await httpGet(url);
      if (res.status !== 200) {
        failures.push({ route, issue: `HTTP ${res.status}` });
        continue;
      }
      for (const banned of MANIFEST.banned) {
        if (res.body.includes(banned)) {
          failures.push({ route, issue: `live banned: "${banned}"` });
        }
      }
      const markers = MANIFEST.requiredMarkers[route] || [];
      for (const m of markers) {
        if (!res.body.includes(m)) {
          failures.push({ route, issue: `missing marker: "${m}"` });
        }
      }
    } catch (e) {
      failures.push({ route, issue: `fetch error: ${e.message}` });
    }
  }
  return failures;
}

async function main() {
  console.log("=== File scan ===");
  const fileFails = scanFiles();
  if (fileFails.length) {
    fileFails.forEach((f) =>
      console.log("FAIL", path.relative(ROOT, f.file), f.issue)
    );
  } else {
    console.log("All files clean (banned + CDN scripts).");
  }

  console.log("\n=== HTTP scan ===", baseUrl);
  let httpFails = [];
  try {
    httpFails = await scanHttp();
    if (httpFails.length) {
      httpFails.forEach((f) => console.log("FAIL", f.route, f.issue));
    } else {
      console.log("All routes pass HTTP checks.");
    }
  } catch (e) {
    console.log("HTTP scan skipped:", e.message);
    console.log("(Start dev server: npm run dev)");
  }

  const total = fileFails.length + httpFails.length;
  if (total) {
    console.log(`\n${total} issue(s) found.`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

main();
