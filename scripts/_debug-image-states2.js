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
const i = html.indexOf('data-framer-name="Image &amp; States"');
const section = html.slice(i, i + 12000);

// List all nested framer names and any mask classes
const names = [...section.matchAll(/data-framer-name="([^"]+)"/g)].map((m) => m[1]);
console.log("names in Image&States:", names);

// Find divs that look like icon holders - empty with aspect-ratio or fixed size
const empties = [
  ...section.matchAll(/<div([^>]*)><\/div>/g),
].map((m) => m[1]).filter((a) => /framer-name|class=/.test(a));
console.log("\nempty divs:", empties.slice(0, 15));

// Classes with mask in whole page that relate to icons near help
const maskClasses = [
  ...html.matchAll(/\.([a-zA-Z0-9_-]+)\{[^}]*-webkit-mask:url\(/g),
].map((m) => m[1]);
console.log("\nmask icon classes count", maskClasses.length);
console.log(maskClasses.slice(0, 30));

// Check shared-lib for Hopper logo paths
const shared = fs.readFileSync("public/framer-site/shared-lib.CSeImQTv.mjs", "utf8");
console.log("\nshared-lib has clover?", shared.includes("M 9.822 13.532"));
console.log("shared-lib has theainf text?", shared.includes("theainf"));
