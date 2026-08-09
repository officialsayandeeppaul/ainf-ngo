const fs = require("fs");
const path = require("path");
const http = require("http");

const imgDir = "public/assets/img";
console.log("img dir exists", fs.existsSync(imgDir));
if (fs.existsSync(imgDir)) {
  console.log(
    fs.readdirSync(imgDir).map((n) => {
      const s = fs.statSync(path.join(imgDir, n));
      return `${n} (${s.size}b)`;
    })
  );
}

const t = fs.readFileSync("app/route.ts", "utf8");
const local = [...new Set([...t.matchAll(/\/assets\/img\/[a-zA-Z0-9._-]+/g)].map((m) => m[0]))];
console.log("\nlocal asset refs in home:", local);

for (const ref of local) {
  const fp = path.join("public", ref.replace(/^\//, ""));
  console.log(ref, fs.existsSync(fp) ? "EXISTS" : "MISSING");
}

// Find icon section near stats / causes - look for mask or background-image svg
const htmlStart = t.indexOf('const HTML');
const chunk = t.slice(htmlStart, htmlStart + 200000);
const bgSvgs = [...chunk.matchAll(/url\(([^)]+\.svg)\)/g)].map((m) => m[1]);
console.log("\nbg svg urls sample", [...new Set(bgSvgs)].slice(0, 20));

// Check symbol definition for logo
const i = t.indexOf('id=\\"svg-136069397_6312\\"');
console.log("\nlogo symbol def:", t.slice(i, i + 400));

// Second symbol
const j = t.indexOf('id=\\"svg-410406973_253\\"');
console.log("\nicon symbol def:", t.slice(j, j + 500));

function get(url) {
  return new Promise((resolve) => {
    http
      .get(url, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve({ status: res.statusCode, len: d.length, head: d.slice(0, 80) }));
      })
      .on("error", (e) => resolve({ error: e.message }));
  });
}

(async () => {
  for (const ref of local.filter((r) => r.endsWith(".svg") || r.endsWith(".png"))) {
    const r = await get("http://localhost:3000" + ref);
    console.log("HTTP", ref, r);
  }
})();
