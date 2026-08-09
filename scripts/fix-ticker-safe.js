#!/usr/bin/env node
/**
 * SAFE ticker text contrast fix — never span across ticker-item boundaries.
 * Only rewrites white color tokens that appear inside a single ticker-item block.
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

function fixTickerItem(block) {
  let out = block;
  // Only touch white text tokens inside this one item
  out = out.replace(
    /--framer-text-color:var\(--extracted-[^,]+,\s*var\(--token-f5feb66a-7605-4f06-9d18-7ae0ebf35c2b,\s*rgb\(255,\s*255,\s*255\)\)\)/g,
    "--framer-text-color:rgb(15, 51, 43)"
  );
  out = out.replace(
    /--extracted-[a-z0-9]+:var\(--token-f5feb66a-7605-4f06-9d18-7ae0ebf35c2b,\s*rgb\(255,\s*255,\s*255\)\)/g,
    (m) => m.replace(/var\(--token-f5feb66a-7605-4f06-9d18-7ae0ebf35c2b,\s*rgb\(255,\s*255,\s*255\)\)/, "rgb(15, 51, 43)")
  );
  out = out.replace(/rgb\(255,\s*255,\s*255\)/g, "rgb(15, 51, 43)");
  return out;
}

function fixTicker(html) {
  let count = 0;
  const out = html.replace(
    /<li class="ticker-item"[^>]*>[\s\S]*?<\/li>/g,
    (block) => {
      // Skip image-only ticker cards (no h2 text words)
      if (!/>Care<|>Impact<|>Trust<|>Hope<|>Community</.test(block) && !/framer-text-color/.test(block)) {
        return block;
      }
      // Cap size — real text items are small; huge blocks mean nested damage
      if (block.length > 5000) return block;
      count++;
      return fixTickerItem(block);
    }
  );
  return { html: out, count };
}

// Disable the dangerous version by overwriting fix-ticker.js behavior note:
// This file is the safe replacement entrypoint.

let n = 0;
let items = 0;
for (const file of walkRoutes(path.join(ROOT, "app"))) {
  const source = fs.readFileSync(file, "utf8");
  const extracted = extractRaw(source);
  if (!extracted) continue;
  const decoded = decodeFully(extracted.html);
  if (!decoded.includes("ticker-item")) continue;
  const { html, count } = fixTicker(decoded);
  if (html === decoded) continue;
  let after = extracted.end + 1;
  while (source[after] === ";") after++;
  const rebuilt =
    source.slice(0, extracted.markerAt) +
    `const HTML = "${encodeJs(html)}";` +
    source.slice(after);
  fs.writeFileSync(file, rebuilt, "utf8");
  n++;
  items += count;
  console.log("patched", path.relative(ROOT, file), "items", count);
}
console.log(`\nDone: ${n} routes, ${items} ticker items`);
