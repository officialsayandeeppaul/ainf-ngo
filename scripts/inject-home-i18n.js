#!/usr/bin/env node
/**
 * Inject i18n CSS/JS into one or more route.ts files before </body>
 * Usage:
 *   node scripts/inject-home-i18n.js
 *   node scripts/inject-home-i18n.js app/contact-us/route.ts
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["app/route.ts", "app/contact-us/route.ts"];

const marker = 'const HTML = "';
const injectTag =
  '<link rel="stylesheet" href="/i18n/home-i18n.css">\\n<script src="/i18n/home-i18n.js" defer></script>';

function decodeOnce(raw) {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1];
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
    out += raw[i];
    i++;
  }
  return out;
}

function extractHtml(source) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("HTML marker not found");
  let i = start + marker.length;
  let raw = "";
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\" && i + 1 < source.length) {
      raw += ch + source[i + 1];
      i += 2;
      continue;
    }
    if (ch === '"') break;
    raw += ch;
    i++;
  }
  let html = raw;
  for (let pass = 0; pass < 5; pass++) {
    const next = decodeOnce(html);
    if (next === html) break;
    html = next;
  }
  return { start, end: i, html };
}

function escapeHtmlConst(html) {
  return html
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

for (const rel of targets) {
  const routePath = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  let src = fs.readFileSync(routePath, "utf8");
  if (src.includes("/i18n/home-i18n.js")) {
    console.log("Already injected:", rel);
    continue;
  }
  const extracted = extractHtml(src);
  if (!extracted.html.includes("</body>")) {
    throw new Error("</body> not found in " + rel);
  }
  const updatedHtml = extracted.html.replace("</body>", injectTag + "\n</body>");
  const escaped = escapeHtmlConst(updatedHtml);
  const before = src.slice(0, extracted.start + marker.length);
  const after = src.slice(extracted.end);
  fs.writeFileSync(routePath, before + escaped + after, "utf8");
  console.log("Injected i18n into", rel);
}
