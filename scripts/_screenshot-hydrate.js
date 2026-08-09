#!/usr/bin/env node
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  // Capture SSR before JS
  await page.goto("http://localhost:3000/", { waitUntil: "commit" });
  const ssr = await page.content();
  console.log("SSR One Signature:", ssr.includes("One Signature"));
  console.log("SSR theainf:", ssr.includes(">theainf</text>") || ssr.includes("theainf"));
  console.log("SSR Diary:", ssr.includes("Diary"));
  console.log("SSR Reach Us:", ssr.includes("Reach Us"));
  console.log("SSR Stories:", ssr.includes(">Stories<") || ssr.includes("Stories"));
  console.log("SSR Care:", ssr.includes(">Care<"));

  await page.waitForTimeout(5000);
  const live = await page.content();
  console.log("\nLIVE One Signature:", live.includes("One Signature"));
  console.log("LIVE Diary:", live.includes("Diary"));
  console.log("LIVE Reach Us:", live.includes("Reach Us"));
  console.log("LIVE Stories:", live.includes("Stories"));
  console.log("LIVE passionate non-profit:", live.includes("passionate non-profit"));
  console.log("LIVE Care:", live.includes(">Care<"));

  // Find partner logo row and screenshot it
  const box = await page.evaluate(() => {
    const el = document.querySelector(".framer-QjkBf");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    // walk up to a wider row
    let p = el.parentElement;
    for (let i = 0; i < 6 && p; i++) {
      if (p.getBoundingClientRect().width > 600) break;
      p = p.parentElement;
    }
    const pr = (p || el).getBoundingClientRect();
    return {
      x: Math.max(0, pr.x - 20),
      y: Math.max(0, pr.y - 20),
      w: Math.min(1400, pr.width + 40),
      h: Math.min(300, pr.height + 40),
      top: pr.y + (window.scrollY || 0),
    };
  });
  console.log("logo row box:", box);
  if (box) {
    await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 80)), box.top);
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const el = document.querySelector(".framer-QjkBf");
      const p = el && el.closest("div");
      let node = el;
      for (let i = 0; i < 8 && node; i++) {
        const w = node.getBoundingClientRect().width;
        if (w > 700) return node.getBoundingClientRect();
        node = node.parentElement;
      }
      return el.getBoundingClientRect();
    });
    await page.screenshot({
      path: path.join(__dirname, "../public/_logo-row.png"),
      clip: {
        x: Math.max(0, r.x - 10),
        y: Math.max(0, r.y - 10),
        width: Math.min(1420, r.width + 20),
        height: Math.min(250, r.height + 20),
      },
    });
    console.log("wrote _logo-row.png", r);
  }

  // Screenshot ticker Care area
  const care = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("*")].filter(
      (n) => n.childNodes.length && [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim() === "Care")
    );
    const el = nodes[0];
    if (!el) return null;
    let node = el;
    for (let i = 0; i < 10 && node; i++) {
      const w = node.getBoundingClientRect().width;
      if (w > 900) break;
      node = node.parentElement;
    }
    const r = (node || el).getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, top: r.y + window.scrollY };
  });
  console.log("care area:", care);
  if (care && care.h > 0 && care.w > 0) {
    await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 40)), care.top);
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const el = [...document.querySelectorAll("[data-framer-name='Care']")][0];
      let node = el;
      for (let i = 0; i < 10 && node; i++) {
        if (node.getBoundingClientRect().width > 900) break;
        node = node.parentElement;
      }
      return (node || el).getBoundingClientRect();
    });
    await page.screenshot({
      path: path.join(__dirname, "../public/_ticker-care.png"),
      clip: {
        x: 0,
        y: Math.max(0, r.y - 20),
        width: 1440,
        height: Math.min(220, Math.max(80, r.height + 40)),
      },
    });
    console.log("wrote _ticker-care.png");
  }

  // Full page top after hydration
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(__dirname, "../public/_home-hydrated.png"),
    clip: { x: 0, y: 0, width: 1440, height: 1000 },
  });

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
