#!/usr/bin/env node
const http = require("http");
const { spawnSync } = require("child_process");
const path = require("path");

function get(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      })
      .on("error", reject);
  });
}

(async () => {
  const d = await get("http://localhost:3000/");
  console.log("Seven Focus Areas", d.includes("Seven Focus Areas"));
  console.log(
    "Clients opacity:1",
    /Clients" style="[^"]*opacity:1/.test(d)
  );
  console.log(
    "Clients opacity:0",
    /Clients" style="[^"]*opacity:0/.test(d)
  );
  console.log("theainf", d.includes(">theainf</text>"));
  console.log("encoded masks", (d.match(/%3Csvg/g) || []).length);
  console.log("Care", (d.match(/>Care</g) || []).length);
  console.log("One Signature", d.includes("One Signature"));

  spawnSync(process.execPath, [path.join(__dirname, "_debug-partner-vis.js")], {
    stdio: "inherit",
  });
  const v = spawnSync(
    process.execPath,
    [path.join(__dirname, "verify-ainf-content.js")],
    { encoding: "utf8" }
  );
  console.log(v.stdout.split("\n").slice(-12).join("\n"));
  if (v.status) process.exit(v.status);
})();
