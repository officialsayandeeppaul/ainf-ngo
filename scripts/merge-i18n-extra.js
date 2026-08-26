#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const destPath = path.join(ROOT, "public/i18n/home-strings.json");
const extraPath = path.join(__dirname, "content/ainf-i18n-extra.json");

const dest = JSON.parse(fs.readFileSync(destPath, "utf8"));
const extra = JSON.parse(fs.readFileSync(extraPath, "utf8"));

if (extra.meta) {
  dest.meta = { ...(dest.meta || {}), ...extra.meta };
}
dest.pages = dest.pages || {};
if (extra.pages) {
  for (const [key, val] of Object.entries(extra.pages)) {
    dest.pages[key] = val;
  }
}
if (dest.pages.contact && !dest.pages["contact-us"]) {
  dest.pages["contact-us"] = dest.pages.contact;
}
dest.strings = dest.strings || {};
if (extra.strings) {
  for (const [key, val] of Object.entries(extra.strings)) {
    dest.strings[key] = val;
  }
}

// Repair mixed Hindi on a few high-traffic keys
if (dest.strings["All Indian Nevarlands Foundation works from Jamtara outward — classrooms, skill labs, job linkages, and village welfare under one roof."]) {
  dest.strings["All Indian Nevarlands Foundation works from Jamtara outward — classrooms, skill labs, job linkages, and village welfare under one roof."].hi =
    "ऑल इंडियन नेवरलैंड्स फाउंडेशन जामताड़ा से बाहर काम करता है — कक्षाएँ, कौशल प्रयोगशालाएँ, नौकरी जोड़ और गाँव कल्याण एक छत के नीचे।";
}

fs.writeFileSync(destPath, JSON.stringify(dest, null, 2) + "\n", "utf8");
console.log("merged i18n extra:", Object.keys(extra.strings || {}).length, "strings,", Object.keys(extra.pages || {}).length, "pages");
console.log("total strings:", Object.keys(dest.strings).length);
