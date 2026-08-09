#!/usr/bin/env node
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const errors = [];

  function check(label, ok) {
    console.log((ok ? "PASS" : "FAIL") + " " + label);
    if (!ok) errors.push(label);
  }

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);

  check("switcher exists", (await page.locator("#ainf-lang-switcher").count()) > 0);
  check("i18n css loaded", (await page.locator('link[href="/i18n/home-i18n.css"]').count()) > 0);

  const heroEn = await page.locator("h1").first().textContent();
  check("hero english default", /From Shiksha to Employment/i.test(heroEn || ""));

  await page.locator('#ainf-lang-switcher button[data-lang="bn"]').click();
  await page.waitForTimeout(1200);
  const heroBn = await page.locator("h1").first().textContent();
  check("hero bengali", /শিক্ষা থেকে কর্মসংস্থান/.test(heroBn || ""));

  const navBn = await page.locator('[data-framer-name="Nav"]').first().textContent();
  check("nav bengali", /AINF সম্পর্কে/.test(navBn || ""));

  await page.locator('#ainf-lang-switcher button[data-lang="hi"]').click();
  await page.waitForTimeout(1200);
  const heroHi = await page.locator("h1").first().textContent();
  check("hero hindi", /शिक्षा से रोज़गार/.test(heroHi || ""));

  const faqHi = await page.locator("text=दान से पहले प्रश्न").count();
  check("faq heading hindi", faqHi > 0);

  await page.locator('#ainf-lang-switcher button[data-lang="en"]').click();
  await page.waitForTimeout(800);
  const heroBack = await page.locator("h1").first().textContent();
  check("hero back to english", /From Shiksha to Employment/i.test(heroBack || ""));

  const stored = await page.evaluate(() => localStorage.getItem("ainf_lang"));
  check("localStorage saved", stored === "en");

  await browser.close();
  if (errors.length) {
    console.error("\nFailed checks:", errors.join(", "));
    process.exit(1);
  }
  console.log("\nAll checks passed.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
