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
  const classes = [
    "framer-psxn3q",
    "framer-ge32oa",
    "framer-oohp93",
    "framer-1tzdap8",
    "framer-1vqcrrs",
    "framer-5n0sk5",
    "framer-1i1bhq3",
    "framer-mparu1",
    "framer-18ldl1m-container",
    "framer-1quy4el",
    "framer-1u5u66i",
    "framer-1k3uhts",
    "framer-jzaznb",
    "framer-1vvaul9",
    "framer-1h4o374",
  ];
  for (const cls of classes) {
    const re = new RegExp(`\\.${cls}[^{]*\\{[^}]+\\}`, "g");
    const matches = html.match(re) || [];
    const withBg = matches.filter((m) => /background|opacity|overflow|height|width/.test(m));
    if (!matches.length) continue;
    console.log(`\n=== ${cls} ===`);
    for (const m of (withBg.length ? withBg : matches).slice(0, 2)) {
      console.log(m.replace(/\s+/g, " ").slice(0, 320));
    }
  }

  // Search for green backgrounds in CSS
  const greens = html.match(
    /\.framer-[A-Za-z0-9_-]+\{[^}]*background[^}]*rgb\(15,\s*51,\s*43\)[^}]*\}/g
  );
  console.log("\ngreen bg rules:", (greens || []).length);
  for (const g of (greens || []).slice(0, 8)) {
    console.log(g.replace(/\s+/g, " ").slice(0, 200));
  }
})();
