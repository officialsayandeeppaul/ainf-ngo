const fs = require("fs");

function countBars(file) {
  const t = fs.readFileSync(file, "utf8");
  const bars = (t.match(/svg-410406973_253/g) || []).length;
  const uses = (t.match(/<use /g) || []).length;
  const logos = (t.match(/svg-136069397_6312/g) || []).length;
  console.log(file, { bars, uses, logos, size: t.length });
}

countBars("app/route.ts");
countBars("app/route.ts.hopper-backup");
countBars("app/causes/route.ts");
countBars("app/about-us/route.ts");

// Where are bars clustered in home?
const t = fs.readFileSync("app/route.ts", "utf8");
const idx = [];
let pos = 0;
while ((pos = t.indexOf("svg-410406973_253", pos + 1)) > 0) {
  idx.push(pos);
  if (idx.length > 5 && idx.length < 10) continue;
}
console.log("first bar at", idx[0], "last", idx[idx.length - 1]);
console.log("span of bars", idx[idx.length - 1] - idx[0]);
// density: bars per 10k chars
const start = idx[0];
const window = t.slice(start, start + 5000);
console.log("sample cluster:", window.slice(0, 800).replace(/\\n/g, "\n").slice(0, 500));
