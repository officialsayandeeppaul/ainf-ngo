#!/usr/bin/env node
// Find visible page strings missing from the i18n dictionary.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const dict = JSON.parse(fs.readFileSync(path.join(ROOT, "public/i18n/home-strings.json"), "utf8"));
const keys = new Set(Object.keys(dict.strings || {}));

function compact(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9\u0980-\u09FF\u0900-\u097F]+/gi, "");
}
const compactKeys = new Set([...keys].map(compact));

function decodeOnce(raw) {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1];
      if (next === "n") { out += "\n"; i += 2; continue; }
      if (next === "t") { out += "\t"; i += 2; continue; }
      if (next === "r") { out += "\r"; i += 2; continue; }
      if (next === '"') { out += '"'; i += 2; continue; }
      if (next === "\\") { out += "\\"; i += 2; continue; }
      out += next; i += 2; continue;
    }
    out += raw[i]; i++;
  }
  return out;
}
function extractHtml(source) {
  const marker = 'const HTML = "';
  const start = source.indexOf(marker);
  if (start < 0) return "";
  let i = start + marker.length;
  let raw = "";
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\" && i + 1 < source.length) { raw += ch + source[i + 1]; i += 2; continue; }
    if (ch === '"') break;
    raw += ch; i++;
  }
  let html = raw;
  for (let pass = 0; pass < 5; pass++) {
    const next = decodeOnce(html);
    if (next === html) break;
    html = next;
  }
  return html;
}
function textsFromHtml(html) {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|h4|li|div|section|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  return [
    ...new Set(
      stripped
        .split(/\n+/)
        .map((s) => s.replace(/\s+/g, " ").trim())
        .filter((s) => s.length >= 8 && s.length <= 360)
        .filter((s) => /[A-Za-z]/.test(s))
        .filter((s) => !/^https?:/.test(s))
        .filter((s) => !/framer|webpack|function|const |var /.test(s))
    ),
  ];
}
function covered(s) {
  if (keys.has(s)) return true;
  const c = compact(s);
  if (compactKeys.has(c)) return true;
  if (/^[\d,.\s+k%₹$]+$/i.test(s)) return true;
  if (/^(LinkedIn|Instagram|Facebook|Youtube|Menu|Home|Care|Help|Trust|Unity|Impact|X)$/i.test(s)) return true;
  return false;
}
function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name === "route.ts") acc.push(p);
  }
  return acc;
}
function routeKey(file) {
  const rel = path.relative(path.join(ROOT, "app"), file).replace(/\\/g, "/");
  if (rel === "route.ts") return "home";
  return rel.replace(/\/route.ts$/, "");
}

const report = {};
const missingAll = new Set();
for (const file of walk(path.join(ROOT, "app"))) {
  const key = routeKey(file);
  const html = extractHtml(fs.readFileSync(file, "utf8"));
  const texts = textsFromHtml(html);
  const missing = texts.filter((t) => !covered(t));
  const hasMotion = html.includes("ainf-motion.js");
  const hasI18n = html.includes("home-i18n.js");
  report[key] = {
    total: texts.length,
    missing: missing.length,
    coverage: texts.length ? Math.round((1 - missing.length / texts.length) * 100) : 100,
    hasMotion,
    hasI18n,
    samples: missing.slice(0, 18),
  };
  missing.forEach((t) => missingAll.add(t));
}

fs.writeFileSync(
  path.join(__dirname, "_i18n-coverage.json"),
  JSON.stringify({ report, missing: [...missingAll].sort((a, b) => b.length - a.length) }, null, 2),
  "utf8"
);
for (const [k, v] of Object.entries(report)) {
  console.log(
    (v.coverage >= 85 && v.hasMotion && v.hasI18n ? "OK " : "GAP") +
      " " +
      k.padEnd(48) +
      " cov=" +
      String(v.coverage).padStart(3) +
      "%  miss=" +
      v.missing +
      "/" +
      v.total +
      " motion=" +
      v.hasMotion
  );
}
console.log("\nunique missing strings:", missingAll.size);
