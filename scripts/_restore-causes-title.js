#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function load(file) {
  const src = fs.readFileSync(file, "utf8");
  const marker = 'const HTML = "';
  const start = src.indexOf(marker) + marker.length;
  let i = start;
  let raw = "";
  while (i < src.length) {
    if (src[i] === "\\" && i + 1 < src.length) {
      raw += src[i] + src[i + 1];
      i += 2;
      continue;
    }
    if (src[i] === '"') break;
    raw += src[i];
    i++;
  }
  function decodeOnce(s) {
    let out = "";
    let j = 0;
    while (j < s.length) {
      if (s[j] === "\\" && j + 1 < s.length) {
        const n = s[j + 1];
        const map = { n: "\n", t: "\t", r: "\r", '"': '"', "\\": "\\" };
        out += map[n] !== undefined ? map[n] : n;
        j += 2;
        continue;
      }
      out += s[j];
      j++;
    }
    return out;
  }
  let html = raw;
  for (let p = 0; p < 5; p++) {
    const next = decodeOnce(html);
    if (next === html) break;
    html = next;
  }
  return html;
}

const home = load(path.join(__dirname, "../app/route.ts"));
const backup = load(path.join(__dirname, "../app/route.ts.hopper-backup"));

// Find Our Causes block in backup
const bIdx = backup.indexOf(">Our Causes<");
console.log("backup Our Causes at", bIdx);
console.log(backup.slice(bIdx - 400, bIdx + 200).replace(/\s+/g, " "));

// Find Causes Section in backup
const cs = backup.indexOf('data-framer-name="Causes Section"');
console.log("\nbackup Causes Section at", cs);
console.log(backup.slice(cs, cs + 500).replace(/\s+/g, " "));

// In home, find nearby content - search for empower communities (subtitle)
const sub = "empower communities through education";
const hIdx = home.indexOf(sub);
const bSub = backup.indexOf(sub);
console.log("\nhome subtitle at", hIdx, "backup", bSub);
console.log("\nHOME context before subtitle:");
console.log(home.slice(hIdx - 800, hIdx).replace(/\s+/g, " ").slice(-700));
console.log("\nBACKUP context before subtitle:");
console.log(backup.slice(bSub - 800, bSub).replace(/\s+/g, " ").slice(-700));

// Inline opacity on 1ss76od elements
const re = /class="[^"]*framer-1ss76od[^"]*"[^>]*>/g;
let m;
let n = 0;
while ((m = re.exec(home)) && n < 3) {
  console.log("\nhome 1ss76od tag:", m[0]);
  n++;
}

// style attribute opacity:0 near logo classes
const logoParent = home.indexOf("framer-QjkBf");
// find preceding opacity:0 in a style within 2000 chars before a use of the class in HTML (not CSS)
const htmlPart = home.slice(home.indexOf("<body"));
const qi = htmlPart.indexOf('class="framer-QjkBf');
console.log("\nQjkBf in body at", qi);
console.log(htmlPart.slice(qi - 500, qi + 100).replace(/\s+/g, " "));
