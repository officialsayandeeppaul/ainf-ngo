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

console.log("logo theainf text", html.includes(">theainf</text>"));
console.log("logo AINF text", html.includes(">AINF</text>"));
console.log("logo clover path gone?", !html.includes("M 9.822 13.532"));

// Masks: count single-quote wrapped vs broken double
const single = (html.match(/url\('data:image\/svg\+xml,<svg/g) || []).length;
const dblBroken = (html.match(/url\("data:image\/svg\+xml,<svg display="/g) || []).length;
console.log("single-quote masks", single, "still-broken double", dblBroken);

console.log("mid CTA", html.includes("One Signature Can") || html.includes("Change a Student's Path"));
console.log("old Save Lives", html.includes("Save Lives Today"));

http.get("http://localhost:3000/", (res) => {
  let d = "";
  res.on("data", (c) => (d += c));
  res.on("end", () => {
    console.log("\nLIVE theainf wordmark", d.includes(">theainf</text>"));
    console.log("LIVE clover gone", !d.includes("M 9.822 13.532"));
    console.log("LIVE One Signature", d.includes("One Signature Can"));
    console.log("LIVE body ntnt", /ntnt/.test(d.slice(d.indexOf("<body"), d.indexOf("<body") + 100)));
    const i = d.indexOf("<body");
    console.log("LIVE body start codes", [...d.slice(i, i + 15)].map((c) => c.charCodeAt(0)));
  });
});
