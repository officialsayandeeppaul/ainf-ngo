#!/usr/bin/env node
/**
 * Make CSS icon masks actually paint:
 * 1. encodeURIComponent SVG bodies (reliable data-URIs)
 * 2. Convert invalid <g d="..."> to <path d="...">
 * Applied to all route.ts HTML consts + framer-site .mjs files.
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
  return { start: start + marker.length, end: i, html, markerAt: start };
}

function decodeOnce(raw) {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === "\\" && i + 1 < raw.length) {
      const n = raw[i + 1];
      if (n === "n") {
        out += "\n";
        i += 2;
        continue;
      }
      if (n === "t") {
        out += "\t";
        i += 2;
        continue;
      }
      if (n === "r") {
        out += "\r";
        i += 2;
        continue;
      }
      if (n === '"') {
        out += '"';
        i += 2;
        continue;
      }
      if (n === "\\") {
        out += "\\";
        i += 2;
        continue;
      }
      out += n;
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

function normalizeSvgForMask(svg) {
  let out = svg;
  // CSS variables do not resolve inside SVG-as-mask data URIs → invalid fill → gray boxes.
  // Keep only the fallback color from var(--token-..., FALLBACK). Use non-greedy so
  // rgba(...) closers are not swallowed into the capture.
  out = out.replace(/fill="var\(--[^,]+,\s*(.+?)\)"/g, 'fill="$1"');
  out = out.replace(/stroke="var\(--[^,]+,\s*(.+?)\)"/g, 'stroke="$1"');
  // Repair prior buggy captures that left an extra ')'
  out = out.replace(/fill="(rgba?\([^"]+\))\)"/g, 'fill="$1"');
  out = out.replace(/stroke="(rgba?\([^"]+\))\)"/g, 'stroke="$1"');
  // Any remaining unresolved var() → solid dark (visible mask)
  out = out.replace(/fill="var\([^"]+\)"/g, 'fill="rgb(34,34,34)"');
  out = out.replace(/stroke="var\([^"]+\)"/g, 'stroke="rgb(34,34,34)"');
  out = out.replace(/fill="transparent"/g, 'fill="none"');
  // Semi-transparent fills look like gray smudges in masks — use solid
  out = out.replace(/fill="rgba\(34,\s*34,\s*34,\s*0\.5\)"/g, 'fill="rgb(34,34,34)"');
  return out;
}

function fixMaskUrls(text) {
  let count = 0;
  // Match both quote styles around data URIs containing inline SVG
  const out = text.replace(
    /url\((['"])data:image\/svg\+xml,(?:utf8,|charset=utf-8,)?([\s\S]*?)\1\)/g,
    (full, quote, body) => {
      // Only touch SVG bodies
      let svg = body;
      // If already percent-encoded, decode first
      if (svg.includes("%3C") || svg.includes("%3c")) {
        try {
          svg = decodeURIComponent(svg);
        } catch {
          return full;
        }
      }
      if (!svg.includes("<svg")) return full;
      // Trim to svg element if trailing junk
      const start = svg.indexOf("<svg");
      const end = svg.lastIndexOf("</svg>");
      if (start < 0 || end < 0) return full;
      svg = svg.slice(start, end + "</svg>".length);
      svg = normalizeSvgForMask(svg);
      const encoded = encodeURIComponent(svg);
      count++;
      // Double-quoted URL is fine once body is fully encoded
      return `url("data:image/svg+xml,${encoded}")`;
    }
  );
  return { text: out, count };
}

function fixLogo(html) {
  const LOGO_INNER = `id="svg-136069397_6312" role="img" aria-label="theainf — All Indian Nevarlands Foundation"><circle cx="14.2" cy="14.94" r="12.2" fill="none" stroke="var(--token-7e762acf-8506-4626-8fd0-26eadf01dbe6, rgb(15, 51, 43))" stroke-width="2.1"></circle><path d="M14.2 3.2 A11.7 11.7 0 0 1 25.4 18.5" fill="none" stroke="var(--token-e3f77d53-9b12-48ea-9c29-327ba647a7e2, rgb(201, 132, 42))" stroke-width="2.1" stroke-linecap="round"></path><path d="M14.2 5.2 L16.1 8.1 L14.2 7.4 L12.3 8.1 Z" fill="var(--token-7e762acf-8506-4626-8fd0-26eadf01dbe6, rgb(15, 51, 43))"></path><path d="M14.2 22.8 C14.2 20.6 15.6 19.2 17.2 18.8 C15.5 19.6 14.6 21.2 14.2 22.8 C13.8 21.2 12.9 19.6 11.2 18.8 C12.8 19.2 14.2 20.6 14.2 22.8 Z" fill="var(--token-e3f77d53-9b12-48ea-9c29-327ba647a7e2, rgb(47, 107, 85))"></path><path d="M12.4 23.4 Q14.2 24.2 16 23.4" fill="none" stroke="var(--token-7e762acf-8506-4626-8fd0-26eadf01dbe6, rgb(15, 51, 43))" stroke-width="1.2" stroke-linecap="round"></path><text x="33.5" y="19.6" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="15.5" font-weight="700" letter-spacing="-0.4" fill="var(--token-7e762acf-8506-4626-8fd0-26eadf01dbe6, rgb(34, 34, 34))">theainf</text><text x="101.5" y="19.2" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="7.2" font-weight="600" letter-spacing="0.8" fill="var(--token-e3f77d53-9b12-48ea-9c29-327ba647a7e2, rgb(201, 132, 42))">AINF</text>`;
  return html.replace(
    /<svg[^>]*id="svg-136069397_6312"[\s\S]*?<\/svg>/g,
    `<svg ${LOGO_INNER}</svg>`
  );
}

let routeCount = 0;
let maskTotal = 0;
for (const file of walkRoutes(path.join(ROOT, "app"))) {
  const source = fs.readFileSync(file, "utf8");
  const extracted = extractRaw(source);
  if (!extracted) continue;
  let html = decodeFully(extracted.html);
  html = fixLogo(html);
  const { text, count } = fixMaskUrls(html);
  html = text;
  maskTotal += count;
  let after = extracted.end + 1;
  while (source[after] === ";") after++;
  const rebuilt =
    source.slice(0, extracted.markerAt) +
    `const HTML = "${encodeJs(html)}";` +
    source.slice(after);
  if (rebuilt !== source) {
    fs.writeFileSync(file, rebuilt, "utf8");
    routeCount++;
    console.log("patched route", path.relative(ROOT, file), "masks", count);
  }
}

let jsCount = 0;
const framerDir = path.join(ROOT, "public/framer-site");
for (const name of fs.readdirSync(framerDir)) {
  if (!name.endsWith(".mjs") || name === "init.mjs") continue;
  const fp = path.join(framerDir, name);
  let t = fs.readFileSync(fp, "utf8");
  const { text, count } = fixMaskUrls(t);
  if (count > 0 && text !== t) {
    fs.writeFileSync(fp, text, "utf8");
    jsCount++;
    maskTotal += count;
    console.log("patched js", name, "masks", count);
  }
}

console.log(
  `\nDone: ${routeCount} routes, ${jsCount} JS files, ${maskTotal} masks encoded.`
);
