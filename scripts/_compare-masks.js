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

const cur = decodeFile("app/route.ts");
const bak = decodeFile("app/route.ts.hopper-backup");

for (const cls of ["framer-QjkBf", "framer-hamxx"]) {
  const re = new RegExp(`\\.${cls}\\{[^}]+\\}`);
  const c = cur.match(re)?.[0] || "";
  const b = bak.match(re)?.[0] || "";
  console.log("\n", cls);
  console.log("cur start", c.slice(0, 200));
  console.log("bak start", b.slice(0, 200));
  console.log("same except quotes?", c.replace(/url\('/g, 'url("').replace(/'\)/g, '")') === b);
  console.log("cur has <path", c.includes("<path"), "bak has <path", b.includes("<path"));
  console.log("cur has <g d=", c.includes("<g d="), "bak has <g d=", b.includes("<g d="));
}
