#!/usr/bin/env node
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 5000 } });
  await page.goto("http://localhost:3000/contact-us", { waitUntil: "networkidle" });
  await page.waitForTimeout(4500);

  const data = await page.evaluate(() => {
    const skip = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG"]);
    const texts = new Set();
    function add(t) {
      const s = (t || "").replace(/\s+/g, " ").trim();
      if (!s || s.length < 2 || s.length > 400) return;
      if (/^[\d\s+,.%$]+$/.test(s)) return;
      texts.add(s);
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        let p = node.parentElement;
        while (p) {
          if (skip.has(p.tagName)) return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) add(node.textContent);
    document.querySelectorAll("[placeholder],[aria-label],[title],[alt]").forEach((el) => {
      ["placeholder", "aria-label", "title", "alt"].forEach((a) => add(el.getAttribute(a)));
    });
    return {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || "",
      texts: [...texts].sort((a, b) => b.length - a.length),
      hasI18n: !!document.querySelector('script[src*="home-i18n"]'),
      hasSwitcher: !!document.getElementById("ainf-lang-switcher"),
    };
  });

  fs.writeFileSync(
    path.join(__dirname, "_contact-live-texts.json"),
    JSON.stringify(data, null, 2),
    "utf8"
  );
  console.log("title:", data.title);
  console.log("hasI18n:", data.hasI18n, "hasSwitcher:", data.hasSwitcher);
  console.log("count:", data.texts.length);
  data.texts.forEach((t) => console.log(t));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
