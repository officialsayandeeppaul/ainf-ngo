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
  const html = await get("http://localhost:3000/");
  const body = html.indexOf("<body");
  const head = html.slice(0, body);

  console.log("theainf wordmark:", html.includes(">theainf</text>"));
  console.log(
    "clover gone:",
    !html.includes("M14.2 7.1") && !/four.?leaf|clover/i.test(html)
  );
  console.log(
    "body ntnt:",
    /ntnt/.test(html.slice(body, body + 300))
  );
  console.log(
    "body start:",
    [...html.slice(body, body + 30)].map((c) => c.charCodeAt(0))
  );

  const brokenDq = (
    html.match(/url\("data:image\/svg\+xml,<svg[\s\S]*?<\/svg>"\)/g) || []
  ).filter((m) => m.includes('display="') || m.includes('fill="'));
  const singleQ = html.match(/url\('data:image\/svg\+xml,/g) || [];
  console.log("broken nested-dq masks:", brokenDq.length);
  console.log("single-quote masks:", singleQ.length);

  // Find client logo style blocks
  const classes = [
    "framer-QjkBf",
    "framer-1x0m3q",
    "framer-v9n6e",
    "framer-1v0m3q",
    "framer-1a0m3q",
  ];
  for (const cls of classes) {
    const re = new RegExp(`\\.${cls}[^{]*\\{[^}]+\\}`, "g");
    const matches = html.match(re) || [];
    console.log(`\n${cls} rules: ${matches.length}`);
    for (const m of matches.slice(0, 2)) {
      console.log(
        " ",
        m
          .replace(/\s+/g, " ")
          .slice(0, 280)
      );
    }
  }

  // Look for background-color on mask elements
  const maskSample = html.match(
    /-webkit-mask:url\('data:image\/svg\+xml,<svg[\s\S]{0,200}/
  );
  console.log("\nmask sample:", maskSample ? maskSample[0].slice(0, 200) : "none");

  // Count gray-looking solid backgrounds near logo row
  const styleTag = html.match(/<style[^>]*data-framer-css[^>]*>[\s\S]*?<\/style>/);
  console.log("has framer css style:", !!styleTag);

  // Check if JS bundles still have broken masks
  const fs = require("fs");
  const path = require("path");
  const framer = path.join(__dirname, "../public/framer-site");
  let jsBroken = 0;
  let jsFixed = 0;
  for (const name of fs.readdirSync(framer)) {
    if (!name.endsWith(".mjs")) continue;
    const t = fs.readFileSync(path.join(framer, name), "utf8");
    const b =
      t.match(/url\(\"data:image\/svg\+xml,<svg[^"]*display=\"/g) || [];
    const f = t.match(/url\('data:image\/svg\+xml,/g) || [];
    if (b.length) {
      jsBroken += b.length;
      console.log("JS broken masks in", name, b.length);
    }
    jsFixed += f.length;
  }
  console.log("\nJS broken masks total:", jsBroken, "fixed-style:", jsFixed);
})();
