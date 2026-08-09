#!/usr/bin/env node
const { chromium } = require("playwright");
const path = require("path");
const http = require("http");

function get(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      })
      .on("error", reject);
  });
}

(async () => {
  const html = await get("http://localhost:3000/");
  for (const w of ["Care", "Impact", "Trust", "Hope", "Community", "Shiksha"]) {
    console.log(
      w,
      "plain>",
      (html.match(new RegExp(`>${w}<`, "g")) || []).length,
      "any",
      (html.match(new RegExp(w, "g")) || []).length
    );
  }

  // Check if Care was eaten like Our Causes
  const trustCtx = html.indexOf(">Trust<");
  if (trustCtx > 0) {
    console.log("Trust context:", html.slice(trustCtx - 120, trustCtx + 80).replace(/\s+/g, " "));
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);

  // Screenshot from hero through partner logos
  await page.evaluate(() => {
    const el = document.querySelector(".framer-QjkBf");
    if (el) el.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(__dirname, "../public/_final-icons-area.png"),
    clip: { x: 0, y: 200, width: 1440, height: 600 },
  });
  console.log("wrote _final-icons-area.png");

  // Top of page for logo
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(__dirname, "../public/_final-top.png"),
    clip: { x: 0, y: 0, width: 1440, height: 200 },
  });
  console.log("wrote _final-top.png");

  const logo = await page.evaluate(() =>
    [...document.querySelectorAll("text")].map((t) => t.textContent)
  );
  console.log("logo texts", logo);

  await browser.close();
})();
