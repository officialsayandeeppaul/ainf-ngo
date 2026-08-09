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

const i = html.indexOf('data-framer-name="Image &amp; States"');
const j = backup.indexOf('data-framer-name="Image &amp; States"');

const cur = html.slice(i, i + 6000);
const bak = backup.slice(j, j + 6000);

fs.writeFileSync("scripts/_cur-states.html", cur);
fs.writeFileSync("scripts/_bak-states.html", bak);

console.log("CUR length", cur.length);
console.log("BAK length", bak.length);
console.log("equal?", cur === bak);

// Compare icon-related parts
console.log("\nCUR has svg", /<svg/.test(cur), "img", /<img/.test(cur), "mask", /mask/.test(cur));
console.log("BAK has svg", /<svg/.test(bak), "img", /<img/.test(bak), "mask", /mask/.test(bak));

console.log("\nCUR empty divs with framer name Star/Icon:");
console.log([...cur.matchAll(/data-framer-name="(Star|Icon|[^"]+)"[^>]*><\/div>/g)].map((m) => m[0].slice(0, 120)));

console.log("\nBAK empty divs:");
console.log([...bak.matchAll(/data-framer-name="(Star|Icon|[^"]+)"[^>]*><\/div>/g)].map((m) => m[0].slice(0, 120)));

// Find the 40px circles context
const c40 = cur.indexOf("width:40px;height:40px");
console.log("\n40px context CUR:\n", cur.slice(c40 - 400, c40 + 300).replace(/\s+/g, " "));

const b40 = bak.indexOf("width:40px;height:40px");
console.log("\n40px context BAK:\n", bak.slice(b40 - 400, b40 + 300).replace(/\s+/g, " "));
