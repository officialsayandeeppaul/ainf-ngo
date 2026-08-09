#!/usr/bin/env node
const http = require("http");
const fs = require("fs");
const path = require("path");

function get(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      })
      .on("error", reject);
  });
}

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

(async () => {
  const home = load(path.join(__dirname, "../app/route.ts"));
  const backup = load(path.join(__dirname, "../app/route.ts.hopper-backup"));

  const hi = home.indexOf('data-framer-name="Care"');
  const bi = backup.indexOf('data-framer-name="Care"');
  console.log("HOME Care block:");
  console.log(home.slice(hi, hi + 600).replace(/\s+/g, " "));
  console.log("\nBACKUP Care block:");
  console.log(backup.slice(bi, bi + 600).replace(/\s+/g, " "));

  // Count barcode dividers vs text ticker items
  console.log("\nhome divider symbol count", (home.match(/svg-410406973_253/g) || []).length);
  console.log("backup divider", (backup.match(/svg-410406973_253/g) || []).length);
})();
