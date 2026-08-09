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
  function dec(s) {
    let o = "",
      j = 0;
    while (j < s.length) {
      if (s[j] === "\\" && j + 1 < s.length) {
        const n = s[j + 1];
        const map = { n: "\n", t: "\t", r: "\r", '"': '"', "\\": "\\" };
        o += map[n] !== undefined ? map[n] : n;
        j += 2;
        continue;
      }
      o += s[j];
      j++;
    }
    return o;
  }
  let html = raw;
  for (let p = 0; p < 5; p++) {
    const n = dec(html);
    if (n === html) break;
    html = n;
  }
  return html;
}

const b = load(path.join(__dirname, "../app/route.ts.hopper-backup"));
const h = load(path.join(__dirname, "../app/route.ts"));

for (const word of ["Care", "Impact", "Trust"]) {
  const bi = b.indexOf(`data-framer-name="${word}"`);
  const hi = h.indexOf(`data-framer-name="${word}"`);
  console.log("\n===", word, "===");
  console.log("BACKUP:", b.slice(bi - 80, bi + 280).replace(/\s+/g, " "));
  console.log("HOME:  ", h.slice(hi - 80, hi + 280).replace(/\s+/g, " "));
}
