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

// Full first Icon block (larger window)
const iconIdx = html.indexOf('data-framer-name="Icon"');
console.log("=== ICON BLOCK ===");
console.log(html.slice(iconIdx, iconIdx + 2500));

// Full first ticker li
const ti = html.indexOf('class="ticker-item"');
console.log("\n=== TICKER ITEM ===");
console.log(html.slice(ti, ti + 1500));

// Search for mask-image / -webkit-mask near Icon
const near = html.slice(iconIdx, iconIdx + 5000);
console.log("\nmask?", /mask/.test(near));
console.log("background-image?", near.match(/background[^;]{0,100}/g));
console.log("svg in next 5k?", /<svg/.test(near));
console.log("img in next 5k?", /<img/.test(near));
