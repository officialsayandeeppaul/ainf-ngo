const fs = require("fs");
const http = require("http");

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

// Find all data-framer-name containing Image
const names = [...html.matchAll(/data-framer-name="([^"]*Image[^"]*)"/g)].map((m) => m[1]);
console.log("Image names", [...new Set(names)]);

const i = html.indexOf('data-framer-name="Image &amp; States"');
const i2 = html.indexOf("Image &amp; States");
const i3 = html.indexOf("Image & States");
console.log("indexes", { i, i2, i3 });

// Search for square icon containers - often 60x60 or 80x80
const sized = [...html.matchAll(/style="[^"]*width:\s*(\d+)px[^"]*height:\s*\d+px[^"]*"/g)]
  .map((m) => m[0])
  .filter((s) => /width:\s*(4\d|5\d|6\d|7\d|8\d)px/.test(s));
console.log("medium square styles count", sized.length);
console.log("sample", sized.slice(0, 5));

// Look at mid CTA section - Your Support Can
const mid = html.indexOf("Your Support Can");
console.log("\nmid section at", mid);
console.log(html.slice(mid - 500, mid + 800).replace(/\s+/g, " ").slice(0, 700));
