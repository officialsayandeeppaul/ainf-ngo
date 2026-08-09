#!/usr/bin/env node
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => {
    function linkDump(label) {
      const links = [...document.querySelectorAll("a")].filter((a) =>
        normalize(a.textContent).includes(label)
      );
      return links.slice(0, 3).map((a) => ({
        text: normalize(a.textContent),
        framer: a.getAttribute("data-framer-name"),
        html: a.innerHTML.slice(0, 600),
        rect: a.getBoundingClientRect(),
      }));
    }
    function normalize(s) {
      return (s || "").replace(/\s+/g, " ").trim();
    }
    return {
      supportLinks: linkDump("Support AINF"),
      heroBtn: (() => {
        const hero = document.querySelector('[data-framer-name="Hero Sectiion"], [data-framer-name="Hero Section"]');
        const btn = hero?.querySelector("a");
        return btn
          ? { text: btn.textContent, html: btn.innerHTML.slice(0, 600), framer: btn.getAttribute("data-framer-name") }
          : null;
      })(),
      navHtml: document.querySelector('[data-framer-name="Nav"]')?.outerHTML.slice(0, 1200),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
