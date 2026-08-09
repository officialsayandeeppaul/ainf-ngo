#!/usr/bin/env node
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 9000 } });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  const buttons = page.locator("button");
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    const txt = ((await btn.textContent()) || "").trim();
    if (txt.includes("AINF") || txt.includes("donation") || txt.includes("ledger") || txt.includes("Paisa")) {
      try {
        await btn.click({ timeout: 1500 });
        await page.waitForTimeout(200);
      } catch (_) {}
    }
  }

  const all = await page.evaluate(() => {
    const texts = new Set();
    document.querySelectorAll("p, h3, h4, button, blockquote").forEach((el) => {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (t.length > 15 && t.length < 500 && /[a-zA-Z]/.test(t)) texts.add(t);
    });
    return [...texts].sort((a, b) => b.length - a.length);
  });

  all.filter((t) => /foundation|ledger|donat|sevak|Section 8|polytechnic|Rozgar mela|Working alongside|Mere bhaiya|Daan ke/i.test(t)).forEach((t) => console.log(t));

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
