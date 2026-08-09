const fs = require("fs");

function decodeFile(file) {
  const source = fs.readFileSync(file, "utf8");
  let i = source.indexOf('const HTML = "') + 14;
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
  let html = raw;
  for (let p = 0; p < 5; p++) {
    let out = "";
    for (let j = 0; j < html.length; ) {
      if (html[j] === "\\" && j + 1 < html.length) {
        const n = html[j + 1];
        const map = { n: "\n", t: "\t", r: "\r", '"': '"', "\\": "\\" };
        if (map[n] !== undefined) {
          out += map[n];
          j += 2;
          continue;
        }
        out += n;
        j += 2;
        continue;
      }
      out += html[j++];
    }
    if (out === html) break;
    html = out;
  }
  return html;
}

const html = decodeFile("app/route.ts");
const clients = [
  "framer-QjkBf",
  "framer-qr9MR",
  "framer-77x8p",
  "framer-iSUpc",
  "framer-hamxx",
];

for (const cls of clients) {
  const re = new RegExp(`\\.${cls}\\{[^}]+\\}`);
  const m = html.match(re);
  if (!m) {
    console.log(cls, "NO CSS");
    continue;
  }
  const rule = m[0];
  const hasSingle = /url\('data:image\/svg\+xml/.test(rule);
  const hasBroken = /url\("data:image\/svg\+xml,<svg display="/.test(rule);
  const hasBg = /background-color/.test(rule);
  const hasMask = /-webkit-mask:url/.test(rule);
  console.log(cls, { hasSingle, hasBroken, hasBg, hasMask, len: rule.length });
  console.log("  ", rule.slice(0, 180).replace(/\s+/g, " "));
}
