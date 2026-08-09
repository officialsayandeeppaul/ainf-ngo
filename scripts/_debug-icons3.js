const fs = require("fs");

function decodeFile(file) {
  const source = fs.readFileSync(file, "utf8");
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

const html = decodeFile("app/route.ts");

// Find how icons appear near "One Signature" / focus cards
const idx = html.indexOf("One Signature Can");
console.log("context around signature section icons:");
const slice = html.slice(idx, idx + 8000);
// find svg/img nearby before Seven Focus
const before = html.slice(Math.max(0, idx - 15000), idx);
const imgs = [...before.matchAll(/src="([^"]+)"/g)].map((m) => m[1]).slice(-20);
const masks = [...before.matchAll(/mask[^"]*"[^"]*"|url\([^)]+\)/g)].slice(-10);
console.log("imgs before section", imgs);
console.log("uses of bar symbol", (html.match(/svg-410406973_253/g) || []).length);

// Find framer components that look like icon cards - data-framer-name
const names = [...html.matchAll(/data-framer-name="([^"]*[Ii]con[^"]*)"/g)].map((m) => m[1]);
console.log("icon names", [...new Set(names)].slice(0, 30));

// Look for CurrentColor / fill issues in inline svgs used as icons
const inlineIcons = [...html.matchAll(/<svg[^>]{0,200}viewBox="0 0 24[^"]*"[^>]*>[\s\S]{0,500}?<\/svg>/g)];
console.log("inline 24x24 svgs", inlineIcons.length);
if (inlineIcons[0]) console.log(inlineIcons[0][0].slice(0, 300));

// Check CSS for icon images
const cssIcons = [...html.matchAll(/\.framer-[a-z0-9]+[^}]{0,300}background-image:[^;]+/g)].slice(0, 5);
console.log("css bg images", cssIcons.map((m) => m[0].slice(0, 150)));
