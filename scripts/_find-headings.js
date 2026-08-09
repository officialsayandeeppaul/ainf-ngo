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

  // Find h1/h2 near causes section
  const titles = [...d.matchAll(/<(h1|h2)[^>]*>([\s\S]*?)<\/\1>/g)]
    .map((m) => ({
      tag: m[1],
      text: m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
    }))
    .filter((t) => t.text.length > 3 && t.text.length < 120);
  console.log("headings sample:");
  for (const t of titles.slice(0, 40)) {
    console.log(`  ${t.tag}: ${t.text}`);
  }

  // Search Focus / Causes / Missions
  for (const w of [
    "Focus",
    "Causes",
    "Missions",
    "Pillars",
    "Saat",
    "Seven",
    "Care",
    "Impact",
  ]) {
    console.log(`${w} count:`, (d.match(new RegExp(w, "g")) || []).length);
  }

  // Check if letter-span H1 for seven focus
  const letterH1 = [...d.matchAll(/<h1[^>]*>[\s\S]{0,2000}?<\/h1>/g)].map((m) =>
    m[0].replace(/<[^>]+>/g, "")
  );
  console.log("\nH1 plain texts:");
  letterH1.forEach((t, i) => console.log(i, JSON.stringify(t.slice(0, 80))));
})();
