#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const http = require("http");

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
  const masks = [
    ...html.matchAll(
      /-webkit-mask:url\('data:image\/svg\+xml,(<svg[\s\S]*?<\/svg>)'\)/g
    ),
  ].map((m) => m[1]);
  const uniq = [...new Set(masks)];

  for (let i = 0; i < uniq.length; i++) {
    const svg = uniq[i];
    const hash = (svg.match(/#/g) || []).length;
    const pct = (svg.match(/%/g) || []).length;
    const gD = (svg.match(/<g[^>]*\sd="/g) || []).length;
    const pathD = (svg.match(/<path[^>]*\sd="/g) || []).length;
    // Convert g d= to path for validity check
    const fixed = svg.replace(/<g(\s[^>]*)\sd="([^"]*)"/g, '<path$1 d="$2"');
    console.log(
      `#${i} hash=${hash} pct=${pct} g@d=${gD} path@d=${pathD} len=${svg.length}`
    );
    if (hash) {
      const samples = [...svg.matchAll(/#[0-9A-Fa-f]{3,8}|#[a-zA-Z_-]+/g)].slice(
        0,
        5
      );
      console.log(
        "  # samples:",
        samples.map((m) => m[0])
      );
    }
  }

  // Check hopper backup for original mask quoting
  const backup = path.join(__dirname, "../app/route.ts.hopper-backup");
  if (fs.existsSync(backup)) {
    const src = fs.readFileSync(backup, "utf8");
    // find how masks were quoted originally
    const m1 = src.match(/-webkit-mask:url\(\\"data:image\\\/svg\\+xml,/);
    const m2 = src.match(/-webkit-mask:url\('data:image\/svg\+xml,/);
    const m3 = src.match(/-webkit-mask:url\(&quot;data/);
    console.log("\nbackup has escaped dq mask:", !!m1);
    console.log("backup has sq mask:", !!m2);

    // Look at raw encoding of one mask in backup
    const idx = src.indexOf("viewBox=\\\"0 0 95 72\\\"");
    console.log("backup 95x72 idx:", idx);
    if (idx > 0) {
      console.log("context:", src.slice(idx - 80, idx + 120));
    }
  }

  // Proper fix: encodeURIComponent the SVG body
  // Test: does current mask SVG have characters that break?
  const client = uniq.find((s) => s.includes('viewBox="0 0 95 72"'));
  if (client) {
    const problematic = [...client].filter((c) =>
      /["'#<>%\s]/.test(c) ? false : /[^\x20-\x7E]/.test(c)
    );
    console.log("\nnon-ascii in client mask:", problematic.length);
    // chars that commonly break unencoded svg data uris in CSS
    console.log("contains #:", client.includes("#"));
    console.log('contains &:', client.includes("&"));
  }
})();
