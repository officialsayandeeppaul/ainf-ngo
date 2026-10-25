#!/usr/bin/env node
/**
 * Writes each marketing page's settled copy back into framer-html/*.html.
 *
 * Why: the exported HTML predates the copy now in Framer's page modules, and
 * ainf-page-boot.js corrects some of either. Framer re-renders most sections
 * after load, so visitors watched paragraphs and headings change a second or
 * two after first paint. Once the HTML carries the settled copy, the re-render
 * paints the same words.
 *
 * How: loads every page from a running production server at phone, tablet,
 * and desktop widths, records each served RichTextContainer (Framer's text
 * element) when the image guard takes its snapshot, waits for Framer and our
 * scripts to settle, then pairs served and settled containers by class and
 * position among visible ones. Differing blocks get the settled markup when
 * it is plain Framer markup, or the settled text when only the wording should
 * move over. Letter-split (animated) headings are reported, not rewritten.
 *
 *   npm run build && npm start
 *   node scripts/bake-page-text.mjs        # --base http://localhost:3000 --dry --page home
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HTML_DIR = path.join(ROOT, "framer-html");
const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : "");
const base = (flag("--base") || "http://localhost:3000").replace(/\/$/, "");
const dry = args.includes("--dry");
const only = flag("--page");
const executablePath = process.env.PLAYWRIGHT_CHROMIUM || undefined;

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 1000, height: 900 },
  { name: "desktop", width: 1440, height: 900 },
];
const CONTAINER = 'data-framer-component-type="RichTextContainer"';

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

/** Ranges the HTML parser never turns into elements. */
function inertRanges(html) {
  const ranges = [];
  const re = /<(script|style|template|noscript|textarea|title)\b[^>]*>[\s\S]*?<\/\1>|<!--[\s\S]*?-->/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) ranges.push([m.index, m.index + m[0].length]);
  return ranges;
}

function balancedEnd(html, start, tag) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (/\/>$/.test(m[0]) && !m[1]) continue;
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return -1;
}

/** Every RichTextContainer in parse order: [openStart, openEnd, closeStart]. */
function containers(html) {
  const inert = inertRanges(html);
  const out = [];
  // Containers are usually <div>, but links and buttons carry the role too.
  const re = /<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*data-framer-component-type="RichTextContainer"[^>]*>/gi;
  let r = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    while (r < inert.length && inert[r][1] <= m.index) r++;
    if (r < inert.length && inert[r][0] <= m.index) continue;
    // Some exported markup never closes its container (the browser recovers);
    // those are counted, so indices stay aligned, but never rewritten.
    const tag = m[1].toLowerCase();
    const end = balancedEnd(html, m.index, tag);
    out.push({ open: m.index, inner: m.index + m[0].length, close: end < 0 ? -1 : end - `</${tag}>`.length });
  }
  return out;
}

/** The page with every leaf container's content blanked. */
function skeleton(html) {
  const list = containers(html);
  const leaves = list.filter((c) => c.close >= 0 && !list.some((o) => o.open > c.open && o.open < c.close));
  let out = html;
  for (const c of leaves.reverse()) out = out.slice(0, c.inner) + "\u0000" + out.slice(c.close);
  return out;
}

/** Direct child elements of a container's inner HTML: { tag, start, innerStart, innerEnd, end }. */
function childBlocks(html, from, to) {
  const out = [];
  let at = from;
  while (at < to) {
    const next = html.indexOf("<", at);
    if (next < 0 || next >= to) break;
    if (html.startsWith("<!--", next)) {
      at = html.indexOf("-->", next) + 3;
      continue;
    }
    const m = /^<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/.exec(html.slice(next, to));
    if (!m) break;
    const tag = m[1].toLowerCase();
    const end = balancedEnd(html, next, tag);
    if (end < 0 || end > to) break;
    out.push({ tag, start: next, innerStart: next + m[0].length, innerEnd: end - `</${tag}>`.length, end });
    at = end;
  }
  return out;
}

const RECORD = `
(() => {
  const served = (window.__textServed = []);
  new MutationObserver((records) => {
    if (document.readyState !== "loading") return;
    for (const r of records) for (const n of r.addedNodes) {
      if (n.nodeType !== 1) continue;
      const list = n.matches('[${CONTAINER}]') ? [n] : n.querySelectorAll ? [...n.querySelectorAll('[${CONTAINER}]')] : [];
      for (const el of list) {
        if (el.__textIndex != null) continue;
        el.__textIndex = served.length;
        served.push({});
      }
    }
  }).observe(document, { childList: true, subtree: true });
  const sigOf = (el) => { const names = []; for (let n = el; n && n.id !== "main"; n = n.parentElement) { const v = n.getAttribute && n.getAttribute("data-framer-name"); if (v) names.push(v); } return names.join("<"); };
  const csigOf = (el) => { const out = []; for (let n = el.parentElement; n && n.id !== "main"; n = n.parentElement) { const cls = n.getAttribute("class") || ""; if (/ssr-variant/.test(cls)) continue; const c = cls.split(/\\s+/).find((t) => /^framer-/.test(t) && !/^framer-v-/.test(t)); if (c) out.push(c); } return out.join("<"); };
  let marked = false;
  function mark() {
    if (marked) return;
    marked = true;
    const counts = {};
    for (const el of document.querySelectorAll('#main [${CONTAINER}]')) {
      if (el.__textIndex == null) continue;
      const entry = served[el.__textIndex];
      entry.key = el.getAttribute("class") || "";
      entry.visible = el.getClientRects().length > 0;
      entry.text = (el.textContent || "").replace(/\\s+/g, " ").trim();
      entry.sig = sigOf(el);
      entry.csig = csigOf(el);
      if (entry.visible) entry.ordinal = (counts[entry.key] = (counts[entry.key] || 0) + 1) - 1;
    }
  }
  let snap;
  Object.defineProperty(window, "__ainfImgSnap", {
    configurable: true,
    get: () => snap,
    set: (fn) => { snap = function () { mark(); return fn.apply(this, arguments); }; },
  });
  addEventListener("load", mark);
})();`;

const SETTLED = `(() => {
  const sigOf = (el) => { const names = []; for (let n = el; n && n.id !== "main"; n = n.parentElement) { const v = n.getAttribute && n.getAttribute("data-framer-name"); if (v) names.push(v); } return names.join("<"); };
  const csigOf = (el) => { const out = []; for (let n = el.parentElement; n && n.id !== "main"; n = n.parentElement) { const cls = n.getAttribute("class") || ""; if (/ssr-variant/.test(cls)) continue; const c = cls.split(/\\s+/).find((t) => /^framer-/.test(t) && !/^framer-v-/.test(t)); if (c) out.push(c); } return out.join("<"); };
  const counts = {};
  const out = {};
  for (const el of document.querySelectorAll('#main [${CONTAINER}]')) {
    if (!el.getClientRects().length) continue;
    const key = el.getAttribute("class") || "";
    const ordinal = (counts[key] = (counts[key] || 0) + 1) - 1;
    out[key + "#" + ordinal] = {
      text: (el.textContent || "").replace(/\\s+/g, " ").trim(),
      html: el.innerHTML,
      sig: sigOf(el),
      csig: csigOf(el),
      blocks: [...el.children].map((c) => ({ tag: c.tagName.toLowerCase(), html: c.innerHTML, text: c.textContent || "" })),
    };
  }
  return out;
})()`;

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

const escapeText = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\u00a0/g, "&nbsp;");
const animated = (html) => /style="[^"]*(?:opacity:\s*0\.0|translate|blur\()/.test(html) || /display:\s*inline-block/.test(html);
const ours = (html) => /ainf/i.test(html);
const norm = (t) => t.replace(/\s+/g, " ").trim();
/** textContent of a markup fragment. */
const plain = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, "\u00a0")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const browser = await chromium.launch({ executablePath });
let written = 0;
for (const id of pages()) {
  const file = path.join(HTML_DIR, `${id}.html`);
  const source = readFileSync(file, "utf8");
  const decisions = new Map();
  const notes = [];
  let servedCount = -1;
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    await page.addInitScript(RECORD);
    await page.goto(base + routeFor(id), { waitUntil: "domcontentloaded", timeout: 120000 });
    await settle(page);
    const served = await page.evaluate(() => window.__textServed);
    const settled = await page.evaluate(SETTLED);
    await context.close();
    servedCount = served.length;
    served.forEach((entry, index) => {
      if (!entry.visible || entry.ordinal == null) return;
      const final = settled[entry.key + "#" + entry.ordinal];
      if (!final || final.text === entry.text) return;
      // Same class and position is not enough (buttons and labels share classes);
      // the layer path must match too, and a served label is never blanked.
      // Layer names change when a designer renames a layer; the class path does not.
      if (final.sig !== entry.sig && final.csig !== entry.csig) {
        notes.push(`layers #${index}: "${entry.text.slice(0, 40)}" vs "${final.text.slice(0, 40)}" (${vp.name})`);
        return;
      }
      if (!final.text) return;
      const prev = decisions.get(index);
      if (prev && prev.text !== final.text) notes.push(`conflict #${index}: "${prev.text.slice(0, 40)}" vs "${final.text.slice(0, 40)}" (${vp.name})`);
      else decisions.set(index, { ...final, from: entry.text });
    });
  }
  const list = containers(source);
  if (servedCount >= 0 && list.length !== servedCount) {
    console.log(`${id}: SKIPPED, ${list.length} containers in source vs ${servedCount} parsed`);
    continue;
  }
  let html = source;
  let changed = 0;
  for (const index of [...decisions.keys()].sort((a, b) => b - a)) {
    const want = decisions.get(index);
    const c = list[index];
    // Ticker <li> containers hold <div> containers. Only leaves are rewritten,
    // so no two edits overlap and source offsets stay valid edit to edit.
    if (c.close >= 0 && list.some((other, j) => j !== index && other.open > c.open && other.open < c.close)) {
      notes.push(`nested #${index}: "${want.from.slice(0, 40)}" left to its inner containers`);
      continue;
    }
    // Rich text never holds Framer layers. A container that does was left
    // unclosed in the export and swallowed what follows (the browser parses it
    // the same way); rewriting it would delete that content.
    if (c.close >= 0 && /data-framer-name=|data-framer-component-type=|<section\b|ticker-item/.test(source.slice(c.inner, c.close))) {
      notes.push(`malformed #${index}: "${want.from.slice(0, 40)}" wraps page structure`);
      continue;
    }
    // The range must hold exactly what the browser showed for this container.
    const sourceText = c.close < 0 ? null : plain(source.slice(c.inner, c.close));
    if (sourceText == null || norm(sourceText) !== norm(want.from)) {
      notes.push(`range #${index}: "${want.from.slice(0, 40)}" not where expected`);
      continue;
    }
    const blocks = childBlocks(source, c.inner, c.close);
    const fits = blocks.length === want.blocks.length && blocks.every((b, i) => b.tag === want.blocks[i].tag);
    let inner = null;
    if (fits) {
      const parts = [];
      let cursor = c.inner;
      blocks.forEach((b, i) => {
        const settled = want.blocks[i];
        const current = source.slice(b.innerStart, b.innerEnd);
        let body = current;
        if (norm(settled.text) !== norm(plain(current))) {
          // Letter-split headings keep their spans (the entrance animation needs them).
          if (animated(current) || animated(settled.html)) {
            notes.push(`animated #${index}: "${want.from.slice(0, 40)}" -> "${want.text.slice(0, 40)}"`);
          } else {
            body = ours(settled.html) ? escapeText(settled.text) : settled.html;
          }
        }
        parts.push(source.slice(cursor, b.innerStart), body);
        cursor = b.innerEnd;
      });
      parts.push(source.slice(cursor, c.close));
      inner = parts.join("");
    } else if (!ours(want.html) && !animated(want.html)) {
      inner = want.html;
    } else {
      notes.push(`shape #${index}: "${want.from.slice(0, 40)}" -> "${want.text.slice(0, 40)}"`);
    }
    if (inner == null || inner === source.slice(c.inner, c.close)) continue;
    if (args.includes("--verbose")) console.log(`  #${index}: "${want.from.slice(0, 70)}"
      -> "${want.text.slice(0, 70)}"`);
    html = html.slice(0, c.inner) + inner + html.slice(c.close);
    changed++;
  }
  // Only the inside of leaf containers may change: with those blanked out,
  // the page before and after must be byte-identical. Anything else is a bug.
  if (skeleton(html) !== skeleton(source)) throw new Error(`${id}: markup outside text containers changed, refusing to write`);
  // And no layer markup may disappear with them.
  const layers = (text) => (text.match(/data-framer-name=|<li\b|<section\b|<img\b/g) || []).length;
  if (layers(html) !== layers(source)) throw new Error(`${id}: layer markup count changed (${layers(source)} -> ${layers(html)}), refusing to write`);
  console.log(`${id}: ${changed} container(s) ${dry ? "would change" : "baked"}${notes.length ? `, ${notes.length} note(s)` : ""}`);
  for (const n of notes.slice(0, 30)) console.log(`  ${n}`);
  if (changed && !dry) {
    writeFileSync(file, html);
    written++;
  }
}
await browser.close();
console.log(`${written} page(s) written${dry ? " (dry run)" : ""}.`);
