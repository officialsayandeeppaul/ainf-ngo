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

  // Get EXACT rules containing framer-vtmp5u
  const re = /[^{}]*framer-vtmp5u[^{]*\{[^}]+\}/g;
  const matches = html.match(re) || [];
  console.log("rules mentioning framer-vtmp5u:", matches.length);
  for (const m of matches) {
    console.log("\n---");
    console.log(m.replace(/\s+/g, " ").slice(0, 400));
  }

  // Compare with hopper backup
  const fs = require("fs");
  const path = require("path");
  const backup = fs.readFileSync(
    path.join(__dirname, "../app/route.ts.hopper-backup"),
    "utf8"
  );
  // decode a bit
  let b = backup;
  // find in raw escaped
  const bre = /[^{}\\]*framer-vtmp5u[^{}\\]*\{[^}]+\}/g;
  const bm = backup.match(/framer-vtmp5u/g);
  console.log("\nbackup vtmp5u mentions:", bm && bm.length);

  // Extract style block length comparison
  const liveStyles = (html.match(/<style[\s\S]*?<\/style>/g) || []).map(
    (s) => s.length
  );
  console.log("live style tag lengths:", liveStyles.slice(0, 5));
})();
