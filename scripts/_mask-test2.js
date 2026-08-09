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
  const d = await get("http://localhost:3000/");
  const i = d.indexOf(".framer-QjkBf{");
  console.log("idx", i);
  console.log(d.slice(i, i + 500));
  console.log("---end snippet---");
  // find closing brace
  const end = d.indexOf("}", i);
  console.log("first } at offset", end - i);
  console.log("rule:", d.slice(i, end + 1).slice(0, 200), "...", d.slice(end - 80, end + 1));

  // Care: find remaining white in ticker-item
  let idx = 0;
  let whiteLeft = 0;
  while ((idx = d.indexOf('class="ticker-item"', idx)) !== -1) {
    const chunk = d.slice(idx, idx + 1200);
    if (/rgb\(255,\s*255,\s*255\)/.test(chunk)) whiteLeft++;
    idx += 20;
  }
  console.log("ticker-items still with white:", whiteLeft);

  // Extract encoded SVG and write as file for visual check
  const m = d.slice(i, end + 1).match(
    /url\("data:image\/svg\+xml,([^"]+)"\)/
  );
  if (m) {
    const svg = decodeURIComponent(m[1]);
    fs.writeFileSync(path.join(__dirname, "_decoded-QjkBf.svg"), svg);
    console.log("wrote decoded SVG, has rgba:", /rgba\(34/.test(svg), "has var:", svg.includes("var("));
    console.log("fill samples:", [...svg.matchAll(/fill="([^"]+)"/g)].map((x) => x[1]));
  }

  // Build mask test with simpler extraction
  const logos = [
    "framer-QjkBf",
    "framer-qr9MR",
    "framer-77x8p",
    "framer-iSUpc",
    "framer-hamxx",
  ];
  let boxes = "";
  for (const cls of logos) {
    const start = d.indexOf(`.${cls}{`);
    if (start < 0) continue;
    const stop = d.indexOf("}", start);
    const rule = d.slice(start, stop + 1);
    const url = rule.match(/url\("data:image\/svg\+xml,([^"]+)"\)/);
    if (!url) {
      console.log("no url in", cls);
      continue;
    }
    boxes += `<div style="width:95px;height:72px;background:#222;-webkit-mask:url(&quot;data:image/svg+xml,${url[1]}&quot;);mask:url(&quot;data:image/svg+xml,${url[1]}&quot;);-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center"></div>`;
  }
  fs.writeFileSync(
    path.join(__dirname, "../public/_mask-test.html"),
    `<!DOCTYPE html><html><body style="background:#eee;padding:40px;font-family:sans-serif"><h1>Mask test</h1><p>Logo silhouettes = pass. Solid gray = fail.</p><div style="display:flex;gap:20px;align-items:center">${boxes}</div></body></html>`
  );
  console.log("mask test boxes:", (boxes.match(/<div/g) || []).length);
})();
