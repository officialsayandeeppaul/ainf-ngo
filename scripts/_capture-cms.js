const fs = require("fs");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const cms = [];

  page.on("response", async (res) => {
    const u = res.url();
    if (!u.includes("framercms")) return;
    try {
      const buf = Buffer.from(await res.body());
      const text = buf.toString("utf8");
      cms.push({ url: u, len: buf.length, text });
      const name = u.split("/").pop().split("?")[0];
      fs.writeFileSync(`scripts/_cms-live-${name}.bin`, buf);
    } catch {}
  });

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(4000);

  for (const item of cms) {
    console.log("\n====", item.url, "====");
    const interesting = (item.text.match(/[A-Za-z][A-Za-z0-9 &;,'’\-:/?.]{6,100}/g) || []).filter(
      (s) =>
        /Education|Healthcare|Women|Water|Food|Sanitation|Empowerment|Nutrition|Cause|Child|Raised|Goal|drinking|skill|families/i.test(
          s
        )
    );
    console.log([...new Set(interesting)].slice(0, 50));
  }

  // Inspect cause module source briefly
  for (const f of ["z6BbrJpBM.ByqTD99J.mjs", "rAepfR9AN.CL20Uchy.mjs", "ekUy8zpgx.BRhQj-zl.mjs"]) {
    const t = fs.readFileSync("public/framer-site/" + f, "utf8");
    console.log("\n##", f, "len", t.length);
    console.log(t.slice(0, 500));
    const cmsBits = t.match(/cms\/[^"`']{10,120}/g);
    console.log("cms bits", cmsBits);
    const hosts = t.match(/framerusercontent[^"`']{0,80}/g);
    console.log("hosts", [...new Set(hosts || [])].slice(0, 10));
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
