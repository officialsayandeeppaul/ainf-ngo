#!/usr/bin/env node
/**
 * Normalize route.ts HTML string escapes to a single correct level.
 * Safe to run repeatedly. Used after apply-ainf-content.js.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
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
  return { start: start + marker.length, end: i, html };
}

function decodeJsStringBody(raw) {
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

function scrubGarbageTextNodes(html) {
  // NEVER touch single-letter spans (>n<, >t<) — Framer animates H1s letter-by-letter.
  // Only remove clear banner garbage like "ntntnt" / "n n n n".
  html = html.replace(/>([nt\\\s]{2,})</g, (full, text) => {
    if (!/^[nt\\\s]+$/.test(text)) return full;
    if (text === "n" || text === "t" || text === "nt" || text === "tn") {
      return full;
    }
    // Must look like repeated escape garbage
    if (!/(nt){2,}/.test(text) && !/(n[\s]*){3,}/.test(text)) return full;
    return ">\n\t<";
  });
  html = html.replace(/(<body[^>]*>)([\\nt\s]{2,})/g, (full, open, junk) => {
    if (!/^[\\nt\s]+$/.test(junk)) return full;
    if (!/(nt){2,}|n{2,}|\\n/.test(junk)) return full;
    return open + "\n\t";
  });
  return html;
}

function encodeJsStringBody(html) {
  return html
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function repairAllRoutes() {
  let total = 0;
  for (const file of walk(path.join(ROOT, "app"))) {
    const source = fs.readFileSync(file, "utf8");
    const extracted = extractRaw(source);
    if (!extracted) continue;

    let decoded = extracted.html;
    for (let pass = 0; pass < 5; pass++) {
      const next = decodeJsStringBody(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    decoded = scrubGarbageTextNodes(decoded);
    const encoded = encodeJsStringBody(decoded);
    if (encoded === extracted.html) continue;

    fs.writeFileSync(
      file,
      source.slice(0, extracted.start) + encoded + source.slice(extracted.end),
      "utf8"
    );
    total++;
    console.log("repaired:", path.relative(ROOT, file));
  }
  return total;
}

if (require.main === module) {
  const n = repairAllRoutes();
  console.log(`\nRepaired ${n} route file(s).`);
}

module.exports = { repairAllRoutes };
