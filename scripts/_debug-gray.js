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

let pos = 0;
let n = 0;
while ((pos = html.indexOf("rgba(0, 0, 0, 0.2)", pos + 1)) > 0 && n < 8) {
  n++;
  console.log("\n=== hit", n, "at", pos, "===");
  console.log(html.slice(pos - 500, pos + 400).replace(/\s+/g, " "));
}

// Also find white cards with gray - look for border cards in a row near mid CTA
const mid = html.indexOf("Your Support Can");
const around = html.slice(mid - 8000, mid + 2000);
console.log("\n\n=== names near mid CTA ===");
console.log([
  ...new Set(
    [...around.matchAll(/data-framer-name="([^"]+)"/g)].map((m) => m[1])
  ),
]);
