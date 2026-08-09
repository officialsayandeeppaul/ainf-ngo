#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const files = [
  "public/framer-site/rAZHDpIaBBj-J_uP4XFGvNpqSro10i1t2plhpKN6XFY.DBJAf7uS.mjs",
  "public/framer-site/script_main.DRLdLDGq.mjs",
  "public/framer-site/ZXEP0rDls.C9ivg-A9.mjs",
  "public/framer-site/cX38IGytl.DM_i4mPj.mjs",
];

const all = new Set();
for (const f of files) {
  const c = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  const re = /children:`([^`\\]{2,500})`/g;
  let m;
  while ((m = re.exec(c))) {
    const s = m[1].trim();
    if (/[A-Za-z\u0900-\u097F]/.test(s)) all.add(s);
  }
}

const sorted = [...all].sort((a, b) => b.length - a.length);
fs.writeFileSync(path.join(__dirname, "_home-children-strings.json"), JSON.stringify(sorted, null, 2));
console.log("count", sorted.length);
sorted.forEach((s) => console.log(s));
