#!/usr/bin/env node
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(3000);

  await page.evaluate(() => {
    const el = document.querySelector(".framer-QjkBf");
    if (el) el.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(1000);

  const info = await page.evaluate(() => {
    const el = document.querySelector(".framer-QjkBf");
    if (!el) return null;
    const st = getComputedStyle(el);
    let p = el;
    const chain = [];
    for (let i = 0; i < 8 && p; i++) {
      const ps = getComputedStyle(p);
      const r = p.getBoundingClientRect();
      chain.push({
        cls: p.className?.toString?.().slice(0, 60),
        opacity: ps.opacity,
        visibility: ps.visibility,
        display: ps.display,
        bg: ps.backgroundColor,
        w: Math.round(r.width),
        h: Math.round(r.height),
        y: Math.round(r.y),
      });
      p = p.parentElement;
    }
    return {
      self: {
        opacity: st.opacity,
        visibility: st.visibility,
        filter: st.filter,
        mixBlendMode: st.mixBlendMode,
        webkitMaskImage: (st.webkitMaskImage || "").slice(0, 80),
        maskSize: st.webkitMaskSize || st.maskSize,
        maskPos: st.webkitMaskPosition || st.maskPosition,
      },
      chain,
    };
  });
  console.log(JSON.stringify(info, null, 2));

  // Force-highlight logos for debug screenshot
  await page.evaluate(() => {
    for (const cls of [
      "framer-QjkBf",
      "framer-qr9MR",
      "framer-77x8p",
      "framer-iSUpc",
      "framer-hamxx",
    ]) {
      const el = document.querySelector("." + cls);
      if (!el) continue;
      el.style.outline = "2px solid red";
      el.style.backgroundColor = "#111";
    }
  });

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
    const rects = els.map((e) => e.getBoundingClientRect());
    // include parent cards
    let parent = els[0];
    for (let i = 0; i < 6; i++) {
      if (!parent.parentElement) break;
      parent = parent.parentElement;
      if (parent.getBoundingClientRect().width > 1000) break;
    }
    const pr = parent.getBoundingClientRect();
    return {
      x: Math.max(0, pr.x - 10),
      y: Math.max(0, Math.min(...rects.map((r) => r.top)) - 30),
      width: Math.min(1420, pr.width + 20),
      height: 200,
    };
  });
  console.log("clip", clip);
  await page.screenshot({
    path: path.join(__dirname, "../public/_partner-forced.png"),
    clip,
  });
  console.log("wrote _partner-forced.png");

  // Without force - natural
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const el = document.querySelector(".framer-QjkBf");
    if (el) el.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(800);
  const clip2 = await page.evaluate(() => {
    const el = document.querySelector(".framer-QjkBf");
    let p = el;
    for (let i = 0; i < 8; i++) {
      if (!p.parentElement) break;
      p = p.parentElement;
      if (p.getBoundingClientRect().width > 1000) break;
    }
    const r = p.getBoundingClientRect();
    return {
      x: Math.max(0, r.x),
      y: Math.max(0, r.y - 20),
      width: Math.min(1440, r.width),
      height: Math.min(250, Math.max(120, r.height + 40)),
    };
  });
  await page.screenshot({
    path: path.join(__dirname, "../public/_partner-natural.png"),
    clip: clip2,
  });
  console.log("wrote _partner-natural.png", clip2);

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
