const { chromium } = require("playwright");

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

const EXPECT = {
  hi: [/[\u0900-\u097F]{4,}/],
  bn: [/[\u0980-\u09FF]{4,}/],
  en: [/AINF|Jharkhand|theainf/],
};

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];

  async function check(route, lang) {
    await page.goto("http://localhost:3000" + route + "?lang=" + lang, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);
    const data = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      stored: localStorage.getItem("ainf_lang"),
      title: document.title,
      nav: (document.querySelector("#ainf-global-nav") || {}).innerText || "",
      ready: document.documentElement.classList.contains("ainf-ready"),
      motion: !!document.querySelector('link[href*="ainf-motion.css"], script[src*="ainf-motion.js"]'),
      switcher: !!document.getElementById("ainf-lang-switcher"),
      body: (document.body.innerText || "").slice(0, 4000),
      hopper: /Hopper|uiuxocean|Surat, India/.test(document.body.innerText || ""),
    }));
    const expect = EXPECT[lang];
    const scriptHit =
      lang === "en"
        ? expect.every((re) => re.test(data.body) || re.test(data.title) || re.test(data.nav))
        : expect.some((re) => re.test(data.body) || re.test(data.title) || re.test(data.nav));
    const ok =
      scriptHit &&
      data.stored === lang &&
      data.lang === lang &&
      data.ready &&
      data.switcher &&
      !data.hopper;
    results.push({
      route,
      lang,
      ok,
      htmlLang: data.lang,
      stored: data.stored,
      title: data.title,
      ready: data.ready,
      switcher: data.switcher,
      hopper: data.hopper,
    });
    console.log(
      (ok ? "PASS" : "FAIL"),
      lang,
      route,
      "html=" + data.lang,
      "stored=" + data.stored,
      data.title.slice(0, 60)
    );
    if (!ok) {
      console.log("  sample:", data.body.slice(0, 220).replace(/\s+/g, " "));
    }
  }

  for (const route of ROUTES) {
    await check(route, "en");
    await check(route, "hi");
    await check(route, "bn");
  }

  await browser.close();
  const fails = results.filter((r) => !r.ok);
  console.log("\nChecked", results.length, "page×lang pairs;", fails.length, "failed.");
  if (fails.length) process.exit(1);
  console.log("Language walkthrough passed for all 25 routes.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
