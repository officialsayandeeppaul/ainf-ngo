#!/usr/bin/env node
const http = require("http");
const fs = require("fs");
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
  const html = await get("http://localhost:3000/");
  const id = "svg-410406973_253";
  const count = (html.match(new RegExp(id, "g")) || []).length;
  console.log("divider symbol refs:", count);

  // Find ticker words near dividers
  const idx = html.indexOf(id);
  console.log("first divider context words nearby:");
  const slice = html.slice(Math.max(0, idx - 500), idx + 200);
  const texts = [...slice.matchAll(/>([A-Za-z][A-Za-z &]{2,40})</g)].map((m) => m[1]);
  console.log(texts.slice(0, 20));

  // Check if ticker text exists as full words in page
  for (const w of ["Care", "Impact", "Hope", "Community", "Shiksha", "Seva"]) {
    console.log(`word ${w}:`, html.includes(`>${w}<`) || html.includes(`>${w}</`));
  }

  // Check logo in SSR carefully
  const logo = html.match(/id="svg-136069397_6312"[\s\S]{0,800}/);
  if (logo) {
    fs.writeFileSync(path.join(__dirname, "_logo-live-snip.html"), logo[0]);
    console.log("\nlogo snip has theainf:", logo[0].includes("theainf"));
    console.log("logo snip has Hopper:", logo[0].includes("Hopper"));
  }

  // Check script that loads
  const scripts = [...html.matchAll(/src="(\/framer-site\/[^"]+\.mjs)"/g)].map((m) => m[1]);
  console.log("\nscripts:", scripts);

  // init.mjs status
  const init = fs.readFileSync(
    path.join(__dirname, "../public/framer-site/init.mjs"),
    "utf8"
  );
  console.log("init.mjs starts:", init.slice(0, 80).replace(/\s+/g, " "));
})();
