#!/usr/bin/env node
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://localhost:3000/_mask-test.html", {
    waitUntil: "networkidle",
  });
  await page.screenshot({
    path: path.join(__dirname, "../public/_mask-test.png"),
    fullPage: true,
  });
  console.log("wrote _mask-test.png");

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(__dirname, "../public/_home-top.png"),
    clip: { x: 0, y: 0, width: 1440, height: 900 },
  });
  console.log("wrote _home-top.png");

  // Scroll to logo row / ticker
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(__dirname, "../public/_home-icons.png"),
    clip: { x: 0, y: 0, width: 1440, height: 700 },
  });
  console.log("wrote _home-icons.png");

  // Logo text check
  const logoText = await page.evaluate(() => {
    const texts = [...document.querySelectorAll("text")].map((t) => t.textContent);
    return texts.filter(Boolean).slice(0, 10);
  });
  console.log("svg texts:", logoText);

  // Check if gray boxes: sample pixels from client logo elements
  const logoCheck = await page.evaluate(() => {
    const classes = [
      "framer-QjkBf",
      "framer-qr9MR",
      "framer-77x8p",
      "framer-iSUpc",
      "framer-hamxx",
    ];
    return classes.map((cls) => {
      const el = document.querySelector("." + cls);
      if (!el) return { cls, found: false };
      const st = getComputedStyle(el);
      return {
        cls,
        found: true,
        w: el.offsetWidth,
        h: el.offsetHeight,
        bg: st.backgroundColor,
        mask: (st.webkitMaskImage || st.maskImage || "").slice(0, 60),
      };
    });
  });
  console.log("logo els:", JSON.stringify(logoCheck, null, 2));

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
