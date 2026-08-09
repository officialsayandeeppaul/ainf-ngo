#!/usr/bin/env node
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    return [...document.querySelectorAll("a, iframe, div, button")]
      .filter((el) => {
        const t =
          (el.textContent || "") +
          (el.getAttribute("aria-label") || "") +
          (el.getAttribute("title") || "") +
          (el.src || "") +
          (el.href || "");
        return /Made in Framer|framer\.com\/projects|framerbadge|#footer_badge/i.test(t);
      })
      .slice(0, 12)
      .map((el) => ({
        tag: el.tagName,
        id: el.id,
        cls: String(el.className).slice(0, 80),
        href: el.href || el.src || "",
        text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
        pos: getComputedStyle(el).position,
        bottom: getComputedStyle(el).bottom,
        right: getComputedStyle(el).right,
      }));
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
