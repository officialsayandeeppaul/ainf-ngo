#!/usr/bin/env node
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(3000);

  // Find ticker with Care text
  const found = await page.evaluate(() => {
    const all = [...document.querySelectorAll("h2")];
    return all
      .filter((h) => /^(Care|Impact|Trust)$/.test(h.textContent.trim()))
      .map((h) => h.textContent.trim());
  });
  console.log("ticker words visible in DOM:", found);

  await page.evaluate(() => {
    const el = [...document.querySelectorAll("h2")].find(
      (h) => h.textContent.trim() === "Care"
    );
    if (el) el.scrollIntoView({ block: "center" });
    else {
      const logos = document.querySelector(".framer-QjkBf");
      if (logos) logos.scrollIntoView({ block: "start" });
    }
  });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(__dirname, "../public/_final-ticker.png"),
    clip: { x: 0, y: 250, width: 1440, height: 550 },
  });
  console.log("wrote _final-ticker.png");
  await browser.close();
})();
