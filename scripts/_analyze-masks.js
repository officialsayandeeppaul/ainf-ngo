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
        res.on("end", () => resolve({ status: res.statusCode, body: d }));
      })
      .on("error", reject);
  });
}

(async () => {
  const { body: html } = await get("http://localhost:3000/");

  // Extract all unique mask data URIs
  const masks = [
    ...html.matchAll(
      /-webkit-mask:url\('data:image\/svg\+xml,(<svg[\s\S]*?<\/svg>)'\)/g
    ),
  ].map((m) => m[1]);

  console.log("unique mask count:", new Set(masks).size, "total:", masks.length);

  // Analyze each unique mask
  const uniq = [...new Set(masks)];
  for (let i = 0; i < uniq.length; i++) {
    const svg = uniq[i];
    const hasGWithD = /<g[^>]*\sd=/.test(svg);
    const hasPath = /<path /.test(svg);
    const hasFill = /fill="(?!transparent|none)[^"]+"/.test(svg);
    const hasStroke = /stroke="(?!none)[^"]+"/.test(svg);
    const vb = (svg.match(/viewBox="([^"]+)"/) || [])[1];
    console.log(
      `\n#${i} len=${svg.length} vb=${vb} path=${hasPath} g@d=${hasGWithD} fill=${hasFill} stroke=${hasStroke}`
    );
    console.log("  head:", svg.slice(0, 160).replace(/\s+/g, " "));
    // write for inspection
    fs.writeFileSync(
      path.join(__dirname, `_mask_${i}.svg`),
      svg.replace(/display="block"/, 'xmlns="http://www.w3.org/2000/svg"')
    );
  }

  // Find the 5 client logo class names near "Partner" or logo row
  const logoRowMatch = html.match(
    /framer-[A-Za-z0-9]+\{-webkit-mask:url\('data:image\/svg\+xml,<svg display="block" role="presentation" viewBox="0 0 95 72"[\s\S]*?<\/svg>'\)[^}]*\}/g
  );
  console.log("\n95x72 client logo rules:", (logoRowMatch || []).length);
  if (logoRowMatch) {
    for (const r of logoRowMatch) {
      const cls = r.match(/framer-[A-Za-z0-9]+/);
      const bg = r.match(/background[^;]+/);
      const size = r.match(/mask-size[^;]+|webkit-mask-size[^;]+/);
      console.log(cls && cls[0], bg && bg[0], size && size[0]);
      console.log("  full style snippet:", r.slice(0, 120), "...", r.slice(-80));
    }
  }

  // Also find ALL classes with 95 72 viewBox
  const all95 = [
    ...html.matchAll(
      /\.(framer-[A-Za-z0-9]+)\{[^}]*viewBox="0 0 95 72"[^}]*\}/g
    ),
  ];
  console.log("\nclasses with 95x72:", all95.map((m) => m[1]));

  // Check logo in SSR vs what's in script tags as JSON
  const hasHopperText = html.includes(">Hopper</") || html.includes(">Hopper<");
  const hasTheainfInSvg = html.includes(">theainf</text>");
  console.log("\nSSR Hopper text:", hasHopperText);
  console.log("SSR theainf:", hasTheainfInSvg);

  // Script modules that might inject Hopper
  const scripts = [...html.matchAll(/src="(\/framer-site\/[^"]+)"/g)].map(
    (m) => m[1]
  );
  console.log("script modules:", scripts.length);
})();
