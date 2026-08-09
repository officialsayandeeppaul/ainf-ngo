#!/usr/bin/env node
/**
 * Surgical restore of Care ticker word (and similar) eaten into next item.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const file = path.join(ROOT, "app/route.ts");
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
// Care h2 body eaten; next Impact div starts inside h2
html = html.replace(
  /(data-framer-name="Care"><div class="framer-1niy3h3" data-framer-component-type="RichTextContainer" style=")([^"]*)("><h2 class="framer-text framer-styles-preset-t1x6v6" data-styles-preset="UNTVxhuSg" dir="auto" style=")([^"]*)(">)(\s*)<div class="framer-viulp0" data-framer-name="Impact"/g,
  (
    _full,
    a,
    careStyle,
    b,
    h2style,
    c
  ) => {
    const cleanH2 = h2style
      .replace(
        /;flex-shrink:0;position:relative;height:fit-content;width:fit-content;transform:none/g,
        ""
      )
      .replace(/;opacity:0;transform:translateY\([^)]+\)/g, "");
    return `${a}${careStyle}${b}${cleanH2}${c}Care</h2></div></div></li><li class="ticker-item" aria-hidden="false" aria-posinset="2" aria-setsize="5" style="flex-grow:0;flex-shrink:0;position:relative;height:fit-content;width:fit-content;transform:none"><div class="framer-viulp0" data-framer-name="Impact"`;
  }
);

console.log("changed?", html !== before);
console.log("Care plain count", (html.match(/>Care</g) || []).length);

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
  console.log("wrote app/route.ts");
}
