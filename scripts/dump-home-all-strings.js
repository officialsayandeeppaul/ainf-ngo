#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const c = fs.readFileSync(
  path.join(__dirname, "../public/framer-site/rAZHDpIaBBj-J_uP4XFGvNpqSro10i1t2plhpKN6XFY.DBJAf7uS.mjs"),
  "utf8"
);
const all = new Set();
for (const re of [/children:`([^`\\]{2,500})`/g, /"([^"\\]{4,500})"/g, /'([^'\\]{4,500})'/g]) {
  let m;
  while ((m = re.exec(c))) {
    const s = m[1].trim();
    if (!/[A-Za-z]/.test(s)) continue;
    if (/framer|http|px|rgb|function|return|import/.test(s)) continue;
    if (s.length >= 4 && s.length <= 400) all.add(s);
  }
}
[...all].sort((a, b) => b.length - a.length).forEach((s) => console.log(s));
