#!/usr/bin/env node
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

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
  // Run ticker fix first
  spawnSync(process.execPath, [path.join(__dirname, "fix-ticker.js")], {
    stdio: "inherit",
  });

  const d = await get("http://localhost:3000/");

  const ul = d.match(
    /<ul style="[^"]*opacity:([01])[^"]*"[^>]*>\s*<li class="ticker-item"/
  );
  console.log("first ticker ul opacity:", ul && ul[1]);

  const careBlock = d.match(/ticker-item[\s\S]{0,900}?>Care</);
  if (careBlock) {
    console.log(
      "Care colors:",
      careBlock[0].match(/rgb\([^)]+\)/g)
    );
  }

  const logos = [
    "framer-QjkBf",
    "framer-qr9MR",
    "framer-77x8p",
    "framer-iSUpc",
    "framer-hamxx",
  ];
  let boxes = "";
  for (const cls of logos) {
    const re = new RegExp(
      `\\.${cls}\\{-webkit-mask:url\\("data:image\\/svg\\+xml,([^"]+)"\\);([^}]*)\\}`
    );
    const m = d.match(re);
    if (!m) {
      console.log("no rule", cls);
      continue;
    }
    boxes += `<div style="width:95px;height:72px;background:#222;-webkit-mask:url(data:image/svg+xml,${m[1]});mask:url(data:image/svg+xml,${m[1]});${m[2]}"></div>`;
  }
  fs.writeFileSync(
    path.join(__dirname, "../public/_mask-test.html"),
    `<!DOCTYPE html><html><body style="background:#eee;padding:40px;font-family:sans-serif"><h1>Mask test</h1><p>Logo silhouettes = pass. Solid gray = fail.</p><div style="display:flex;gap:20px">${boxes}</div></body></html>`
  );
  console.log("mask test written, boxes chars:", boxes.length);
  console.log("theainf:", d.includes(">theainf</text>"));
  console.log("Hopper text:", d.includes(">Hopper<") || d.includes(">Hopper</"));
  console.log("body ntnt:", /ntnt/.test(d.slice(d.indexOf("<body"), d.indexOf("<body") + 200)));
})();
