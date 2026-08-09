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

  console.log("theainf:", html.includes(">theainf</text>"));
  console.log("Hopper text in body?:", />Hopper</.test(html) || html.includes(">Hopper</text>"));
  console.log("encoded masks:", (html.match(/url\("data:image\/svg\+xml,%3Csvg/g) || []).length);
  console.log("raw unencoded masks:", (html.match(/url\(['"]data:image\/svg\+xml,<svg/g) || []).length);
  console.log("var(--token in mask urls?:", /svg\+xml[^)]*var\(--token/.test(html));

  // Decode one client logo mask and check fills
  const m = html.match(
    /\.framer-QjkBf\{-webkit-mask:url\("data:image\/svg\+xml,([^"]+)"\)/
  );
  if (m) {
    const svg = decodeURIComponent(m[1]);
    console.log("\nQjkBf decoded head:", svg.slice(0, 120));
    console.log("has var(:", svg.includes("var("));
    console.log("has rgba fill:", /fill="rgba\(/.test(svg));
    console.log("fill samples:", [...svg.matchAll(/fill="([^"]+)"/g)].map((x) => x[1]).slice(0, 5));
  } else {
    console.log("QjkBf rule not found");
  }

  // body start
  const body = html.indexOf("<body");
  console.log("\nbody ntnt:", /ntnt/.test(html.slice(body, body + 200)));
  console.log("body codes:", [...html.slice(body, body + 20)].map((c) => c.charCodeAt(0)));
})();
