import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Content-derived `?v=` for the site's own scripts, stylesheets, and i18n files.
 *
 * Those files keep stable names, so the CDN and browsers may only cache them
 * long-term under a version that changes exactly when the file does. Hand-kept
 * version strings drifted (one file was requested as ?v=17 and ?v=18 on
 * different pages) and let stale scripts outlive deploys.
 *
 * A file that cannot be read keeps whatever reference it had, so a missing
 * trace include degrades to revalidation rather than to a broken page.
 */

const REF = /\b(src|href)="(\/(?:assets\/(?:js|css)|i18n)\/[A-Za-z0-9._-]+\.(?:js|css|json))(?:\?v=[^"]*)?"/g;

/** Files that scripts load at runtime, so their URLs never pass through the HTML. */
export const RUNTIME_ASSETS = [
  "/assets/css/ainf-site-footer.css",
  "/assets/css/ainf-projects-theme.css",
  "/assets/js/ainf-footer-template.js",
  "/assets/js/ainf-site-footer.js",
  "/assets/js/ainf-projects-theme.js",
  "/i18n/home-strings.json",
];

const memo = new Map<string, string | null>();
const memoize = process.env.NODE_ENV === "production";

function read(rel: string): Buffer {
  const name = path.basename(rel);
  // One literal directory per call keeps output tracing to these folders,
  // instead of a wildcard over all of public/ (images included).
  if (rel.startsWith("/assets/js/")) return readFileSync(path.join(process.cwd(), "public/assets/js", name));
  if (rel.startsWith("/assets/css/")) return readFileSync(path.join(process.cwd(), "public/assets/css", name));
  return readFileSync(path.join(process.cwd(), "public/i18n", name));
}

export function assetVersion(rel: string): string | null {
  if (memoize && memo.has(rel)) return memo.get(rel) ?? null;
  let version: string | null = null;
  try {
    version = createHash("sha1").update(read(rel)).digest("hex").slice(0, 10);
  } catch {
    version = null;
  }
  if (memoize) memo.set(rel, version);
  return version;
}

export function versionedUrl(rel: string): string {
  const version = assetVersion(rel);
  return version ? `${rel}?v=${version}` : rel;
}

/** Rewrites every own-asset src/href in a document to its content version. */
export function versionAssetRefs(html: string): string {
  return html.replace(REF, (full, attr: string, rel: string) => {
    const version = assetVersion(rel);
    return version ? `${attr}="${rel}?v=${version}"` : full;
  });
}

/** `window.__ainfAssetV` for scripts that load RUNTIME_ASSETS themselves. */
export function runtimeAssetScript(): string {
  const map: Record<string, string> = {};
  for (const rel of RUNTIME_ASSETS) {
    const version = assetVersion(rel);
    if (version) map[rel] = version;
  }
  return `<script id="ainf-asset-v">window.__ainfAssetV=${JSON.stringify(map)};${EARLY_STRINGS}</script>`;
}

/**
 * For a visitor who chose Hindi or Bengali (the head script has set <html lang> and
 * the `ainf-i18n-wait` class that hides #main), start downloading the strings while
 * the page is still parsing instead of after the deferred i18n script runs, so the
 * page can appear already translated. Never keep it hidden longer than 1.5 s.
 */
const EARLY_STRINGS =
  'try{var l=document.documentElement.lang;if(l==="hi"||l==="bn"){var v=window.__ainfAssetV["/i18n/home-strings.json"];' +
  'window.__ainfStrings=fetch("/i18n/home-strings.json"+(v?"?v="+v:"")).then(function(r){if(!r.ok)throw new Error("Failed to load translations");return r.json()});' +
  'window.__ainfStrings.catch(function(){});' +
  'setTimeout(function(){document.documentElement.classList.remove("ainf-i18n-wait")},1500)}}catch(e){}';
