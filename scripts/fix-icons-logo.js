#!/usr/bin/env node
/**
 * Fix visible UI issues:
 * 1. Restore theainf logo SVG (replaces Hopper clover symbol)
 * 2. Fix arrow icon SVGs (white-on-light → dark green)
 * 3. Fix broken CSS mask data-URIs (unescaped quotes) so Framer icons paint
 * 4. Patch remaining Hopper mid-section copy
 * Applied to all app route.ts HTML consts + key assets.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const LOGO_INNER = `id="svg-136069397_6312" role="img" aria-label="theainf — All Indian Nevarlands Foundation"><circle cx="14.2" cy="14.94" r="12.2" fill="none" stroke="var(--token-7e762acf-8506-4626-8fd0-26eadf01dbe6, rgb(15, 51, 43))" stroke-width="2.1"></circle><path d="M14.2 3.2 A11.7 11.7 0 0 1 25.4 18.5" fill="none" stroke="var(--token-e3f77d53-9b12-48ea-9c29-327ba647a7e2, rgb(201, 132, 42))" stroke-width="2.1" stroke-linecap="round"></path><path d="M14.2 5.2 L16.1 8.1 L14.2 7.4 L12.3 8.1 Z" fill="var(--token-7e762acf-8506-4626-8fd0-26eadf01dbe6, rgb(15, 51, 43))"></path><path d="M14.2 22.8 C14.2 20.6 15.6 19.2 17.2 18.8 C15.5 19.6 14.6 21.2 14.2 22.8 C13.8 21.2 12.9 19.6 11.2 18.8 C12.8 19.2 14.2 20.6 14.2 22.8 Z" fill="var(--token-e3f77d53-9b12-48ea-9c29-327ba647a7e2, rgb(47, 107, 85))"></path><path d="M12.4 23.4 Q14.2 24.2 16 23.4" fill="none" stroke="var(--token-7e762acf-8506-4626-8fd0-26eadf01dbe6, rgb(15, 51, 43))" stroke-width="1.2" stroke-linecap="round"></path><text x="33.5" y="19.6" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="15.5" font-weight="700" letter-spacing="-0.4" fill="var(--token-7e762acf-8506-4626-8fd0-26eadf01dbe6, rgb(34, 34, 34))">theainf</text><text x="101.5" y="19.2" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="7.2" font-weight="600" letter-spacing="0.8" fill="var(--token-e3f77d53-9b12-48ea-9c29-327ba647a7e2, rgb(201, 132, 42))">AINF</text>`;

const CONTENT = [
  [
    "Your Support Can<br class=\"framer-text\">Save Lives Today",
    "One Signature Can<br class=\"framer-text\">Change a Student's Path",
  ],
  [
    "Your Support CanSave Lives Today",
    "One Signature Can Change a Student's Path",
  ],
  [
    "Your Support Can\nSave Lives Today",
    "One Signature Can\nChange a Student's Path",
  ],
  [
    "Born in Jharkhand. Active wherever a student needs coaching, a youth needs skill, or a family needs a fair chance.",
    "Registered in Jharkhand, active across West Bengal — wherever a student needs coaching, a youth needs skills, or a family needs a fair chance.",
  ],
  [
    "Giving living access to safe homes &amp; future",
    "Coaching, skills &amp; fair chances for youth across Jharkhand &amp; West Bengal",
  ],
  [
    "Giving living access to safe homes & future",
    "Coaching, skills & fair chances for youth across Jharkhand & West Bengal",
  ],
];

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

function fixLogo(html) {
  return html.replace(
    /<svg[^>]*id="svg-136069397_6312"[\s\S]*?<\/svg>/g,
    `<svg ${LOGO_INNER}</svg>`
  );
}

function fixCssMasks(html) {
  // Convert url("data:image/svg+xml,<svg ...>") with nested " to url('data:...')
  // Match -webkit-mask / mask url("data:image/svg+xml,<svg ... </svg>")
  return html.replace(
    /url\("data:image\/svg\+xml,(<svg[\s\S]*?<\/svg>)"\)/g,
    (full, svg) => {
      // If svg contains double quotes, wrap with single quotes
      if (svg.includes('"')) {
        return `url('data:image/svg+xml,${svg}')`;
      }
      return full;
    }
  );
}

function fixContent(html) {
  let out = html;
  for (const [from, to] of CONTENT) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  return out;
}

function fixHtml(html) {
  let out = html;
  out = fixLogo(out);
  out = fixCssMasks(out);
  out = fixContent(out);
  return out;
}

// Fix arrow SVG assets
const arrowLeft = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><path fill="none" stroke="rgb(15, 51, 43)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M22.5 12.5 15 20l7.5 7.5"/></svg>`;
const arrowRight = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><path fill="none" stroke="rgb(15, 51, 43)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.5 12.5 25 20l-7.5 7.5"/></svg>`;
fs.writeFileSync(
  path.join(ROOT, "public/assets/img/de9d52a631a7d47c.svg"),
  arrowLeft
);
fs.writeFileSync(
  path.join(ROOT, "public/assets/img/0db50e6c503dba05.svg"),
  arrowRight
);
console.log("Fixed arrow SVG assets");

let n = 0;
for (const file of walk(path.join(ROOT, "app"))) {
  const source = fs.readFileSync(file, "utf8");
  const extracted = extractRaw(source);
  if (!extracted) continue;
  const decoded = decodeFully(extracted.html);
  const fixed = fixHtml(decoded);
  if (fixed === decoded) continue;
  let after = extracted.end + 1;
  while (source[after] === ";") after++;
  const newSource =
    source.slice(0, extracted.start - 'const HTML = "'.length) +
    `const HTML = "${encodeJs(fixed)}";` +
    source.slice(after);
  // Wait - extracted.start is AFTER the opening quote. Fix:
  // Actually extractRaw returns start at content begin. So:
  const marker = 'const HTML = "';
  const markerAt = source.indexOf(marker);
  const rebuilt =
    source.slice(0, markerAt) +
    `const HTML = "${encodeJs(fixed)}";` +
    source.slice(after);
  fs.writeFileSync(file, rebuilt, "utf8");
  n++;
  console.log("patched", path.relative(ROOT, file));
}

// Also patch JS chunks for mid-section Hopper strings + logo if present
const jsFixes = [
  ...CONTENT,
  ["Driven by Purpose", "From Education to Employment"],
  ["Powered by People", "Opportunity for Every Youth"],
  ["Save Lives Today", "Change a Student's Path"],
  ["Your Support Can", "One Signature Can"],
];
const framerDir = path.join(ROOT, "public/framer-site");
let jn = 0;
for (const name of fs.readdirSync(framerDir)) {
  if (!name.endsWith(".mjs")) continue;
  if (name === "init.mjs") continue;
  const fp = path.join(framerDir, name);
  let t = fs.readFileSync(fp, "utf8");
  const orig = t;
  for (const [from, to] of jsFixes) {
    if (t.includes(from)) t = t.split(from).join(to);
  }
  if (t !== orig) {
    fs.writeFileSync(fp, t, "utf8");
    jn++;
    console.log("patched js", name);
  }
}

console.log(`\nDone: ${n} routes, ${jn} JS files, arrows fixed.`);
