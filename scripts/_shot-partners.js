#!/usr/bin/env node
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(3000);

  // Scroll partner logos into view
  await page.evaluate(() => {
    const el = document.querySelector(".framer-QjkBf");
    if (el) el.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(800);

  const clip = await page.evaluate(() => {
    const els = [
      "framer-QjkBf",
      "framer-qr9MR",
      "framer-77x8p",
      "framer-iSUpc",
      "framer-hamxx",
    ]
      .map((c) => document.querySelector("." + c))
      .filter(Boolean);
    if (!els.length) return null;
    const rects = els.map((e) => e.getBoundingClientRect());
    const left = Math.min(...rects.map((r) => r.left));
    const right = Math.max(...rects.map((r) => r.right));
    const top = Math.min(...rects.map((r) => r.top));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return {
      x: Math.max(0, left - 40),
      y: Math.max(0, top - 40),
      width: Math.min(1400, right - left + 80),
      height: Math.min(300, bottom - top + 80),
    };
  });
  console.log("clip", clip);
  if (clip && clip.height > 10) {
    await page.screenshot({
      path: path.join(__dirname, "../public/_partner-logos.png"),
      clip,
    });
    console.log("wrote _partner-logos.png");
  }

  // Also dump computed mask status
  const status = await page.evaluate(() => {
    return [
      "framer-QjkBf",
      "framer-qr9MR",
      "framer-77x8p",
      "framer-iSUpc",
      "framer-hamxx",
    ].map((cls) => {
      const el = document.querySelector("." + cls);
      if (!el) return { cls, found: false };
      const st = getComputedStyle(el);
      const mask = st.webkitMaskImage || st.maskImage || "";
      return {
        cls,
        found: true,
        maskOk: mask.includes("data:image/svg+xml"),
        bg: st.backgroundColor,
        size: `${el.offsetWidth}x${el.offsetHeight}`,
      };
    });
  });
  console.log(JSON.stringify(status, null, 2));

  // Check page for gray-looking solid only (no mask)
  const broken = status.filter((s) => s.found && !s.maskOk);
  console.log("broken masks:", broken.length);

  await browser.close();
  process.exit(broken.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
