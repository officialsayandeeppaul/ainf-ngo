#!/usr/bin/env node
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);

  await page.locator('#ainf-lang-switcher button[data-lang="bn"]').click();
  await page.waitForTimeout(1200);

  const out = path.join(__dirname, "_i18n-bn-screenshot.png");
  await page.screenshot({ path: out, fullPage: false });

  const checks = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const h1Color = h1?.querySelector("span")?.style.getPropertyValue("--framer-text-color") || "";
    const nav = document.querySelector('[data-framer-name="Nav"]');
    const donate = [...document.querySelectorAll('a[data-framer-name="Desktop"]')].find((a) =>
      a.querySelector('[data-framer-component-type="RichTextContainer"]')
    );
    return {
      h1White: /255,\s*255,\s*255|rgb\(255,\s*255,\s*255\)/.test(h1Color + (h1?.innerHTML || "")),
      navHasSwitcherInside: !!nav?.querySelector("#ainf-lang-switcher"),
      donateText: donate?.textContent?.trim(),
      switcherFixed: getComputedStyle(document.getElementById("ainf-lang-switcher")).position === "fixed",
    };
  });

  console.log(JSON.stringify(checks, null, 2));
  console.log("screenshot:", out);
  await browser.close();
})();
