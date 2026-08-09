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
const backup = decodeFile("app/route.ts.hopper-backup");

// Count theainf-logo.png references - if too many, favicon patch over-replaced
console.log("theainf-logo refs cur", (html.match(/theainf-logo/g) || []).length);
console.log("theainf-logo refs bak", (backup.match(/theainf-logo/g) || []).length);

// Framer CDN images still present?
const cdnCur = [...html.matchAll(/https:\/\/framerusercontent\.com\/images\/[^"'\s)]+/g)].map((m) => m[0]);
const cdnBak = [...backup.matchAll(/https:\/\/framerusercontent\.com\/images\/[^"'\s)]+/g)].map((m) => m[0]);
console.log("cdn images cur", [...new Set(cdnCur)].length, "bak", [...new Set(cdnBak)].length);
console.log("cdn cur sample", [...new Set(cdnCur)].slice(0, 10));
console.log("cdn bak sample", [...new Set(cdnBak)].slice(0, 10));

// Find cause icon structure - look near Shiksha headings
const i = html.indexOf(">Shiksha<");
console.log("\nnear Shiksha:", html.slice(i - 800, i + 200).replace(/\s+/g, " ").slice(0, 600));

// data-framer-name around causes
const causeNames = [...html.matchAll(/data-framer-name="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((n) => /cause|icon|card|feature|stat|mission/i.test(n));
console.log("relevant names", [...new Set(causeNames)]);

// Live fetch page and check broken img
http.get("http://localhost:3000/", (res) => {
  let d = "";
  res.on("data", (c) => (d += c));
  res.on("end", () => {
    console.log("\nLIVE logo Hopper word?", /Hopper/.test(d));
    console.log("LIVE theainf wordmark?", d.includes(">theainf<") || d.includes("theainf</text>"));
    // Find mid section heading
    const h3s = [...d.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)]
      .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
      .filter(Boolean)
      .slice(0, 15);
    console.log("h3s", h3s);
  });
});
