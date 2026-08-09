#!/usr/bin/env node
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);

  const data = await page.evaluate(() => {
    const texts = new Set();
    const attrs = ["placeholder", "aria-label", "title", "alt"];

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent.replace(/\s+/g, " ").trim();
      if (t && t.length >= 2 && /[A-Za-z\u0900-\u097F\u0980-\u09FF]/.test(t)) {
        texts.add(t);
      }
    }

    document.querySelectorAll("*").forEach((el) => {
      for (const a of attrs) {
        const v = el.getAttribute(a);
        if (v && v.trim().length >= 2) texts.add(v.trim());
      }
    });

    return {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || "",
      texts: [...texts].sort((a, b) => b.length - a.length),
    };
  });

  fs.writeFileSync(
    path.join(__dirname, "_home-live-texts.json"),
    JSON.stringify(data, null, 2),
    "utf8"
  );
  console.log("title:", data.title);
  console.log("text count:", data.texts.length);
  data.texts.slice(0, 60).forEach((t) => console.log("---", t));

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
