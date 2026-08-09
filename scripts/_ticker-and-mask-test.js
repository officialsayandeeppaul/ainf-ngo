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

  // Find "Care" occurrences with context
  let idx = 0;
  let n = 0;
  while ((idx = html.indexOf(">Care<", idx)) !== -1 && n < 3) {
    console.log("\n--- Care context", n, "---");
    console.log(html.slice(idx - 200, idx + 120).replace(/\s+/g, " "));
    idx += 5;
    n++;
  }

  // Count how many times Care appears as visible text node
  console.log("\n>Care< count:", (html.match(/>Care</g) || []).length);
  console.log(">Impact< count:", (html.match(/>Impact</g) || []).length);

  // Look for ticker-related class names
  const tickerClasses = [
    ...html.matchAll(/class="([^"]*ticker[^"]*)"/gi),
  ].slice(0, 5);
  console.log("ticker classes:", tickerClasses.map((m) => m[1]));

  // Marquee / overflow styles near first Care
  const careAt = html.indexOf(">Care<");
  const before = html.slice(Math.max(0, careAt - 3000), careAt);
  const styleRefs = [...before.matchAll(/class="([^"]+)"/g)]
    .map((m) => m[1])
    .slice(-8);
  console.log("classes before Care:", styleRefs);

  // Write a standalone mask test HTML for visual QA
  const m = html.match(
    /\.framer-QjkBf\{-webkit-mask:url\("data:image\/svg\+xml,([^"]+)"\);([^}]*)\}/
  );
  if (m) {
    const test = `<!DOCTYPE html><html><head><style>
.box{width:95px;height:72px;background:#222;margin:20px;
-webkit-mask:url("data:image/svg+xml,${m[1]}");
mask:url("data:image/svg+xml,${m[1]}");
${m[2]}
}
body{font-family:sans-serif;padding:40px;background:#f5f5f5}
</style></head><body>
<h1>Mask paint test</h1>
<div class="box"></div>
<p>If you see a logo shape (not a solid gray rect), masks work.</p>
</body></html>`;
    fs.writeFileSync(path.join(__dirname, "../public/_mask-test.html"), test);
    console.log("\nwrote /_mask-test.html");
  }
})();
