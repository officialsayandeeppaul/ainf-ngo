#!/usr/bin/env node
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
  const marker = 'class="framer-5a97jq"';
  const at = html.indexOf(marker);
  console.log("framer-5a97jq at", at);

  // Walk backwards to find enclosing sections with backgrounds
  const before = html.slice(Math.max(0, at - 8000), at);
  const classes = [...before.matchAll(/class="(framer-[^"]+)"/g)].map(
    (m) => m[1]
  );
  const uniq = [...new Set(classes)].slice(-20);
  console.log("ancestor-ish classes:", uniq);

  for (const cls of uniq) {
    const re = new RegExp(
      `\\.${cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^{]*\\{[^}]*background[^}]*\\}`,
      "g"
    );
    const matches = html.match(re) || [];
    if (matches.length) {
      console.log(
        "\n",
        cls,
        matches[0].replace(/\s+/g, " ").slice(0, 300)
      );
    }
  }

  // Also search for opacity:0 ticker ul siblings
  const opacity0 = (html.match(/opacity:0/g) || []).length;
  console.log("\nopacity:0 count:", opacity0);

  // Find section containing ticker - look for will-change or ticker component
  const tickerComp = html.indexOf("Ticker");
  console.log("Ticker string idx:", tickerComp);

  // Check divider SVG stroke color
  const sym = html.match(
    /id="svg-410406973_253"[\s\S]{0,400}/
  );
  console.log("\ndivider symbol:", sym && sym[0].replace(/\s+/g, " ").slice(0, 350));
})();
