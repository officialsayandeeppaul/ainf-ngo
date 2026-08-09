#!/usr/bin/env node
const http = require("http");

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
  const d = await get("http://localhost:3000/");
  let idx = 0;
  let n = 0;
  while ((idx = d.indexOf('class="ticker-item"', idx)) !== -1 && n < 5) {
    const chunk = d.slice(idx, idx + 1500);
    if (/rgb\(255,\s*255,\s*255\)/.test(chunk)) {
      console.log("\n=== white ticker", n, "===");
      console.log(chunk.replace(/\s+/g, " ").slice(0, 600));
      n++;
    }
    idx += 20;
  }

  // Check if white comes from style preset CSS
  const preset = d.match(
    /\.framer-styles-preset-t1x6v6[^{]*\{[^}]+\}/
  );
  console.log("\npreset t1x6v6:", preset && preset[0].replace(/\s+/g, " ").slice(0, 300));
})();
