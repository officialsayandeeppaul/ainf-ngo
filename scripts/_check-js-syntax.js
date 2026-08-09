const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const dir = "public/framer-site";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mjs"));

let errors = 0;
for (const f of files) {
  const fp = path.join(dir, f);
  // Use node --check
  const r = spawnSync("node", ["--check", fp], { encoding: "utf8" });
  if (r.status !== 0) {
    errors++;
    console.log("SYNTAX FAIL", f);
    console.log((r.stderr || "").slice(0, 300));
  }
}
console.log(errors ? `${errors} files with syntax errors` : "All mjs syntax OK");

// Check dangerous replacements that may have corrupted JS identifiers/strings
const dangerous = ["Shiksha", "Swasthya", "Support AINF", "Missions", "Nari Suraksha"];
for (const f of ["shared-lib.CSeImQTv.mjs", "script_main.DRLdLDGq.mjs", "rAZHDpIaBBj-J_uP4XFGvNpqSro10i1t2plhpKN6XFY.DBJAf7uS.mjs"]) {
  const t = fs.readFileSync(path.join(dir, f), "utf8");
  for (const d of dangerous) {
    const count = t.split(d).length - 1;
    if (count) console.log(f, d, count);
  }
  // Look for broken template literals from replacement inserting unmatched quotes
  if (t.includes("Support AINF`") || t.includes("`Support AINF")) {
    console.log(f, "has Support AINF in template");
  }
}
