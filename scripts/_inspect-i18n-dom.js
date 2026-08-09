#!/usr/bin/env node
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => {
    function dump(sel) {
      const el = document.querySelector(sel);
      if (!el) return null;
      return {
        tag: el.tagName,
        framer: el.getAttribute("data-framer-name"),
        className: el.className,
        childCount: el.children.length,
        html: el.innerHTML.slice(0, 500),
        text: el.textContent.slice(0, 120),
      };
    }
    return {
      h1: dump("h1"),
      nav: dump('[data-framer-name="Nav"]'),
      navigation: dump('[data-framer-name="Navigation"]'),
      donateA: (() => {
        const a = [...document.querySelectorAll("a")].find((x) =>
          x.textContent.includes("Support AINF")
        );
        if (!a) return null;
        return {
          html: a.innerHTML.slice(0, 400),
          childTags: [...a.children].map((c) => c.tagName + ":" + (c.textContent || "").slice(0, 30)),
        };
      })(),
      switcher: dump("#ainf-lang-switcher"),
    };
  });

  console.log(JSON.stringify(info, null, 2));

  await page.locator('#ainf-lang-switcher button[data-lang="bn"]').click();
  await page.waitForTimeout(1000);

  const after = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const a = [...document.querySelectorAll("a")].find((x) =>
      /Support|AINF|সহায়তা|समर्थन/.test(x.textContent)
    );
    return {
      h1html: h1?.innerHTML.slice(0, 300),
      h1text: h1?.textContent,
      donateHtml: a?.innerHTML.slice(0, 300),
    };
  });
  console.log("\nAFTER BN:\n", JSON.stringify(after, null, 2));

  await browser.close();
})();
