#!/usr/bin/env node
/**
 * Writes each marketing page's settled photos back into framer-html/*.html.
 *
 * Why: Framer re-renders most sections after load, and our scripts then pick
 * field photos for the re-rendered images (portraits by name, mission and story
 * images by title). Unless the served HTML already shows those same photos,
 * every page visibly swaps them a second or two after first paint. The image
 * guard (lib/image-guard.ts) replays the served photo per slot, so once the
 * HTML holds the settled choice, nothing changes on screen.
 *
 * How: loads every page from a running production server at phone, tablet,
 * and desktop widths (Framer shows a different breakpoint variant at each),
 * waits for Framer and our scripts to settle, and maps each visible served
 * <img> to the image its slot ends up with: the portrait named on its card,
 * else the final image at the same position among visible images with the
 * same alt. Served and source tags are matched by order and checked by src.
 *
 * Project pages are skipped: their photos come from Postgres at serve time.
 *
 *   npm run build && npm start            # in one terminal
 *   node scripts/bake-page-photos.mjs     # --base http://localhost:3000 --dry
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HTML_DIR = path.join(ROOT, "framer-html");
const args = process.argv.slice(2);
const base = (args[args.indexOf("--base") + 1] && args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3000").replace(/\/$/, "");
const dry = args.includes("--dry");
const only = args.includes("--page") ? args[args.indexOf("--page") + 1] : "";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM || undefined;

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 1000, height: 900 },
  { name: "desktop", width: 1440, height: 900 },
];

function pages() {
  const out = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const file = path.join(dir, name);
      if (statSync(file).isDirectory()) walk(file);
      else if (name.endsWith(".html")) out.push(path.relative(HTML_DIR, file).replace(/\\/g, "/").replace(/\.html$/, ""));
    }
  })(HTML_DIR);
  return out.filter((id) => id !== "projects" && !id.startsWith("projects/")).filter((id) => !only || id === only);
}

const routeFor = (id) => (id === "home" ? "/" : `/${id}`);

/** Every <img> tag the HTML parser will create, in document order. */
function imgTags(html) {
  const tags = [];
  const skip = /<(script|style|template|noscript|textarea|title)\b[^>]*>[\s\S]*?<\/\1>|<!--[\s\S]*?-->/gi;
  const ranges = [];
  let m;
  while ((m = skip.exec(html))) ranges.push([m.index, m.index + m[0].length]);
  const re = /<img\b[^>]*>/gi;
  let r = 0;
  while ((m = re.exec(html))) {
    while (r < ranges.length && ranges[r][1] <= m.index) r++;
    if (r < ranges.length && ranges[r][0] <= m.index) continue;
    tags.push({ index: m.index, tag: m[0] });
  }
  return tags;
}

const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag);
  return m ? m[1] : null;
};

function setAttr(tag, name, value) {
  const re = new RegExp(`\\s${name}="[^"]*"`, "i");
  if (value == null || value === "") return tag.replace(re, "");
  if (re.test(tag)) return tag.replace(re, ` ${name}="${value}"`);
  return tag.replace(/^<img\b/i, `<img ${name}="${value}"`);
}

const RECORD = `
(() => {
  const served = (window.__bakeServed = []);
  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) {
      if (n.nodeType !== 1) continue;
      const list = n.tagName === "IMG" ? [n] : n.querySelectorAll ? [...n.querySelectorAll("img")] : [];
      for (const img of list) {
        if (img.__bakeIndex != null || document.readyState !== "loading") continue;
        img.__bakeIndex = served.length;
        served.push({ src: img.getAttribute("src") || "" });
      }
    }
  }).observe(document, { childList: true, subtree: true });
  // Slots are taken at the same moment as the guard's own snapshot, so both
  // agree on which served images are visible and in what order.
  let marked = false;
  function mark() {
    if (marked) return;
    marked = true;
    const counts = {};
    for (const img of document.images) {
      if (img.__bakeIndex == null) continue;
      // Same key as keyOf() in lib/image-guard.ts.
      const alt = img.getAttribute("alt") || "";
      const layer = alt ? null : img.closest("[data-framer-name]");
      const key = alt || (layer ? "@" + layer.getAttribute("data-framer-name") : "");
      const entry = served[img.__bakeIndex];
      entry.key = key;
      entry.visible = img.getClientRects().length > 0;
      if (key && entry.visible) entry.ordinal = (counts[key] = (counts[key] || 0) + 1) - 1;
      img.__bakeEntry = entry;
    }
  }
  let snap;
  Object.defineProperty(window, "__ainfImgSnap", {
    configurable: true,
    get: () => snap,
    set: (fn) => {
      snap = function () {
        mark();
        return fn.apply(this, arguments);
      };
    },
  });
  // Before Framer starts (it waits for load): the portrait named on each served card.
  addEventListener("load", () => {
    mark();
    const rules = window.__ainfImgRules;
    if (!rules || !rules.person) return;
    for (const img of document.images) {
      if (img.__bakeEntry && img.__bakeEntry.visible) img.__bakeEntry.person = rules.person(img) || "";
    }
  });
})();`;

async function settle(page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(3500);
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += innerHeight * 0.9) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    scrollTo(0, 0);
  });
  await page.waitForTimeout(4500);
}

async function finalSlots(page) {
  return page.evaluate(() => {
    const slots = {};
    for (const img of document.images) {
      if (!img.getClientRects().length) continue;
      const key = img.__ainfKey != null ? img.__ainfKey : img.getAttribute("alt") || "";
      if (!key) continue;
      (slots[key] = slots[key] || []).push({
        src: img.getAttribute("src") || "",
        srcset: img.getAttribute("srcset") || "",
        sizes: img.getAttribute("sizes") || "",
      });
    }
    return { slots, served: window.__bakeServed };
  });
}

function decide(id, servedHtml, result, decisions, conflicts) {
  const tags = imgTags(servedHtml);
  const { served, slots } = result;
  if (tags.length !== served.length) throw new Error(`${id}: ${tags.length} served tags vs ${served.length} parsed images`);
  served.forEach((entry, i) => {
    const tagSrc = attr(tags[i].tag, "src") || "";
    if (tagSrc.replace(/&amp;/g, "&") !== entry.src) throw new Error(`${id}: image ${i} src mismatch ${tagSrc} vs ${entry.src}`);
    if (!entry.visible || !entry.key) return;
    let next = null;
    // Portraits follow the name on the card, wherever the slideshow put it.
    if (entry.person) next = { src: entry.person, srcset: "", sizes: "" };
    else if (slots[entry.key] && slots[entry.key][entry.ordinal]) next = slots[entry.key][entry.ordinal];
    if (!next || next.src.startsWith("data:")) return;
    const prev = decisions.get(i);
    if (prev && prev.src !== next.src) conflicts.push(`${id} #${i} ${entry.key}: ${prev.src} vs ${next.src}`);
    else decisions.set(i, next);
  });
}

const browser = await chromium.launch({ executablePath });
let changedFiles = 0;
for (const id of pages()) {
  const file = path.join(HTML_DIR, `${id}.html`);
  const source = readFileSync(file, "utf8");
  const decisions = new Map();
  const conflicts = [];
  let servedHtml = "";
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    await page.addInitScript(RECORD);
    const response = await page.goto(base + routeFor(id), { waitUntil: "domcontentloaded", timeout: 120000 });
    if (!servedHtml) servedHtml = await response.text();
    await settle(page);
    decide(`${id}@${vp.name}`, servedHtml, await finalSlots(page), decisions, conflicts);
    await context.close();
  }
  const sourceTags = imgTags(source);
  const servedTags = imgTags(servedHtml);
  if (sourceTags.length !== servedTags.length) throw new Error(`${id}: source has ${sourceTags.length} tags, served ${servedTags.length}`);
  let html = source;
  let changed = 0;
  for (let i = sourceTags.length - 1; i >= 0; i--) {
    const next = decisions.get(i);
    if (!next) continue;
    // Compared with the file, not the served page: the running build may be older.
    let tag = sourceTags[i].tag;
    if ((attr(tag, "src") || "") === next.src && (attr(tag, "srcset") || "") === next.srcset) continue;
    tag = setAttr(tag, "src", next.src);
    tag = setAttr(tag, "srcset", next.srcset);
    tag = setAttr(tag, "sizes", next.srcset ? next.sizes : "");
    html = html.slice(0, sourceTags[i].index) + tag + html.slice(sourceTags[i].index + sourceTags[i].tag.length);
    changed++;
  }
  console.log(`${id}: ${changed} image(s) ${dry ? "would change" : "baked"}${conflicts.length ? `, ${conflicts.length} conflict(s)` : ""}`);
  for (const c of conflicts) console.log(`  conflict ${c}`);
  if (changed && !dry) {
    writeFileSync(file, html);
    changedFiles++;
  }
}
await browser.close();
console.log(`${changedFiles} page(s) written${dry ? " (dry run)" : ""}.`);
