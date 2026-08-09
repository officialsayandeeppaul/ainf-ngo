#!/usr/bin/env node
/**
 * Restore ticker-item h2 text eaten by greedy color regex.
 * Pattern: <h2 ...style="..."> IMMEDIATELY followed by <div (next item)
 * instead of Word</h2></div></div></li>
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

function fixTickerWords(html) {
  let fixes = 0;
  // data-framer-name="WORD"><div ...><h2 ...>XXX  where XXX is not WORD
  // Restore: ...><h2 ...>WORD</h2></div></div></li>
  const out = html.replace(
    /data-framer-name="(Care|Impact|Trust|Hope|Community|Love|Faith|Peace)"><div class="([^"]+)" data-framer-component-type="RichTextContainer" style="([^"]*)"><h2 class="framer-text framer-styles-preset-t1x6v6"([^>]*)>(?!<)/g,
    (full, word, cls, style, h2rest) => {
      // Only fix if h2 does not already start with the word
      fixes++;
      // Clean broken styles that absorbed flex/position from next li
      let cleanStyle = style
        .replace(/;flex-shrink:0;position:relative;height:fit-content;width:fit-content;transform:none/, "")
        .replace(/;opacity:0;transform:translateY\([^)]+\)/, "");
      let cleanH2 = h2rest
        .replace(
          /style="([^"]*?);flex-shrink:0;position:relative;height:fit-content;width:fit-content;transform:none"/,
          'style="$1"'
        )
        .replace(
          /style="([^"]*?);opacity:0;transform:translateY\([^)]+\)"/,
          'style="$1"'
        );
      return `data-framer-name="${word}"><div class="${cls}" data-framer-component-type="RichTextContainer" style="${cleanStyle}"><h2 class="framer-text framer-styles-preset-t1x6v6"${cleanH2}>${word}</h2></div></div></li>`;
    }
  );
  return { html: out, fixes };
}

let n = 0;
let total = 0;
for (const file of walkRoutes(path.join(ROOT, "app"))) {
  const source = fs.readFileSync(file, "utf8");
  const extracted = extractRaw(source);
  if (!extracted) continue;
  let html = decodeFully(extracted.html);
  if (!html.includes("ticker-item")) continue;
  const { html: fixed, fixes } = fixTickerWords(html);
  if (!fixes) continue;
  let after = extracted.end + 1;
  while (source[after] === ";") after++;
  const rebuilt =
    source.slice(0, extracted.markerAt) +
    `const HTML = "${encodeJs(fixed)}";` +
    source.slice(after);
  fs.writeFileSync(file, rebuilt, "utf8");
  n++;
  total += fixes;
  console.log("patched", path.relative(ROOT, file), "fixes", fixes);
}
console.log(`\nDone: ${n} routes, ${total} ticker words restored`);
