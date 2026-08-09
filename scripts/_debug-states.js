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
const backup = decodeFile("app/route.ts.hopper-backup");

for (const label of ["Statastic", "States", "Cause Image", "Image & States"]) {
  const i = html.indexOf(`data-framer-name="${label}"`);
  const j = backup.indexOf(`data-framer-name="${label}"`);
  console.log("\n===", label, "cur", i, "bak", j, "===");
  if (i >= 0) {
    const block = html.slice(i, i + 1800);
    console.log("CUR imgs", [...block.matchAll(/src="([^"]+)"/g)].map((m) => m[1]));
    console.log("CUR mask/svg", /mask:|<svg|background-image/.test(block));
    console.log("CUR snippet", block.replace(/\s+/g, " ").slice(0, 400));
  }
  if (j >= 0) {
    const block = backup.slice(j, j + 1800);
    console.log("BAK imgs", [...block.matchAll(/src="([^"]+)"/g)].map((m) => m[1]));
    console.log("BAK snippet", block.replace(/\s+/g, " ").slice(0, 400));
  }
}

// Find CSS classes used inside States that have mask
const statesIdx = html.indexOf('data-framer-name="States"');
const statesBlock = html.slice(statesIdx, statesIdx + 5000);
const classes = [...statesBlock.matchAll(/class="([^"]+)"/g)].flatMap((m) =>
  m[1].split(/\s+/)
);
const unique = [...new Set(classes)].filter((c) => c.startsWith("framer-"));
console.log("\nStates classes", unique.slice(0, 20));
for (const cls of unique.slice(0, 12)) {
  const re = new RegExp(`\\.${cls}\\{[^}]*mask[^}]*\\}`);
  const m = html.match(re);
  if (m) console.log(cls, "HAS MASK", m[0].slice(0, 150));
  const re2 = new RegExp(`\\.${cls}\\{[^}]*background-image[^}]*\\}`);
  const m2 = html.match(re2);
  if (m2) console.log(cls, "HAS BG", m2[0].slice(0, 150));
}
