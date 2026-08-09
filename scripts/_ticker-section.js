#!/usr/bin/env node
const http = require("http");
const fs = require("fs");
const path = require("path");

function get(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      })
      .on("error", reject);
  });
}

(async () => {
  const html = await get("http://localhost:3000/");
  const care = html.indexOf(">Care</h2>");
  // Find nearest data-framer-name before Care
  const before = html.slice(Math.max(0, care - 20000), care);
  const names = [...before.matchAll(/data-framer-name="([^"]+)"/g)].map(
    (m) => m[1]
  );
  console.log("framer names before Care (last 15):", names.slice(-15));

  // Find section open tags before Care
  const sections = [
    ...before.matchAll(/<section[^>]{0,300}>/g),
  ].slice(-5);
  for (const s of sections) {
    console.log("\nsection:", s[0].replace(/\s+/g, " ").slice(0, 280));
  }

  // Check class framer-5a97jq parent container bg via inline styles
  const at = html.indexOf('class="framer-5a97jq"');
  console.log("\ncontext around 5a97jq:");
  console.log(html.slice(at - 400, at + 200).replace(/\s+/g, " "));

  // Write mask test with all 5 client logos
  const logos = ["QjkBf", "qr9MR", "77x8p", "iSUpc", "hamxx"];
  let boxes = "";
  for (const cls of logos) {
    const m = html.match(
      new RegExp(
        `\\.${cls}\\{-webkit-mask:url\\("data:image\\/svg\\+xml,([^"]+)"\\);([^}]*)\\}`
      )
    );
    if (!m) {
      console.log("missing", cls);
      continue;
    }
    boxes += `<div class="box ${cls}" style="-webkit-mask:url(&quot;data:image/svg+xml,${m[1]}&quot;);mask:url(&quot;data:image/svg+xml,${m[1]}&quot;);${m[2]}"></div>`;
  }
  const test = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Mask test</title>
<style>
body{font-family:Segoe UI,sans-serif;background:#f0f0f0;padding:40px}
.row{display:flex;gap:24px;flex-wrap:wrap;align-items:center}
.box{width:95px;height:72px;background:#222}
</style></head><body>
<h1>Client logo mask test</h1>
<p>Solid gray rect = FAIL. Logo silhouette = PASS.</p>
<div class="row">${boxes}</div>
</body></html>`;
  fs.writeFileSync(path.join(__dirname, "../public/_mask-test.html"), test);
  console.log("\nwrote mask test with", logos.length, "boxes");
})();
