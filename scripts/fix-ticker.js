#!/usr/bin/env node
/**
 * SAFE ticker helpers — do NOT globally recolor ticker text.
 * The main ticker sits on a dark green band (white/lime text is correct).
 * Partner logo visibility is handled by fix-visibility-and-titles.js + mask encode.
 *
 * This file intentionally only ensures ticker <ul> opacity is 1 for SSR.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function walkRoutes(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkRoutes(p, out);
    else if (ent.name === "route.ts") out.push(p);
  }
  return out;
}

function extractRaw(source) {
  const marker = 'const HTML = "';
  const start = source.indexOf(marker);
  if (start < 0) return null;
  let i = start + marker.length;
  let html = "";
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\" && i + 1 < source.length) {
      html += ch + source[i + 1];
      i += 2;
      continue;
    }
    if (ch === '"') break;
    html += ch;
    i++;
  }
  return { end: i, html, markerAt: start };
}

function decodeOnce(raw) {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === "\\" && i + 1 < raw.length) {
      const n = raw[i + 1];
      const map = { n: "\n", t: "\t", r: "\r", '"': '"', "\\": "\\" };
      out += map[n] !== undefined ? map[n] : n;
      i += 2;
      continue;
    }
    out += raw[i];
    i++;
  }
  return out;
}

function decodeFully(raw) {
  let html = raw;
  for (let p = 0; p < 5; p++) {
    const next = decodeOnce(html);
    if (next === html) break;
    html = next;
  }
  return html;
}

function encodeJs(html) {
  return html
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

let n = 0;
for (const file of walkRoutes(path.join(ROOT, "app"))) {
  const source = fs.readFileSync(file, "utf8");
  const extracted = extractRaw(source);
  if (!extracted) continue;
  let html = decodeFully(extracted.html);
  if (!html.includes("ticker-item")) continue;
  const next = html.replace(
    /(<ul style="[^"]*?)opacity:0;([^"]*">\s*<li class="ticker-item")/g,
    "$1opacity:1;$2"
  );
  if (next === html) continue;
  let after = extracted.end + 1;
  while (source[after] === ";") after++;
  fs.writeFileSync(
    file,
    source.slice(0, extracted.markerAt) +
      `const HTML = "${encodeJs(next)}";` +
      source.slice(after)
  );
  n++;
  console.log("patched", path.relative(ROOT, file));
}
console.log(`Done: ${n} routes (ticker opacity only)`);
