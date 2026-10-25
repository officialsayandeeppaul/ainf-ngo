import { readFileSync, statSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import path from "node:path";
import { runtimeAssetScript, versionAssetRefs } from "./asset-version";
import { FIELD_OK, FIELD_PHOTOS, FIELD_POOL } from "./field-photos";
import { imageGuardScript } from "./image-guard";

const pageCache = new Map<string, { mtime: number; buf: Buffer }>();
// Pages are rebuilt from source on every request in development, so edits to
// the HTML or to the scripts it versions show up without a restart.
const cachePages = process.env.NODE_ENV === "production";

const PAGE_ID = /^[a-z0-9/_-]+$/i;

// No cache-control: Next derives it from each route's segment config (static
// or ISR), and vercel.json pins the static pages' browser/CDN policy.
const HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "content-encoding": "gzip",
  "netlify-cdn-cache-control": "public, durable, max-age=31536000, stale-while-revalidate=86400",
  vary: "accept-encoding",
};

const BLOG_BOOT =
  'classList.add("ainf-shared-nav","ainf-booting");if(/\\/blogs\\/[^/?#]+/.test(location.pathname))document.documentElement.classList.add("ainf-blog-title")';

const CONTENT_ALT =
  /(?:Cause Image|Missions Image|Blog Image|Gallery Image|Team Image|Ticker Image|CTA Image|About Image|About Hero Image|Testimonial Image|Join as Field Sevak Image|How you can help image|Statastic Image Left|Statastic Image Right|man in black and white adidas hoodie|shallow focus photography of woman outdoor during day|woman in blue crew neck shirt|two men wearing masks and holding a bag of food)/;

/** srcset still points at Hopper stock, so the browser paints that instead of the field photo. */
function pinContentPhotos(html: string): string {
  let n = 0;
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const alt = (/alt="([^"]*)"/i.exec(tag) || [])[1] || "";
    if (!CONTENT_ALT.test(alt)) return tag;
    let next = tag.replace(/\s+srcset="[^"]*"/gi, "").replace(/\s+sizes="[^"]*"/gi, "");
    const src = (/src="([^"]+)"/i.exec(next) || [])[1] || "";
    const base = src.split("?")[0];
    let use = base;
    if (!FIELD_OK.test(base)) {
      use = FIELD_POOL[n % FIELD_POOL.length];
      n += 1;
    }
    if (/\ssrc="/i.test(next)) next = next.replace(/\ssrc="[^"]*"/i, ` src="${use}"`);
    else next = next.replace(/<img\b/i, `<img src="${use}"`);
    return next;
  });
}

function useFieldPhotos(html: string): string {
  let next = html;
  for (const from of Object.keys(FIELD_PHOTOS)) {
    if (next.includes(from)) next = next.split(from).join(FIELD_PHOTOS[from]);
  }
  return next;
}

function deferStylesheet(html: string, file: string): string {
  const re = new RegExp(`<link rel="stylesheet" href="([^"]*${file}[^"]*)"([^>]*)>`, "g");
  return html.replace(re, (full, href, rest) => {
    if (String(rest).includes("media=")) return full;
    return `<link rel="stylesheet" href="${href}"${rest} media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="${href}"></noscript>`;
  });
}

/** Keep the first paint free of the Framer graph, the clip, and secondary CSS. */
function speedPass(html: string): string {
  let next = html.replace(/<link rel="modulepreload"[^>]*>/g, "");
  next = deferStylesheet(next, "ainf-motion.css");
  next = deferStylesheet(next, "home-i18n.css");
  next = next.replace(
    /(<video\b[^>]*?)\s+src="(\/assets\/img\/hero-clip\.mp4)"/g,
    '$1 data-ainf-video="$2" preload="none"'
  );
  next = next.replace(
    /<script type="module" async(?:=\"\")? data-framer-bundle="main" fetchpriority="low" src="([^"]+)"><\/script>/g,
    '<script id="ainf-defer-framer">addEventListener("load",function(){var start=function(){document.querySelectorAll("video[data-ainf-video]").forEach(function(v){if(!v.getAttribute("src"))v.src=v.getAttribute("data-ainf-video")});var s=document.createElement("script");s.type="module";s.src="$1";document.body.appendChild(s)};if(window.requestIdleCallback)requestIdleCallback(start,{timeout:900});else setTimeout(start,1)});</script>'
  );
  next = flattenSplitHeadings(next);
  next = labelFormFields(next);
  next = next.replace(
    /(<img\b[^>]*alt="(?:About Hero Image|Gallery Image|Testimonial Image|Team Image)"[^>]*)\sloading="lazy"/gi,
    "$1"
  );
  if (!next.includes('id="ainf-stock-guard"') && next.includes('ainf-blog-title");</script>')) {
    // The CSS half hides any stock photo the guard has not reached yet.
    const guard =
      '</script><style id="ainf-stock-guard">img[src*="0487bff6130e818d"],img[src*="d192de88013602fb"],img[src*="b5b56d9dac67f37b"],img[src*="0a0f47967bab9e6d"],img[src*="44e14d52cea980eb"],img[src*="9a7dcfc123be0a1d"],img[src*="bfbb8033078ef4ec"],img[src*="5d4f22904b272be4"],img[src*="76cc0f24d728b77e"],img[src*="36be58b3f0aa6698"],img[src*="479af4ed1ca6b4fe"],img[src*="e2a751b041c6c192"]{visibility:hidden!important}</style>';
    next = next.replace('ainf-blog-title");</script>', 'ainf-blog-title");' + guard);
  }
  return next;
}

/**
 * The hero photo is full-bleed at every width, but most pages declared
 * sizes="calc(100vw - 40px)", so phones picked a file narrower than they show
 * (blurry, and when Framer re-rendered the hero Chrome swapped in the sharper
 * cached file and logged a second, late LCP). The <head> preload also named
 * one fixed file, which most phones then never used. Declare the real width
 * and preload the same srcset the image will choose from.
 */
function alignHeroImage(html: string): string {
  let heroSrcset = "";
  let next = html.replace(/<img\b[^>]*\balt="Hero BG"[^>]*>/gi, (tag) => {
    if (!heroSrcset) heroSrcset = (/\ssrcset="([^"]+)"/i.exec(tag) || [])[1] || "";
    return /\ssizes="/i.test(tag) ? tag.replace(/\ssizes="[^"]*"/i, ' sizes="100vw"') : tag;
  });
  if (!heroSrcset) return next;
  next = next.replace(
    /<link rel="preload" as="image" href="([^"]+)" fetchpriority="high">/i,
    (link, href: string) =>
      heroSrcset.includes(href)
        ? `<link rel="preload" as="image" href="${href}" imagesrcset="${heroSrcset}" imagesizes="100vw" fetchpriority="high">`
        : link
  );
  return next;
}

/**
 * Onest (400 and 700) is declared font-display: optional, so it must be in hand
 * by the first layout: a page that paints in the fallback keeps it, and when
 * Framer re-renders a section in Onest the text reflows. The marketing pages
 * already preload both files; the project pages did not.
 */
const ONEST_FILES = ["/assets/fonts/0b532b340381e255.woff2", "/assets/fonts/98a11855328341d1.woff2"];

function preloadBrandFont(html: string): string {
  const missing = ONEST_FILES.filter((file) => !html.includes(`rel="preload" as="font" type="font/woff2" href="${file}"`));
  if (!missing.length) return html;
  const links = missing.map((file) => `<link rel="preload" as="font" type="font/woff2" href="${file}" crossorigin>`).join("");
  return html.replace(/<meta charset="utf-8">/i, (tag) => tag + links);
}

/** First thing in <head>: nothing may set an <img> URL before the guard is in place. */
function installImageGuard(html: string): string {
  if (html.includes('id="ainf-img-guard"')) return html;
  const guard = imageGuardScript();
  const charset = /<meta charset="utf-8">/i;
  if (charset.test(html)) return html.replace(charset, (tag) => tag + guard);
  return html.replace(/<head>/i, (tag) => tag + guard);
}

/** Hero titles ship as one nowrap line of letters, so they slice through the photo until Framer runs. */
function flattenSplitHeadings(html: string): string {
  return html.replace(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/gi, (full, attrs, inner) => {
    if (!/inline-block/.test(inner) || !/opacity:0\.001/.test(inner)) return full;
    const parts = [
      ...inner.matchAll(/<span\b[^>]*display:\s*inline-block[^>]*>([^<]*)<\/span>/gi),
    ].map((m) => m[1].replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&"));
    if (parts.length < 8) return full;
    const text = inner
      .replace(/<span\b[^>]*>/gi, "")
      .replace(/<\/span>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;|&#160;|&amp;/g, (s: string) => (s === "&amp;" ? "&" : " "))
      .replace(/ /g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<h1${attrs}>${safe}</h1>`;
  });
}

/** Name, email, phone, and message ship with a placeholder only. */
function labelFormFields(html: string): string {
  return html.replace(/<(input|textarea|select)\b([^>]*?)(\/?)>/gi, (full, tag, attrs, slash) => {
    if (/aria-label=|aria-labelledby=|aria-hidden=/i.test(attrs)) return full;
    if (/type\s*=\s*"(?:hidden|submit|button|checkbox|radio)"/i.test(attrs)) return full;
    const ph = /placeholder="([^"]*)"/i.exec(attrs);
    const name = /name="([^"]*)"/i.exec(attrs);
    const label = (ph && ph[1]) || (name && name[1]) || "";
    if (!label) return full;
    const safe = label.replace(/"/g, "&quot;");
    return `<${tag}${attrs} aria-label="${safe}"${slash}>`;
  });
}

function withEarlyBlogClass(html: string): string {
  const needle = 'classList.add("ainf-shared-nav","ainf-booting")';
  let next = html;
  if (next.includes(needle) && !next.includes("ainf-blog-title")) {
    next = next.replace(needle, BLOG_BOOT);
  }
  next = next.replace(
    /<link rel="preload" href="\/i18n\/home-strings\.json" as="fetch" crossorigin>/g,
    ""
  );
  next = next.replace(
    'id="ainf-page-boot-css">',
    'id="ainf-page-boot-css"><style id="ainf-hide-template-nav">body.ainf-shared-nav header.framer-V9hqN,body.ainf-shared-nav header[data-framer-name="Phone"],body.ainf-shared-nav header[data-framer-name="Tablet"],body.ainf-shared-nav header[data-framer-name="Desktop"]{display:none!important}</style>'
  );
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  if (/^pk_(test|live)_[A-Za-z0-9_+=/-]+$/.test(clerkKey)) {
    next = next.replace('id="ainf-site-nav-js"', `id="ainf-site-nav-js" data-clerk-key="${clerkKey}"`);
  }
  next = useFieldPhotos(next);
  next = pinContentPhotos(next);
  next = speedPass(next);
  next = alignHeroImage(next);
  next = preloadBrandFont(next);
  next = installImageGuard(next);
  next = versionAssetRefs(next);
  if (!next.includes('id="ainf-asset-v"')) {
    next = next.replace(/<\/head>/i, (tag) => runtimeAssetScript() + tag);
  }
  return next;
}

export function serveFramerPage(pageId: string, transform?: (html: string) => string) {
  if (!PAGE_ID.test(pageId)) {
    return new Response("Not found", { status: 404 });
  }
  const file = path.join(process.cwd(), "framer-html", `${pageId}.html`);
  const mtime = statSync(file).mtimeMs;
  const hit = cachePages ? pageCache.get(pageId) : undefined;
  let buf = hit && hit.mtime === mtime ? hit.buf : null;
  if (!buf) {
    buf = gzipSync(Buffer.from(withEarlyBlogClass(readFileSync(file, "utf8")), "utf8"));
    if (cachePages) pageCache.set(pageId, { mtime, buf });
  }
  if (transform) {
    const html = gunzipSync(buf).toString("utf8");
    buf = gzipSync(Buffer.from(transform(html), "utf8"));
  }
  return new Response(new Uint8Array(buf), { headers: HEADERS });
}
