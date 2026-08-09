#!/usr/bin/env node
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3000/contact-us", { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);

  const base = await page.evaluate(() => ({
    hasSwitcher: !!document.getElementById("ainf-lang-switcher"),
    hasScript: !!document.querySelector('script[src*="home-i18n"]'),
    h1: document.querySelector("h1")?.textContent?.trim(),
  }));
  console.log("base", base);

  await page.locator("#ainf-lang-switcher .ainf-lang-trigger").click();
  await page.waitForTimeout(300);
  await page.locator('#ainf-lang-switcher .ainf-lang-option[data-lang="hi"]').click();
  await page.waitForTimeout(1200);

  const hi = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      h1: document.querySelector("h1")?.textContent?.trim(),
      getInTouch: body.includes("संपर्क करें"),
      sendMessage: body.includes("संदेश भेजें"),
      formHint: body.includes("फ़ॉर्म भरें") || body.includes("फॉर्म भरें"),
      support: body.includes("AINF समर्थन"),
      title: document.title,
    };
  });
  console.log("hindi", hi);

  await page.locator("#ainf-lang-switcher .ainf-lang-trigger").click();
  await page.waitForTimeout(300);
  await page.locator('#ainf-lang-switcher .ainf-lang-option[data-lang="bn"]').click();
  await page.waitForTimeout(1200);

  const bn = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      h1: document.querySelector("h1")?.textContent?.trim(),
      getInTouch: body.includes("যোগাযোগ করুন"),
      sendMessage: body.includes("একটি বার্তা পাঠান") || body.includes("বার্তা পাঠান"),
      support: body.includes("AINF সহায়তা"),
    };
  });
  console.log("bengali", bn);

  await page.screenshot({
    path: path.join(__dirname, "_contact-i18n-bn.png"),
    fullPage: false,
  });

  await browser.close();
  if (!base.hasSwitcher || !hi.getInTouch || !bn.getInTouch) process.exit(1);
})();
