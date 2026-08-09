#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const files = fs.readdirSync(path.join(__dirname, "../public/framer-site")).filter((f) => f.endsWith(".mjs"));
const needles = ["What does AINF", "Section 8 foundation", "Mere bhaiya", "ledger note", "Support AINF form", "Field Sevak form", "Haan — Support"];
for (const file of files) {
  const c = fs.readFileSync(path.join(__dirname, "../public/framer-site", file), "utf8");
  for (const n of needles) {
    if (c.includes(n)) console.log(file, "->", n);
  }
}
