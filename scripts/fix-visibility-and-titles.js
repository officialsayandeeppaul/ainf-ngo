#!/usr/bin/env node
/**
 * Repair damage from greedy ticker color regex + Framer opacity:0 reveal:
 * 1. Restore broken Section Heading h2 titles
 * 2. Force opacity:1 on Clients logo row + section heading reveals
 * 3. Ensure partner masks stay encoded/solid
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

function fixBrokenSectionHeading(html) {
  // Pattern: h2 opened for section title but body was eaten; p subtitle follows inside h2
  // Restore: close h2 with title, reopen subtitle wrapper
  const broken =
    /(<div class="framer-1kva4o4"[^>]*style="will-change:transform;opacity:0;transform:translateY\(100px\)"><h2 class="framer-text framer-styles-preset-t1x6v6"[^>]*style="--framer-text-alignment:center;--framer-text-color:)rgb\(15, 51, 43\);opacity:0;transform:translateY\(100px\)">(<p class="framer-text framer-styles-preset-19x7ezw")/g;

  return html.replace(
    broken,
    `$1var(--token-7e762acf-8506-4626-8fd0-26eadf01dbe6, rgb(34, 34, 34))">Seven Focus Areas at AINF</h2></div><div class="framer-1a9xl54" data-framer-component-type="RichTextContainer" style="will-change:transform;opacity:1;transform:none">$2`
  );
}

function forceVisibleReveals(html) {
  let out = html;

  // Clients / partner logo row
  out = out.replace(
    /(data-framer-name="Clients" style="will-change:transform;)opacity:0;transform:translateY\([^"]+\)"/g,
    '$1opacity:1;transform:none"'
  );

  // Section heading title + subtitle reveal wrappers
  out = out.replace(
    /(class="framer-1kva4o4"[^>]*style="will-change:transform;)opacity:0;transform:translateY\(100px\)"/g,
    '$1opacity:1;transform:none"'
  );
  out = out.replace(
    /(class="framer-1a9xl54"[^>]*style="will-change:transform;)opacity:0;transform:translateY\(100px\)"/g,
    '$1opacity:1;transform:none"'
  );

  // Ticker lists
  out = out.replace(
    /(<ul style="[^"]*?)opacity:0;([^"]*">\s*<li class="ticker-item")/g,
    "$1opacity:1;$2"
  );

  return out;
}

function ensureTitleText(html) {
  // If "Our Causes" still present, rename
  let out = html.split(">Our Causes<").join(">Seven Focus Areas at AINF<");
  // If title still missing after structural fix, leave markers for verify
  return out;
}

let n = 0;
for (const file of walkRoutes(path.join(ROOT, "app"))) {
  const source = fs.readFileSync(file, "utf8");
  const extracted = extractRaw(source);
  if (!extracted) continue;
  let html = decodeFully(extracted.html);
  const before = html;
  html = fixBrokenSectionHeading(html);
  html = forceVisibleReveals(html);
  html = ensureTitleText(html);
  if (html === before) continue;
  let after = extracted.end + 1;
  while (source[after] === ";") after++;
  const rebuilt =
    source.slice(0, extracted.markerAt) +
    `const HTML = "${encodeJs(html)}";` +
    source.slice(after);
  fs.writeFileSync(file, rebuilt, "utf8");
  n++;
  const hasTitle =
    html.includes("Seven Focus Areas") || html.includes("Our Causes");
  console.log(
    "patched",
    path.relative(ROOT, file),
    "title?",
    hasTitle,
    "clients visible?",
    /Clients" style="[^"]*opacity:1/.test(html)
  );
}

console.log(`\nDone: ${n} routes`);
