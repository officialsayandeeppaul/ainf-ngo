const http = require("http");
const fs = require("fs");

function get(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () =>
          resolve({ status: res.statusCode, len: d.length, body: d })
        );
      })
      .on("error", reject);
  });
}

(async () => {
  const home = await get("http://localhost:3000/");
  const scripts = [
    ...home.body.matchAll(/src="(\/framer-site\/[^"]+\.mjs)"/g),
  ].map((m) => m[1]);
  console.log("scripts on home", scripts);

  for (const s of scripts.slice(0, 8)) {
    const r = await get("http://localhost:3000" + s);
    console.log(s, r.status, r.len);
  }

  // Check shared-lib for broken strings from over-replacement
  const shared = fs.readFileSync(
    "public/framer-site/shared-lib.CSeImQTv.mjs",
    "utf8"
  );
  console.log("\nshared-lib Support AINF", (shared.match(/Support AINF/g) || []).length);
  console.log("shared-lib About AINF", (shared.match(/About AINF/g) || []).length);
  // Accidental replacement breaking JS? e.g. Education -> Shiksha inside identifiers
  console.log("has Shiksha in code ids?", /Shiksha[A-Za-z]|function Shiksha/.test(shared));

  // Page chunk
  const page = fs.readFileSync(
    "public/framer-site/rAZHDpIaBBj-J_uP4XFGvNpqSro10i1t2plhpKN6XFY.DBJAf7uS.mjs",
    "utf8"
  );
  console.log("page chunk size", page.length);
  console.log("page has SVG path icons", (page.match(/viewBox:`0 0 24/g) || []).length);
  console.log("page has mask", page.includes("mask"));
  console.log("page has createElement.*svg", /svg/.test(page));

  // Look for icon component modules
  const files = fs.readdirSync("public/framer-site").filter((f) => f.endsWith(".mjs"));
  for (const f of files) {
    const t = fs.readFileSync("public/framer-site/" + f, "utf8");
    if (/viewBox:`0 0 24 24`/.test(t) || /viewBox:"0 0 24 24"/.test(t)) {
      console.log("icon-like module", f, "size", t.length);
    }
  }
})();
