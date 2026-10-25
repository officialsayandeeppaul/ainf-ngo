#!/usr/bin/env node
/**
 * Puts the project pages' AINF copy into the Framer modules that render them.
 *
 * The project pages run a second Framer export (public/framer-site-axinn)
 * whose modules still carry the template's copy ("Ostra Supporter",
 * "Introduction", ...). ainf-projects-theme.js rewrote it on timers after
 * Framer rendered, so the template copy flashed, and a slide that rendered
 * after the last timer kept it ("Volunteer at Ostra" stayed on the live site).
 * Rewriting it in the browser also replaced nodes React owns.
 *
 * This applies the same tables (PROJECT_COPY and rebrandCopy's map, read from
 * ainf-projects-theme.js so there is one source of truth) to the module
 * strings React renders: children, page metadata, and text props. Layer
 * names and the donation form's cause options (matched by title when a gift
 * is made) are left alone. Idempotent; run again after re-exporting.
 *
 *   node scripts/apply-project-copy-to-modules.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "public", "framer-site-axinn");
const THEME = path.join(ROOT, "public", "assets", "js", "ainf-projects-theme.js");
const dry = process.argv.includes("--dry");
// The cause <select> options: their titles are matched to donation targets.
const SKIP_FILES = new Set(["yBS1cJVfE.pAy0wLCi.mjs"]);

function table(source, name) {
  const start = source.indexOf(`var ${name} = [`);
  if (start < 0) throw new Error(`${name} not found in ainf-projects-theme.js`);
  let depth = 0;
  let end = start + `var ${name} = `.length;
  for (; end < source.length; end++) {
    if (source[end] === "[") depth++;
    else if (source[end] === "]" && --depth === 0) break;
  }
  return vm.runInNewContext(source.slice(start + `var ${name} = `.length, end + 1));
}

const theme = readFileSync(THEME, "utf8");
const exact = new Map();
for (const [from, to] of [...table(theme, "PROJECT_COPY"), ...table(theme, "TESTIMONIAL_COPY")]) {
  exact.set(from, to);
  exact.set(from.replace(/'/g, "’"), to);
}
const REBRAND = table(theme, "REBRAND_COPY");

// A plain literal React renders as text: element children, page metadata, or
// a component's text prop (Framer names those with 9-character ids). Matched
// from the property name, so template literals elsewhere never shift pairing.
const TEXT_SLOT = /(?<![\w"$])(children|title|description|[A-Za-z0-9_]{9}):`([^`$\\]*)`/g;

let total = 0;
for (const file of readdirSync(DIR).filter((f) => f.endsWith(".mjs") && !SKIP_FILES.has(f))) {
  const full = path.join(DIR, file);
  const source = readFileSync(full, "utf8");
  let changes = 0;
  const next = source.replace(TEXT_SLOT, (literal, key, text) => {
    let out = exact.has(text) ? exact.get(text) : text;
    for (const [from, to] of REBRAND) if (out.includes(from)) out = out.split(from).join(to);
    if (out === text) return literal;
    if (/[`$\\]/.test(out)) throw new Error(`${file}: replacement for "${text}" is not a plain literal`);
    changes++;
    return `${key}:\`${out}\``;
  });
  if (!changes) continue;
  total += changes;
  console.log(`${file}: ${changes} string(s)${dry ? " would change" : ""}`);
  if (!dry) writeFileSync(full, next);
}
console.log(`${total} string(s) ${dry ? "would change" : "updated"}.`);
