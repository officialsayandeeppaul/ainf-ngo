#!/usr/bin/env node
/**
 * Fix mangled ";;;;;;; endings and restore truncated home from hopper-backup,
 * then re-apply AINF content with corrected write logic.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name === "route.ts") out.push(p);
  }
  return out;
}

// 1) Restore home if truncated
const home = path.join(ROOT, "app/route.ts");
const backup = path.join(ROOT, "app/route.ts.hopper-backup");
const homeText = fs.readFileSync(home, "utf8");
const homeOk =
  homeText.includes('</html>";') || homeText.includes("</html>\\n\\n\\n</body>");
const hasClosing = (() => {
  const s = homeText.indexOf('const HTML = "');
  if (s < 0) return false;
  let i = s + 14;
  while (i < homeText.length) {
    if (homeText[i] === "\\" && i + 1 < homeText.length) {
      i += 2;
      continue;
    }
    if (homeText[i] === '"') return true;
    i++;
  }
  return false;
})();

if (!hasClosing) {
  console.log("Home route truncated — restoring from hopper-backup");
  fs.copyFileSync(backup, home);
}

// 2) Collapse ";;;;... to ";
for (const file of walk(path.join(ROOT, "app"))) {
  let t = fs.readFileSync(file, "utf8");
  const before = t;
  // After HTML string close, collapse multiple semicolons to one
  t = t.replace(/(");{2,}/g, '$1;');
  // Also fix export if somehow broken (should already be export function GET)
  if (t !== before) {
    fs.writeFileSync(file, t, "utf8");
    console.log("fixed semicolons:", path.relative(ROOT, file));
  }
}

console.log("Done semicolon/home restore. Now run apply-ainf-content.js");
