#!/usr/bin/env node
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);

  const before = await page.evaluate(() => {
    const switcher = document.getElementById("ainf-lang-switcher");
    const nav = document.querySelector('[data-framer-name="Nav"]');
    const donate = [...document.querySelectorAll('a[data-framer-name="Desktop"]')][0];
    const textEl =
      donate?.querySelector('[data-framer-component-type="RichTextContainer"] p') ||
      donate?.querySelector('[data-framer-component-type="RichTextContainer"]');
    return {
      inNav: !!nav?.contains(switcher),
      hasGlobe: !!switcher?.querySelector("svg"),
      donateColor: textEl ? getComputedStyle(textEl).color : null,
    };
  });
  console.log("before", before);

  await page.locator("#ainf-lang-switcher .ainf-lang-trigger").click();
  await page.waitForTimeout(300);
  const open = await page.locator("#ainf-lang-switcher.is-open .ainf-lang-menu").count();
  console.log("menu open", open > 0);

  await page.locator('#ainf-lang-switcher .ainf-lang-option[data-lang="bn"]').click();
  await page.waitForTimeout(1000);

  const after = await page.evaluate(() => {
    const donate = [...document.querySelectorAll('a[data-framer-name="Desktop"]')][0];
    const textEl =
      donate?.querySelector('[data-framer-component-type="RichTextContainer"] p') ||
      donate?.querySelector('[data-framer-component-type="RichTextContainer"]');
    const color = textEl ? getComputedStyle(textEl).color : "";
    const rgb = color.match(/\d+/g)?.map(Number) || [];
    const isWhite = rgb.length >= 3 && rgb[0] > 240 && rgb[1] > 240 && rgb[2] > 240;
    return {
      donateText: textEl?.textContent?.trim(),
      donateColor: color,
      isWhite,
      hero: document.querySelector("h1")?.textContent?.trim()?.slice(0, 40),
      inNav: !!document.querySelector('[data-framer-name="Nav"] #ainf-lang-switcher'),
    };
  });
  console.log("after bn", after);

  await page.screenshot({
    path: path.join(__dirname, "_i18n-globe-bn.png"),
    fullPage: false,
  });
  await page.locator("#ainf-lang-switcher .ainf-lang-trigger").click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(__dirname, "_i18n-globe-open.png"),
    fullPage: false,
  });

  await browser.close();
  if (!before.inNav || !before.hasGlobe || !after.isWhite) process.exit(1);
})();
