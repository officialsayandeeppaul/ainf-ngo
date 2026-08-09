#!/usr/bin/env node
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => {
    const nav = document.querySelector('[data-framer-name="Nav"]');
    const donate = [...document.querySelectorAll('a[data-framer-name="Desktop"]')].find((a) =>
      (a.textContent || "").includes("Support")
    );
    const cs = donate ? getComputedStyle(donate) : null;
    const textEl = donate?.querySelector('[data-framer-component-type="RichTextContainer"]');
    return {
      navChildren: nav
        ? [...nav.children].map((c) => ({
            name: c.getAttribute("data-framer-name"),
            className: c.className,
            width: c.getBoundingClientRect().width,
          }))
        : null,
      donateColor: textEl ? getComputedStyle(textEl).color : null,
      donateInner: textEl?.innerHTML?.slice(0, 400),
      donateRect: donate?.getBoundingClientRect(),
      navRect: nav?.getBoundingClientRect(),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
