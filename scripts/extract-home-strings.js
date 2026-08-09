#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const homeMjs = path.join(
  ROOT,
  "public/framer-site/rAZHDpIaBBj-J_uP4XFGvNpqSro10i1t2plhpKN6XFY.DBJAf7uS.mjs"
);
const scriptMain = path.join(ROOT, "public/framer-site/script_main.DRLdLDGq.mjs");
const faqMjs = path.join(ROOT, "public/framer-site/ZXEP0rDls.C9ivg-A9.mjs");
const formMjs = path.join(ROOT, "public/framer-site/cX38IGytl.DM_i4mPj.mjs");

function extractStrings(content) {
  const strings = new Set();
  const re = /`([^`\\]{3,500})`/g;
  let m;
  while ((m = re.exec(content))) {
    const s = m[1].trim();
    if (/^[a-zA-Z0-9_\-/.]+$/.test(s)) continue;
    if (s.includes("framer") || s.includes("http") || s.includes("px")) continue;
    if (/^[\d\s+,.%$]+$/.test(s)) continue;
    if (s.length >= 3) strings.add(s);
  }
  return strings;
}

const all = new Set();
for (const f of [homeMjs, scriptMain, faqMjs, formMjs]) {
  if (!fs.existsSync(f)) continue;
  const c = fs.readFileSync(f, "utf8");
  for (const s of extractStrings(c)) all.add(s);
}

const sorted = [...all].sort((a, b) => b.length - a.length);
fs.writeFileSync(
  path.join(__dirname, "_home-strings-extracted.json"),
  JSON.stringify(sorted, null, 2),
  "utf8"
);
console.log("count", sorted.length);
sorted.filter((s) => /[A-Za-z]/.test(s)).slice(0, 50).forEach((s) => console.log(s));
