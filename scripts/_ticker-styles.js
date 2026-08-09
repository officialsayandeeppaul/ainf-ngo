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

  // Find style rules for ticker-related classes
  for (const cls of [
    "framer-vtmp5u",
    "framer-6csqjd",
    "framer-5a97jq",
    "framer-b2tko3",
    "framer-1niy3h3",
    "ticker-item",
  ]) {
    const re = new RegExp(`\\.${cls}[^{]*\\{[^}]+\\}`, "g");
    const matches = html.match(re) || [];
    console.log(`\n${cls} (${matches.length}):`);
    for (const m of matches.slice(0, 3)) {
      console.log(" ", m.replace(/\s+/g, " ").slice(0, 250));
    }
  }

  // Find parent section around ticker - look for background near svg-410406973
  const divId = "svg-410406973_253";
  const at = html.indexOf(divId);
  const around = html.slice(at - 1500, at + 400);
  const bgs = [...around.matchAll(/background[^;\"']+/g)].map((m) => m[0]);
  console.log("\nbackgrounds near divider:", bgs.slice(0, 10));

  // Token for white text
  console.log(
    "\nwhite text token uses:",
    (html.match(/token-f5feb66a-7605-4f06-9d18-7ae0ebf35c2b/g) || []).length
  );

  // Find CSS variable definition for that token
  const tokenDef = html.match(
    /--token-f5feb66a-7605-4f06-9d18-7ae0ebf35c2b:[^;]+/
  );
  console.log("token def:", tokenDef && tokenDef[0]);

  // Extract ticker list outer HTML roughly
  const listStart = html.lastIndexOf("<ul", at);
  const listChunk = html.slice(listStart, listStart + 800);
  console.log("\nul chunk:", listChunk.replace(/\s+/g, " ").slice(0, 500));
})();
