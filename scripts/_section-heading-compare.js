#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function extract(source) {
  const marker = 'const HTML = "';
  const start = source.indexOf(marker);
  let i = start + marker.length;
  let html = "";
  while (i < source.length) {
    if (source[i] === "\\" && i + 1 < source.length) {
      html += source[i] + source[i + 1];
      i += 2;
      continue;
    }
    if (source[i] === '"') break;
    html += source[i];
    i++;
  }
  return html
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function decodeFully(raw) {
  let html = raw;
  for (let p = 0; p < 5; p++) {
    const next = html
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
    // proper decode
    break;
  }
  // manual walk
  let out = "";
  let i = 0;
  const s = raw;
  while (i < s.length) {
    if (s[i] === "\\" && i + 1 < s.length) {
      const n = s[i + 1];
      if (n === "n") {
        out += "\n";
        i += 2;
        continue;
      }
      if (n === "t") {
        out += "\t";
        i += 2;
        continue;
      }
      if (n === "r") {
        out += "\r";
        i += 2;
        continue;
      }
      if (n === '"') {
        out += '"';
        i += 2;
        continue;
      }
      if (n === "\\") {
        out += "\\";
        i += 2;
        continue;
      }
      out += n;
      i += 2;
      continue;
    }
    out += s[i];
    i++;
  }
  return out;
}

function load(file) {
  const src = fs.readFileSync(file, "utf8");
  const marker = 'const HTML = "';
  const start = src.indexOf(marker) + marker.length;
  let i = start;
  let raw = "";
  while (i < src.length) {
    if (src[i] === "\\" && i + 1 < src.length) {
      raw += src[i] + src[i + 1];
      i += 2;
      continue;
    }
    if (src[i] === '"') break;
    raw += src[i];
    i++;
  }
  let html = raw;
  for (let p = 0; p < 5; p++) {
    const next = decodeFully(html);
    if (next === html) break;
    html = next;
  }
  return html;
}

const home = load(path.join(__dirname, "../app/route.ts"));
const backup = load(path.join(__dirname, "../app/route.ts.hopper-backup"));

function sectionHeadingContext(html, label) {
  const idx = html.indexOf('data-framer-name="Section Heading"');
  console.log("\n", label, "Section Heading idx", idx);
  if (idx < 0) return;
  const slice = html.slice(idx, idx + 2500);
  const text = slice.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  console.log("text:", text.slice(0, 300));
  // letter spans
  const letters = [...slice.matchAll(/>([A-Za-z ])<\/span>/g)].map((m) => m[1]);
  console.log("letters joined:", letters.join("").slice(0, 80));
}

sectionHeadingContext(home, "HOME");
sectionHeadingContext(backup, "BACKUP");

// opacity:0 inline on 1ss76od
for (const [label, html] of [
  ["HOME", home],
  ["BACKUP", backup],
]) {
  const i = html.indexOf("framer-1ss76od");
  console.log("\n", label, "1ss76od", i);
  if (i > 0) {
    console.log(html.slice(i - 50, i + 200).replace(/\s+/g, " "));
  }
  // count opacity:0
  console.log("opacity:0 count", (html.match(/opacity:0/g) || []).length);
  console.log("Our Causes", html.includes("Our Causes"));
  console.log("Causes Section", html.includes('data-framer-name="Causes Section"'));
}
