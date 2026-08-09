const fs = require("fs");

function decodeFile(file) {
  const source = fs.readFileSync(file, "utf8");
  const marker = 'const HTML = "';
  let i = source.indexOf(marker) + marker.length;
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
const backup = decodeFile("app/route.ts.hopper-backup");

for (const k of [
  "Signature",
  "Student",
  "Seven Focus",
  "Youth Supported",
  "Lives Transformed",
  "framer-178v6tj",
  "framer-guWe8",
]) {
  console.log(k, "cur", html.includes(k), "bak", backup.includes(k));
}

// CSS for star/icon class
function cssFor(h, cls) {
  const re = new RegExp(`\\.${cls}[^{]*\\{[^}]+\\}`, "g");
  return [...h.matchAll(re)].map((m) => m[0]).slice(0, 3);
}
console.log("\nstar css cur", cssFor(html, "framer-178v6tj"));
console.log("star css bak", cssFor(backup, "framer-178v6tj"));
console.log("guWe8 css cur", cssFor(html, "framer-guWe8"));
console.log("guWe8 css bak", cssFor(backup, "framer-guWe8"));

// Find style blocks containing mask or background-image for icons
const masks = [...html.matchAll(/-webkit-mask-image:[^;]+/g)].slice(0, 10);
const bgs = [...html.matchAll(/background-image:url\([^)]+\)/g)].slice(0, 15);
console.log("\nmasks", masks.map((m) => m[0].slice(0, 100)));
console.log("bg urls", [...new Set(bgs.map((m) => m[0]))].slice(0, 15));

// Compare style tag sizes
const styleLen = (h) =>
  [...h.matchAll(/<style[\s\S]*?<\/style>/g)].reduce((a, m) => a + m[0].length, 0);
console.log("\nstyle bytes cur", styleLen(html), "bak", styleLen(backup));
console.log("html len cur", html.length, "bak", backup.length);
