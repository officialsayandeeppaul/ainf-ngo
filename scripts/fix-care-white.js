#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "../app/route.ts");
const source = fs.readFileSync(file, "utf8");
const marker = 'const HTML = "';
const markerAt = source.indexOf(marker);
let i = markerAt + marker.length;
let raw = "";
while (i < source.length) {
  if (source[i] === "\\" && i + 1 < source.length) {
    raw += source[i] + source[i + 1];
    i += 2;
    continue;
  }
  if (source[i] === '"') break;
  raw += source[i];
  i++;
}
const end = i;

function decodeOnce(s) {
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
  const n = decodeOnce(html);
  if (n === html) break;
  html = n;
}

const before = html;
// Care ticker sits on dark green — restore white text (not forest green)
html = html.replace(
  /(data-framer-name="Care">[\s\S]{0,500}?--extracted-1of0zx5:)rgb\(15, 51, 43\)/g,
  "$1rgb(255, 255, 255)"
);
html = html.replace(
  /(data-framer-name="Care">[\s\S]{0,800}?--framer-text-color:)rgb\(15, 51, 43\)/g,
  "$1rgb(255, 255, 255)"
);

console.log("changed", html !== before);

if (html !== before) {
  const encoded = html
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  let after = end + 1;
  while (source[after] === ";") after++;
  fs.writeFileSync(
    file,
    source.slice(0, markerAt) + `const HTML = "${encoded}";` + source.slice(after)
  );
  console.log("wrote");
}
