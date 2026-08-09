const fs = require("fs");
const t = fs.readFileSync("app/route.ts", "utf8");
const i = t.indexOf("framer-guWe8");
console.log(t.slice(i, i + 500));
console.log("\n--- backup ---");
const b = fs.readFileSync("app/route.ts.hopper-backup", "utf8");
const j = b.indexOf("framer-guWe8");
console.log(b.slice(j, j + 500));

// Find icon classes near Give to a Desk / help cards - look for mask in sibling CSS
const help = t.indexOf("Give to a Desk");
console.log("\nnear help card raw:", t.slice(help - 2000, help).match(/framer-[a-z0-9]+/g)?.slice(-30));

// Search for SVG icon components used in help - Framer often uses Module with svg
const htmlPart = t.slice(help - 5000, help + 500);
console.log("\nsvg near help", (htmlPart.match(/<svg/g) || []).length);
console.log("use near help", (htmlPart.match(/<use/g) || []).length);
console.log("mask near help", (htmlPart.match(/mask/g) || []).length);
console.log("data-framer-name near", [...htmlPart.matchAll(/data-framer-name=\\"([^\\"]+)\\"/g)].map(m=>m[1]));
