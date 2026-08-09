const fs = require("fs");

function decode(source) {
  const marker = 'const HTML = "';
  const start = source.indexOf(marker) + marker.length;
  let i = start;
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

const html = decode(fs.readFileSync("app/route.ts", "utf8"));
const tickerStart = html.indexOf("ticker-item");
console.log("ticker at", tickerStart);

// Get text content of first few ticker items
const items = [...html.matchAll(/ticker-item[\s\S]{0,800}?<\/li>/g)].slice(0, 5);
for (const it of items) {
  const text = it[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  console.log("item:", text.slice(0, 120));
}

// Icon cards - look for "Icon" framer name with sibling text
const iconBlocks = [...html.matchAll(/data-framer-name="Icon"[\s\S]{0,2000}?data-framer-name="[^"]+"/g)].slice(0, 8);
console.log("\nicon blocks", iconBlocks.length);
for (const b of iconBlocks.slice(0, 3)) {
  const svgs = b[0].match(/<svg[\s\S]{0,400}<\/svg>/);
  const imgs = b[0].match(/src="([^"]+)"/);
  const text = b[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  console.log("---");
  console.log("text", text);
  console.log("img", imgs && imgs[1]);
  console.log("svg", svgs && svgs[0].slice(0, 200));
}

// Check JS for icon SVG paths that might be broken
const js = fs.readFileSync(
  "public/framer-site/rAZHDpIaBBj-J_uP4XFGvNpqSro10i1t2plhpKN6XFY.DBJAf7uS.mjs",
  "utf8"
);
console.log("\nJS has Icon", js.includes("Icon"));
console.log("JS svg path count", (js.match(/viewBox:`0 0 24 24`/g) || []).length);
