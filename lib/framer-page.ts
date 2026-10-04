import { readFileSync, statSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import path from "node:path";

const gzCache = new Map<string, { mtime: number; buf: Buffer }>();

const PAGE_ID = /^[a-z0-9/_-]+$/i;

const HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "content-encoding": "gzip",
  "cache-control": "no-cache, must-revalidate",
  "netlify-cdn-cache-control": "public, durable, max-age=31536000, stale-while-revalidate=86400",
  vary: "accept-encoding",
};

const BLOG_BOOT =
  'classList.add("ainf-shared-nav","ainf-booting");if(/\\/blogs\\/[^/?#]+/.test(location.pathname))document.documentElement.classList.add("ainf-blog-title")';

/** Hopper stock and green placeholder textures. First paint must be field photos. */
const FIELD_PHOTOS: Record<string, string> = {
  "/assets/img/0487bff6130e818d.webp": "/assets/img/hero-third/518fb7f61a5e6510.webp",
  "/assets/img/d192de88013602fb.webp": "/assets/img/hero-third/4a27119994acc349.webp",
  "/assets/img/b5b56d9dac67f37b.webp": "/assets/img/hero-third/1b892b571234582c.webp",
  "/assets/img/0a0f47967bab9e6d.webp": "/assets/img/hero-third/97kub697kub697ku.webp",
  "/assets/img/44e14d52cea980eb.webp": "/assets/img/hero-third/9fzzlw9fzzlw9fzz.webp",
  "/assets/img/0857298f70c123c5.webp": "/assets/img/hero-third/518fb7f61a5e6510.webp",
  "/assets/img/6c95afd2aa3c890c.webp": "/assets/img/hero-third/518fb7f61a5e6510.webp",
  "/assets/img/e2a751b041c6c192.webp": "/assets/img/home-sixth/83d7f3cef733d28c.webp",
  "/assets/img/78ea5a23abe80a75.webp": "/assets/img/home-sixth/ce25dc676c029d0e.webp",
  "/assets/img/352a75abd7f4e260.webp": "/assets/img/home-sixth/395d6ceebb97e0ae.webp",
  "/assets/img/b1b56374785c59d9.webp": "/assets/img/7d52ebcc5c881e07.webp",
  "/assets/img/7d66b1c9fbde3d23.webp": "/assets/img/46ca7b057fe54d13.webp",
  "/assets/img/e8fe459b69dfaec5.webp": "/assets/img/1d477190300d27a6.webp",
  "/assets/img/1bbfd4c5ea913fd5.webp": "/assets/img/7fb7552621c79350.webp",
  "/assets/img/83d7f3cef733d28c.webp": "/assets/img/hero-third/571e61ddc71daaf0.webp",
  "/assets/img/9a7dcfc123be0a1d.webp": "/assets/img/people/imran-ansari.webp",
  "/assets/img/bfbb8033078ef4ec.webp": "/assets/img/people/amit-hazra.webp",
  "/assets/img/5d4f22904b272be4.webp": "/assets/img/people/birsa-murmu.webp",
  "/assets/img/76cc0f24d728b77e.webp": "/assets/img/people/ravi-hembram.webp",
  "/assets/img/36be58b3f0aa6698.webp": "/assets/img/people/imran-ansari.webp",
  "/assets/img/479af4ed1ca6b4fe.webp": "/assets/img/people/amit-hazra.webp",
  "/assets/img/home-sixth/1fd7ff27ace510a1.webp": "/assets/img/home-sixth/ce25dc676c029d0e.webp",
  "/assets/img/f425f98d63a816cb.webp": "/assets/img/hero-third/518fb7f61a5e6510.webp",
  "/assets/img/e04b2b629278096d.webp": "/assets/img/hero-third/4a27119994acc349.webp",
  "/assets/img/bd505e9df8be5ad6.webp": "/assets/img/hero-third/1b892b571234582c.webp",
  "/assets/img/044b758cc6c7b6ed.webp": "/assets/img/hero-third/97kub697kub697ku.webp",
  "/assets/img/f4fba5e30fcc3d0e.webp": "/assets/img/hero-third/9fzzlw9fzzlw9fzz.webp",
  "/assets/img/f7bb1c851e6c3805.webp": "/assets/img/hero-third/1b0ac308d87a6dbd.webp",
  "/assets/img/b101906ab3a6b5c6.webp": "/assets/img/7d52ebcc5c881e07.webp",
  "/assets/img/ca7ebd72f33229a1.webp": "/assets/img/home-sixth/395d6ceebb97e0ae.webp",
  "/assets/img/155118808d02a13b.webp": "/assets/img/home-sixth/83d7f3cef733d28c.webp",
  "/assets/img/58ddd402fa0fc24e.webp": "/assets/img/people/birsa-murmu.webp",
  "/assets/img/667a7de97aa3c5df.webp": "/assets/img/people/ravi-hembram.webp",
  "/assets/img/0cb36a2e191493c5.webp": "/assets/img/people/imran-ansari.webp",
  "/assets/img/124a9e9812a2f717.webp": "/assets/img/people/amit-hazra.webp",
  "/assets/img/home-fifth/667a7de97aa3c5df.webp": "/assets/img/people/birsa-murmu.webp",
  "/assets/img/home-fifth/0cb36a2e191493c5.webp": "/assets/img/people/ravi-hembram.webp",
  "/assets/img/home-fifth/58ddd402fa0fc24e.webp": "/assets/img/people/imran-ansari.webp",
  "/assets/img/home-fifth/74f91bf4bd093efb.webp": "/assets/img/people/amit-hazra.webp",
};

const FIELD_POOL = [
  "/assets/img/hero-third/518fb7f61a5e6510.webp",
  "/assets/img/hero-third/4a27119994acc349.webp",
  "/assets/img/hero-third/1b892b571234582c.webp",
  "/assets/img/hero-third/97kub697kub697ku.webp",
  "/assets/img/hero-third/9fzzlw9fzzlw9fzz.webp",
  "/assets/img/hero-third/1b0ac308d87a6dbd.webp",
  "/assets/img/hero-third/571e61ddc71daaf0.webp",
  "/assets/img/home-sixth/ce25dc676c029d0e.webp",
  "/assets/img/home-sixth/395d6ceebb97e0ae.webp",
  "/assets/img/home-sixth/83d7f3cef733d28c.webp",
  "/assets/img/7d52ebcc5c881e07.webp",
  "/assets/img/46ca7b057fe54d13.webp",
  "/assets/img/1d477190300d27a6.webp",
  "/assets/img/7fb7552621c79350.webp",
];
const FIELD_OK =
  /518fb7f61a5e6510|4a27119994acc349|ce25dc676c029d0e|1b892b571234582c|97kub697kub697ku|9fzzlw9fzzlw9fzz|1b0ac308d87a6dbd|571e61ddc71daaf0|395d6ceebb97e0ae|home-sixth\/83d7f3cef733d28c|7d52ebcc5c881e07|46ca7b057fe54d13|1d477190300d27a6|7fb7552621c79350|\/people\/(?:imran-ansari|amit-hazra|birsa-murmu|ravi-hembram)/;
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
    const busted = `${use}?ainf=20260927b`;
    if (/\ssrc="/i.test(next)) next = next.replace(/\ssrc="[^"]*"/i, ` src="${busted}"`);
    else next = next.replace(/<img\b/i, `<img src="${busted}"`);
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
  if (!next.includes('id="ainf-stock-guard"')) {
    const guard =
      '</script><style id="ainf-stock-guard">img[src*="0487bff6130e818d"],img[src*="d192de88013602fb"],img[src*="b5b56d9dac67f37b"],img[src*="0a0f47967bab9e6d"],img[src*="44e14d52cea980eb"],img[src*="9a7dcfc123be0a1d"],img[src*="bfbb8033078ef4ec"],img[src*="5d4f22904b272be4"],img[src*="76cc0f24d728b77e"],img[src*="36be58b3f0aa6698"],img[src*="479af4ed1ca6b4fe"],img[src*="e2a751b041c6c192"]{visibility:hidden!important}</style><script id="ainf-stock-guard-js">' +
      STOCK_GUARD_JS +
      "</script>";
    if (next.includes('ainf-blog-title");</script>')) {
      next = next.replace('ainf-blog-title");</script>', 'ainf-blog-title");' + guard);
    }
  }
  return next;
}

const STOCK_GUARD_JS =
  '(function(){var m={"0487bff6130e818d":"/assets/img/hero-third/518fb7f61a5e6510.webp","d192de88013602fb":"/assets/img/hero-third/4a27119994acc349.webp","b5b56d9dac67f37b":"/assets/img/hero-third/1b892b571234582c.webp","0a0f47967bab9e6d":"/assets/img/hero-third/97kub697kub697ku.webp","44e14d52cea980eb":"/assets/img/hero-third/9fzzlw9fzzlw9fzz.webp","9a7dcfc123be0a1d":"/assets/img/people/imran-ansari.webp","bfbb8033078ef4ec":"/assets/img/people/amit-hazra.webp","5d4f22904b272be4":"/assets/img/people/birsa-murmu.webp","76cc0f24d728b77e":"/assets/img/people/ravi-hembram.webp","36be58b3f0aa6698":"/assets/img/people/imran-ansari.webp","479af4ed1ca6b4fe":"/assets/img/people/amit-hazra.webp","e2a751b041c6c192":"/assets/img/home-sixth/83d7f3cef733d28c.webp"};var re=/0487bff6130e818d|d192de88013602fb|b5b56d9dac67f37b|0a0f47967bab9e6d|44e14d52cea980eb|9a7dcfc123be0a1d|bfbb8033078ef4ec|5d4f22904b272be4|76cc0f24d728b77e|36be58b3f0aa6698|479af4ed1ca6b4fe|e2a751b041c6c192/;function fix(img){var s=(img.getAttribute("src")||"")+(img.getAttribute("srcset")||"");if(!re.test(s))return;for(var k in m){if(s.indexOf(k)<0)continue;img.removeAttribute("srcset");img.setAttribute("src",m[k]+"?ainf=20260927b");var w=img.parentElement;if(w&&w.style)w.style.backgroundImage="none";break;}}function scan(n){if(!n)return;if(n.tagName==="IMG")fix(n);if(!n.querySelectorAll)return;var list=n.querySelectorAll("img");for(var i=0;i<list.length;i++)fix(list[i]);}new MutationObserver(function(rs){for(var i=0;i<rs.length;i++){var r=rs[i];if(r.type==="attributes"&&r.target&&r.target.tagName==="IMG")fix(r.target);var a=r.addedNodes;for(var j=0;j<a.length;j++)scan(a[j]);}}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["src","srcset"]});})();';

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
      .replace(/\u00a0/g, " ")
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

function withEarlyBlogClass(buf: Buffer): Buffer {
  let html = "";
  let gzipped = true;
  try {
    html = gunzipSync(buf).toString("utf8");
  } catch {
    gzipped = false;
    html = buf.toString("utf8");
  }
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
    'href="/assets/css/ainf-page-boot.css"',
    'href="/assets/css/ainf-page-boot.css?v=20261003h"'
  );
  next = next.replace(
    'href="/assets/css/ainf-site-nav.css"',
    'href="/assets/css/ainf-site-nav.css?v=20261003a"'
  );
  next = next.replace(
    'id="ainf-page-boot-css">',
    'id="ainf-page-boot-css"><style id="ainf-hide-template-nav">body.ainf-shared-nav header.framer-V9hqN,body.ainf-shared-nav header[data-framer-name="Phone"],body.ainf-shared-nav header[data-framer-name="Tablet"],body.ainf-shared-nav header[data-framer-name="Desktop"]{display:none!important}</style>'
  );
  next = next.replace(
    'href="/assets/css/ainf-motion.css"',
    'href="/assets/css/ainf-motion.css?v=20260926k"'
  );
  next = next.replace(
    'src="/assets/js/ainf-page-boot.js"',
    'src="/assets/js/ainf-page-boot.js?v=20261004c"'
  );
  next = next.replace(
    'src="/assets/js/ainf-site-nav.js"',
    'src="/assets/js/ainf-site-nav.js?v=20261003d"'
  );
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  if (/^pk_(test|live)_[A-Za-z0-9_+=/-]+$/.test(clerkKey)) {
    next = next.replace('id="ainf-site-nav-js"', `id="ainf-site-nav-js" data-clerk-key="${clerkKey}"`);
  }
  next = next.replace(
    'href="/assets/css/ainf-site-footer.css"',
    'href="/assets/css/ainf-site-footer.css?v=20260926w"'
  );
  next = next.replace(
    'src="/assets/js/ainf-projects-theme.js"',
    'src="/assets/js/ainf-projects-theme.js?v=17"'
  );
  next = next.replace(
    'src="/i18n/home-i18n.js"',
    'src="/i18n/home-i18n.js?v=20261003c"'
  );
  next = useFieldPhotos(next);
  next = pinContentPhotos(next);
  next = speedPass(next);
  if (next === html) return gzipped ? buf : gzipSync(buf);
  return gzipSync(Buffer.from(next));
}

export function serveFramerPage(pageId: string, transform?: (html: string) => string) {
  if (!PAGE_ID.test(pageId)) {
    return new Response("Not found", { status: 404 });
  }
  const gzFile = path.join(process.cwd(), "framer-html", `${pageId}.html.gz`);
  const htmlFile = path.join(process.cwd(), "framer-html", `${pageId}.html`);
  let mtime = 0;
  try {
    mtime = statSync(gzFile).mtimeMs;
  } catch {
    mtime = statSync(htmlFile).mtimeMs;
  }
  const hit = gzCache.get(pageId);
  let buf = hit && hit.mtime === mtime ? hit.buf : null;
  if (!buf) {
    try {
      buf = readFileSync(gzFile);
    } catch {
      buf = gzipSync(readFileSync(htmlFile));
    }
    buf = withEarlyBlogClass(buf);
    gzCache.set(pageId, { mtime, buf });
  }
  if (transform) {
    const html = gunzipSync(buf).toString("utf8");
    buf = gzipSync(Buffer.from(transform(html), "utf8"));
  }
  return new Response(new Uint8Array(buf), { headers: HEADERS });
}
