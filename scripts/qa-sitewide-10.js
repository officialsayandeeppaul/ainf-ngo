#!/usr/bin/env node
/**
 * Sitewide 10/10 QA: static HTML + optional Playwright language crawl.
 * Usage: node scripts/qa-sitewide-10.js [--url http://localhost:3000]
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const baseUrl = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : "http://localhost:3000";

const ROUTES = [
  "/",
  "/about-us",
  "/causes",
  "/causes/education-for-every-child",
  "/causes/healthcare-for-all",
  "/causes/food-nutrition-for-families",
  "/causes/women-empowerment-for-rise",
  "/causes/water-sanitation-for-health",
  "/blogs",
  "/blogs/a-day-in-the-life-of-our-volunteers",
  "/blogs/building-stronger-communities-together",
  "/blogs/education-can-break-poverty",
  "/blogs/how-your-donations-are-changing-lives-every-day",
  "/blogs/simple-ways-to-make-impact-on-community",
  "/blogs/why-every-volunteer-matters",
  "/contact-us",
  "/donate-now",
  "/join-as-volunteer",
  "/legal-pages/terms-conditions",
  "/projects",
  "/projects/daily-meal-program",
  "/projects/education-support-drive",
  "/projects/clean-water-initiative",
  "/projects/medical-aid-health-camps",
  "/projects/winter-relief-program",
];

const BANNED = [
  "Hopper",
  "Meal Distributed",
  "Home rebuilt for needy",
  "uiuxocean",
  "Surat, India",
  "Do ghante",
  "form bhariye",
  "Oxira",
  "Donate Now",
  "purpose-driven non-profit",
  "Support AINFs",
  "ProjectsProjects",
];

const REQUIRED = [
  "ainf-site-nav.js",
  "home-i18n.js",
  "ainf-motion.js",
  "ainf-motion.css",
];

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      url,
      { headers: { "accept-encoding": "gzip, deflate, identity" } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          let buf = Buffer.concat(chunks);
          const enc = (res.headers["content-encoding"] || "").toLowerCase();
          try {
            if (enc.includes("gzip")) buf = zlib.gunzipSync(buf);
            else if (enc.includes("deflate")) buf = zlib.inflateSync(buf);
          } catch (e) {
            reject(e);
            return;
          }
          resolve({ status: res.statusCode, body: buf.toString("utf8"), headers: res.headers });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(20000, () => {
      req.destroy(new Error("timeout"));
    });
  });
}

async function staticScan() {
  const failures = [];
  const report = [];
  for (const route of ROUTES) {
    const url = baseUrl + route;
    try {
      const res = await httpGet(url);
      const row = { route, status: res.status, ok: true, issues: [] };
      if (res.status !== 200) {
        row.ok = false;
        row.issues.push("HTTP " + res.status);
      }
      for (const token of BANNED) {
        if (res.body && res.body.includes(token)) {
          row.ok = false;
          row.issues.push("banned: " + token);
        }
      }
      for (const need of REQUIRED) {
        if (res.body && !res.body.includes(need)) {
          row.ok = false;
          row.issues.push("missing: " + need);
        }
      }
      if (route === "/about-us") {
        const plain = (res.body || "").replace(/<[^>]+>/g, "");
        if (!/Building Opportunity Across Jharkhand/.test(plain)) {
          row.ok = false;
          row.issues.push("missing about H1");
        }
        if (!/Section 8 non-profit from Nala/.test(res.body || "")) {
          row.ok = false;
          row.issues.push("missing AINF about body");
        }
      }
      if (!row.ok) failures.push(row);
      report.push(row);
      console.log(row.ok ? "PASS" : "FAIL", route, row.issues.join("; ") || "ok");
    } catch (e) {
      const row = { route, ok: false, issues: [e.message] };
      failures.push(row);
      report.push(row);
      console.log("FAIL", route, e.message);
    }
  }
  return { failures, report };
}

async function playwrightScan() {
  let playwright;
  try {
    playwright = require("playwright");
  } catch (_) {
    console.log("Playwright not installed — skipping live language crawl.");
    return [];
  }
  const failures = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ channel: "chrome" });
  } catch (e1) {
    try {
      browser = await playwright.chromium.launch({ channel: "msedge" });
    } catch (e2) {
      try {
        browser = await playwright.chromium.launch();
      } catch (e) {
        console.log("Playwright browsers missing — skipping live language crawl.");
        console.log(String(e.message || e).split("\n")[0]);
        return [];
      }
    }
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    for (const route of ROUTES) {
      await page.goto(baseUrl + route, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(4200);
      const ready = await page.evaluate(() => document.documentElement.classList.contains("ainf-ready"));
      const nav = await page.evaluate(() => !!document.getElementById("ainf-global-nav"));
      const switcher = await page.evaluate(() => !!document.getElementById("ainf-lang-switcher"));
      if (!ready) failures.push({ route, issue: "not ainf-ready" });
      if (!nav) failures.push({ route, issue: "missing nav" });
      if (!switcher) failures.push({ route, issue: "missing language switcher" });

      const hiBtn = page.locator('#ainf-lang-switcher button[data-lang="hi"]');
      const trigger = page.locator("#ainf-lang-switcher .ainf-lang-trigger");
      if (await trigger.count()) {
        await trigger.click();
        await page.waitForTimeout(200);
        if (await hiBtn.count()) {
          await hiBtn.click();
          await page.waitForTimeout(900);
          const lang = await page.evaluate(() => localStorage.getItem("ainf_lang"));
          if (lang !== "hi") failures.push({ route, issue: "hi locale not stored" });
          const htmlLang = await page.evaluate(() => document.documentElement.lang);
          if (htmlLang !== "hi") failures.push({ route, issue: "html lang not hi, got " + htmlLang });
        }
        const enBtn = page.locator('#ainf-lang-switcher button[data-lang="en"]');
        await trigger.click().catch(() => {});
        await page.waitForTimeout(150);
        if (await enBtn.count()) {
          await enBtn.click();
          await page.waitForTimeout(400);
        }
      }
      console.log("LIVE", route, "ready=" + ready, "nav=" + nav, "switcher=" + switcher);
    }
  } finally {
    await browser.close();
  }
  return failures;
}

(async () => {
  console.log("=== Static crawl", baseUrl, "===");
  const staticResult = await staticScan();
  console.log("\n=== Playwright crawl ===");
  const liveFails = await playwrightScan();
  liveFails.forEach((f) => console.log("FAIL", f.route, f.issue));

  const out = path.join(ROOT, "public/_qa/sitewide-10.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    JSON.stringify(
      { static: staticResult.report, live: liveFails, at: new Date().toISOString() },
      null,
      2
    ),
    "utf8"
  );

  const total = staticResult.failures.length + liveFails.length;
  if (total) {
    console.log("\n" + total + " issue(s).");
    process.exit(1);
  }
  console.log("\nAll sitewide checks passed.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
