const fs = require("fs");
const http = require("http");

function decode(file) {
  const source = fs.readFileSync(file, "utf8");
  const marker = 'const HTML = "';
  const start = source.indexOf(marker);
  if (start < 0) return "";
  let i = start + marker.length;
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

const html = decode("app/route.ts");

// Logo check
console.log("logo theainf", html.includes("theainf") && html.includes('aria-label="theainf'));
console.log("logo Hopper path/clover", /Hopper|svg-136069397/.test(html.slice(0, 500000)));
const logoIdx = html.indexOf("svg-136069397");
console.log("symbol snippet:", html.slice(logoIdx, logoIdx + 200).replace(/\s+/g, " "));

// Icon / use href analysis
const uses = [...html.matchAll(/<use[^>]+href="([^"]+)"/g)].map((m) => m[1]);
const uniqueUses = [...new Set(uses)];
console.log("\nuse href count", uses.length, "unique", uniqueUses.length);
console.log("sample uses", uniqueUses.slice(0, 15));

// symbol ids defined
const symbols = [...html.matchAll(/id="(svg-[^"]+)"/g)].map((m) => m[1]);
console.log("\nsymbol ids", symbols.length, symbols.slice(0, 20));

// Missing refs
const missing = uniqueUses
  .map((u) => u.replace("#", ""))
  .filter((id) => id && !html.includes(`id="${id}"`));
console.log("\nmissing symbol targets", missing.slice(0, 20), "count", missing.length);

// Broken svg containers
const emptySvg = [...html.matchAll(/<svg[^>]*>\s*<\/svg>/g)].length;
const grayish = (html.match(/background[^;]{0,40}rgb\(1[5-9]\d/g) || []).length;
console.log("empty svgs", emptySvg);

// Check icon images
const imgIcons = [...html.matchAll(/<(?:img|image)[^>]+src="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((s) => /icon|svg|framerusercontent/i.test(s));
console.log("img-like", imgIcons.slice(0, 10));

http.get("http://localhost:3000/", (res) => {
  let d = "";
  res.on("data", (c) => (d += c));
  res.on("end", () => {
    const usesLive = [...d.matchAll(/<use[^>]+href="([^"]+)"/g)].map((m) => m[1]);
    console.log("\nLIVE uses", usesLive.length);
    console.log("LIVE hopper logo text", /Hopper/.test(d.slice(0, 200000)));
    console.log("LIVE theainf text near logo", d.includes(">theainf<") || d.includes("aria-label=\"theainf"));
    // Find focus area cards section
    const i = d.indexOf("Seven Focus Areas");
    console.log("near pillars", d.slice(i - 500, i).match(/use href="[^"]+"/g));
  });
});
