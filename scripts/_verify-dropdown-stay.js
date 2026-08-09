#!/usr/bin/env node
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(4500);

  const hasChevron = await page.locator("#ainf-lang-switcher .ainf-lang-chevron").count();
  console.log("chevron", hasChevron > 0);

  await page.locator("#ainf-lang-switcher .ainf-lang-trigger").click();
  await page.waitForTimeout(800);
  const open1 = await page.locator("#ainf-lang-switcher.is-open").count();
  console.log("stays open after 800ms", open1 > 0);

  await page.waitForTimeout(1500);
  const open2 = await page.locator("#ainf-lang-switcher.is-open").count();
  console.log("stays open after 2300ms", open2 > 0);

  const options = await page.locator("#ainf-lang-switcher .ainf-lang-option").count();
  console.log("options", options);

  await page.screenshot({ path: path.join(__dirname, "_i18n-dropdown-stay.png") });

  await page.locator('#ainf-lang-switcher .ainf-lang-option[data-lang="hi"]').click();
  await page.waitForTimeout(1000);
  const closed = (await page.locator("#ainf-lang-switcher.is-open").count()) === 0;
  const hero = await page.locator("h1").first().textContent();
  console.log("closes after pick", closed);
  console.log("hindi hero", /शिक्षा|रोज़गार|अवसर/.test(hero || ""));

  const badgeVisible = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("a,div,button")].filter((el) => {
      const t = ((el.textContent || "") + (el.href || "")).toLowerCase();
      return t.includes("made in framer") || t.includes("freeplanbadge") || t.includes("framer.com/r/badge");
    });
    return nodes.some((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
    });
  });
  console.log("badge visible", badgeVisible);

  await browser.close();
  if (!(open1 > 0 && open2 > 0 && hasChevron > 0 && closed)) process.exit(1);
})();
