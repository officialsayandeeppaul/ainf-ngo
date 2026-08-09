#!/usr/bin/env node
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);
  const count = await page.locator("#ainf-lang-switcher-mobile").count();
  console.log("mobile switcher count:", count);
  if (count) {
    await page.locator('#ainf-lang-switcher-mobile button[data-lang="bn"]').click();
    await page.waitForTimeout(1000);
    const hero = await page.locator("h1").first().textContent();
    console.log("mobile hero bn:", /শিক্ষা/.test(hero || "") ? "PASS" : "FAIL");
  }
  await browser.close();
})();
