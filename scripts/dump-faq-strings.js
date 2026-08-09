#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const c = fs.readFileSync(path.join(__dirname, "../public/framer-site/ZXEP0rDls.C9ivg-A9.mjs"), "utf8");
const re = /children:`([^`\\]{2,500})`/g;
let m;
while ((m = re.exec(c))) console.log(m[1]);
