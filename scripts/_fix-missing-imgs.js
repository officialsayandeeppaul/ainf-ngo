#!/usr/bin/env node
/**
 * Delete HTML-masquerading "webp" files and copy a real photo from the
 * same page so broken /assets/img/{hash}.webp requests resolve.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const APP = path.join(ROOT, "app");
const IMG = path.join(ROOT, "public", "assets", "img");

function walk(dir, acc = []) {
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, n.name);
    if (n.isDirectory()) walk(p, acc);
    else if (n.name === "route.ts") acc.push(p);
  }
  return acc;
}

function isRealWebp(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const b = fs.readFileSync(filePath);
  return b.length > 1000 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46;
}

const re = /\/assets\/img\/([a-f0-9]{16,}\.webp)/g;
const routes = walk(APP);
const byRoute = {};
const all = new Set();
for (const f of routes) {
  const t = fs.readFileSync(f, "utf8");
  const set = new Set();
  let m;
  while ((m = re.exec(t))) set.add(m[1]);
  byRoute[f] = [...set];
  set.forEach((n) => all.add(n));
}

let deleted = 0;
for (const name of fs.readdirSync(IMG)) {
  if (!name.endsWith(".webp")) continue;
  const p = path.join(IMG, name);
  if (!isRealWebp(p)) {
    fs.unlinkSync(p);
    deleted += 1;
  }
}

const FALLBACK = path.join(IMG, "e8fe459b69dfaec5.webp");
if (!isRealWebp(FALLBACK)) {
  console.error("No fallback photo at", FALLBACK);
  process.exit(1);
}

let copied = 0;
for (const [file, names] of Object.entries(byRoute)) {
  const realOnPage = names
    .map((n) => path.join(IMG, n))
    .filter(isRealWebp);
  const source = realOnPage[0] || FALLBACK;
  for (const n of names) {
    const dest = path.join(IMG, n);
    if (isRealWebp(dest)) continue;
    fs.copyFileSync(source, dest);
    copied += 1;
  }
}

const still = [...all].filter((n) => !isRealWebp(path.join(IMG, n)));
console.log("deleted fake", deleted, "copied", copied, "still missing", still.length);
if (still.length) still.forEach((n) => console.log("MISS", n));
