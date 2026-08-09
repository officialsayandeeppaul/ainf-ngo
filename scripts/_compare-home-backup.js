#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function extractHtml(source) {
  const marker = 'const HTML = "';
  const start = source.indexOf(marker);
  if (start < 0) return null;
  let i = start + marker.length;
  let html = "";
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\" && i + 1 < source.length) {
      html += ch + source[i + 1];
      i += 2;
      continue;
    }
    if (ch === '"') break;
    html += ch;
    i++;
  }
  // decode lightly
  return html
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

const home = extractHtml(
  fs.readFileSync(path.join(__dirname, "../app/route.ts"), "utf8")
);
const backup = extractHtml(
  fs.readFileSync(path.join(__dirname, "../app/route.ts.hopper-backup"), "utf8")
);

for (const [name, html] of [
  ["home", home],
  ["backup", backup],
]) {
  console.log("\n===", name, "len", html.length);
  for (const w of [
    "Seven Focus",
    "Our Causes",
    "Our Missions",
    "Focus Areas",
    "Saat Pillars",
    "One Signature",
    "Save Lives",
    ">Care<",
    "framer-QjkBf",
  ]) {
    console.log(w, html.includes(w));
  }
  // Find causes section heading via data-framer-name
  const names = [...html.matchAll(/data-framer-name="([^"]*Cause[^"]*)"/gi)].map(
    (m) => m[1]
  );
  console.log("Cause names:", names.slice(0, 10));
  const sectionHeads = [
    ...html.matchAll(/data-framer-name="(Heading|Title|Section[^"]*)"/g),
  ].map((m) => m[1]);
  console.log("section-ish:", [...new Set(sectionHeads)].slice(0, 20));
}
