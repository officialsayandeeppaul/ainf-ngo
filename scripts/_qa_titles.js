const { chromium } = require("playwright");

const checks = [
  ["/", "hi", /शिक्षा|रोज़गार/],
  ["/about-us", "bn", /সম্পর্কে|ঝাড়খণ্ড/],
  ["/causes", "hi", /मिशन|फ़ोकस/],
  ["/causes/education-for-every-child", "hi", /शिक्षा डेस्क|कक्षा/],
  ["/causes/food-nutrition-for-families", "bn", /রোজগার|দক্ষতা/],
  ["/projects/daily-meal-program", "en", /Nutrition Support|Coaching Batches/],
  ["/projects/daily-meal-program", "bn", /পুষ্টি|কোচিং/],
  ["/projects/winter-relief-program", "hi", /मौसमी|राहत/],
  ["/projects/winter-relief-program", "bn", /মৌসুমি|ত্রাণ/],
  ["/projects/clean-water-initiative", "en", /Clean Water|Swasthya/],
];

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let fails = 0;
  for (const [route, lang, re] of checks) {
    await page.goto("http://localhost:3000" + route + "?lang=" + lang, {
      waitUntil: "load",
      timeout: 30000,
    });
    await page.waitForTimeout(4200);
    const title = await page.title();
    const ok = re.test(title);
    console.log((ok ? "PASS" : "FAIL"), lang, route, "=>", title);
    if (!ok) fails += 1;
  }
  await browser.close();
  if (fails) process.exit(1);
  console.log("Title lock passed.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
