#!/usr/bin/env node
/**
 * Apply AINF Hinglish content to all route.ts HTML and framer-site/*.mjs
 * Usage: node scripts/apply-ainf-content.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MANIFEST = JSON.parse(
  fs.readFileSync(path.join(__dirname, "content/ainf-hinglish.json"), "utf8")
);

function decodeOnce(raw) {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1];
      if (next === "n") {
        out += "\n";
        i += 2;
        continue;
      }
      if (next === "t") {
        out += "\t";
        i += 2;
        continue;
      }
      if (next === "r") {
        out += "\r";
        i += 2;
        continue;
      }
      if (next === '"') {
        out += '"';
        i += 2;
        continue;
      }
      if (next === "\\") {
        out += "\\";
        i += 2;
        continue;
      }
      out += next;
      i += 2;
      continue;
    }
    out += raw[i];
    i++;
  }
  return out;
}

function extractHtml(source) {
  const marker = 'const HTML = "';
  const start = source.indexOf(marker);
  if (start < 0) return null;
  let i = start + marker.length;
  let raw = "";
  while (i < source.length) {
    const ch = source[i];
    // Keep escapes as two chars so we can fully decode below
    if (ch === "\\" && i + 1 < source.length) {
      raw += ch + source[i + 1];
      i += 2;
      continue;
    }
    if (ch === '"') break;
    raw += ch;
    i++;
  }
  // Decode repeatedly so \\\\n and \\n both become real newlines
  let html = raw;
  for (let pass = 0; pass < 5; pass++) {
    const next = decodeOnce(html);
    if (next === html) break;
    html = next;
  }
  return { start, end: i, html };
}

function escapeHtmlConst(html) {
  return html
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function applyReplacements(text, replacements) {
  let out = text;
  for (const [from, to] of replacements) {
    if (from && out.includes(from)) {
      out = out.split(from).join(to);
    }
  }
  return out;
}

function getSpanTemplate(h1Html) {
  const m = h1Html.match(
    /(<span style="display:inline-block;opacity:0\.001[^"]*"[^>]*>)[^<]*(<\/span>)/
  );
  if (m) return { open: m[1], close: m[2] };
  const m2 = h1Html.match(
    /(<span style="display:inline-block[^"]*"[^>]*>)[^<]*(<\/span>)/
  );
  return m2 ? { open: m2[1], close: m2[2] } : null;
}

function buildAnimatedLine(template, text) {
  return [...text]
    .map((ch) => template.open + ch + template.close)
    .join("");
}

function rebuildH1(h1Html, lines) {
  const openTag = h1Html.match(/^<h1[\s\S]*?>/)?.[0];
  if (!openTag) return h1Html;

  const template = getSpanTemplate(h1Html);
  const colorOpen = h1Html.match(
    /<span style="--framer-text-color:[^"]*" class="framer-text">/
  );

  if (!template) {
    return openTag + lines.join("<br>") + "</h1>";
  }

  const lineBlocks = lines.map((line) => {
    const inner = buildAnimatedLine(template, line);
    return `<span style="white-space:nowrap">${inner}</span>`;
  });

  let body = lineBlocks.join("");
  if (lines.length > 1) {
    body = lineBlocks.join('<br class="framer-text">');
  }

  if (colorOpen) {
    body = colorOpen[0] + body + "</span>";
  }

  return openTag + body + "</h1>";
}

function patchH1Titles(html, routeKey) {
  const lines = MANIFEST.h1Titles[routeKey];
  if (!lines) return html;
  return html.replace(/<h1[\s\S]*?<\/h1>/g, (h1) => rebuildH1(h1, lines));
}

const THEAINF_LOGO_INNER = `id="svg-136069397_6312" role="img" aria-label="theainf — All Indian Nevarlands Foundation"><circle cx="14.2" cy="14.94" r="12.2" fill="none" stroke="var(--token-7e762acf-8506-4626-8fd0-26eadf01dbe6, rgb(15, 51, 43))" stroke-width="2.1"></circle><path d="M14.2 3.2 A11.7 11.7 0 0 1 25.4 18.5" fill="none" stroke="var(--token-e3f77d53-9b12-48ea-9c29-327ba647a7e2, rgb(201, 132, 42))" stroke-width="2.1" stroke-linecap="round"></path><path d="M14.2 5.2 L16.1 8.1 L14.2 7.4 L12.3 8.1 Z" fill="var(--token-7e762acf-8506-4626-8fd0-26eadf01dbe6, rgb(15, 51, 43))"></path><path d="M14.2 22.8 C14.2 20.6 15.6 19.2 17.2 18.8 C15.5 19.6 14.6 21.2 14.2 22.8 C13.8 21.2 12.9 19.6 11.2 18.8 C12.8 19.2 14.2 20.6 14.2 22.8 Z" fill="var(--token-e3f77d53-9b12-48ea-9c29-327ba647a7e2, rgb(47, 107, 85))"></path><path d="M12.4 23.4 Q14.2 24.2 16 23.4" fill="none" stroke="var(--token-7e762acf-8506-4626-8fd0-26eadf01dbe6, rgb(15, 51, 43))" stroke-width="1.2" stroke-linecap="round"></path><text x="33.5" y="19.6" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="15.5" font-weight="700" letter-spacing="-0.4" fill="var(--token-7e762acf-8506-4626-8fd0-26eadf01dbe6, rgb(34, 34, 34))">theainf</text><text x="101.5" y="19.2" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="7.2" font-weight="600" letter-spacing="0.8" fill="var(--token-e3f77d53-9b12-48ea-9c29-327ba647a7e2, rgb(201, 132, 42))">AINF</text>`;

function patchLogo(html) {
  return html.replace(
    /<svg[^>]*id="svg-136069397_6312"[\s\S]*?<\/svg>/g,
    `<svg ${THEAINF_LOGO_INNER}</svg>`
  );
}

function patchCssMasks(html) {
  return html.replace(
    /url\((['"])data:image\/svg\+xml,(?:utf8,|charset=utf-8,)?([\s\S]*?)\1\)/g,
    (full, quote, body) => {
      let svg = body;
      if (svg.includes("%3C") || svg.includes("%3c")) {
        try {
          svg = decodeURIComponent(svg);
        } catch {
          return full;
        }
      }
      if (!svg.includes("<svg")) return full;
      const start = svg.indexOf("<svg");
      const end = svg.lastIndexOf("</svg>");
      if (start < 0 || end < 0) return full;
      svg = svg.slice(start, end + "</svg>".length);
      svg = svg
        .replace(/fill="var\(--[^,]+,\s*(.+?)\)"/g, 'fill="$1"')
        .replace(/stroke="var\(--[^,]+,\s*(.+?)\)"/g, 'stroke="$1"')
        .replace(/fill="(rgba?\([^"]+\))\)"/g, 'fill="$1"')
        .replace(/stroke="(rgba?\([^"]+\))\)"/g, 'stroke="$1"')
        .replace(/fill="var\([^"]+\)"/g, 'fill="rgb(34,34,34)"')
        .replace(/stroke="var\([^"]+\)"/g, 'stroke="rgb(34,34,34)"')
        .replace(/fill="transparent"/g, 'fill="none"')
        .replace(/fill="rgba\(34,\s*34,\s*34,\s*0\.5\)"/g, 'fill="rgb(34,34,34)"');
      return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    }
  );
}

function patchFavicon(html) {
  return html.replace(
    /href="https:\/\/framerusercontent\.com\/images\/[^"]+"/g,
    (match) => {
      if (
        match.includes("4pMUyyZnznzFlXWQtT5MlcMZl") ||
        match.includes("favicon")
      ) {
        return `href="${MANIFEST.brand.favicon}"`;
      }
      return match;
    }
  );
}

function rewriteScriptUrls(html) {
  const cdn = MANIFEST.brand.cdnPrefix;
  const local = MANIFEST.brand.localPrefix;
  return html.replace(
    new RegExp(cdn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
    (url) => {
      if (url.includes("searchIndex")) return url;
      return local;
    }
  );
}

function patchPageMeta(html, meta) {
  if (!meta) return html;
  let out = html;
  if (meta.title) {
    out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${meta.title}</title>`);
  }
  if (meta.description) {
    out = out.replace(
      /<meta name="description" content="[^"]*">/,
      `<meta name="description" content="${meta.description}">`
    );
  }
  return out;
}

function routeFileToKey(file) {
  const rel = path.relative(path.join(ROOT, "app"), file).replace(/\\/g, "/");
  if (rel === "route.ts") return "home";
  return rel.replace(/\/route\.ts$/, "");
}

function routeKeyToPath(key) {
  if (key === "home") return path.join(ROOT, "app", "route.ts");
  return path.join(ROOT, "app", key, "route.ts");
}

function getAllRoutes() {
  const routes = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name === "route.ts") routes.push(p);
    }
  }
  walk(path.join(ROOT, "app"));
  return routes;
}

function main() {
  const replacements = [...MANIFEST.replacements].sort(
    (a, b) => b[0].length - a[0].length
  );

  const routeFiles = getAllRoutes();
  let routeChanges = 0;

  for (const file of routeFiles) {
    const key = routeFileToKey(file);
    let source = fs.readFileSync(file, "utf8");
    const extracted = extractHtml(source);
    if (!extracted) continue;

    let html = extracted.html;
    html = applyReplacements(html, replacements);
    if (MANIFEST.pageReplacements[key]) {
      html = applyReplacements(html, MANIFEST.pageReplacements[key]);
    }
    html = patchH1Titles(html, key);
    html = patchLogo(html);
    html = patchCssMasks(html);
    html = patchFavicon(html);
    html = rewriteScriptUrls(html);
    html = patchPageMeta(html, MANIFEST.pageMeta[key]);

    const newConst = `const HTML = "${escapeHtmlConst(html)}";`;
    // Skip closing quote + any leftover semicolons from prior buggy writes
    let after = extracted.end + 1;
    while (source[after] === ";") after++;
    const newSource = applyReplacements(
      source.slice(0, extracted.start) + newConst + source.slice(after),
      replacements
    );

    if (newSource !== source) {
      fs.writeFileSync(file, newSource, "utf8");
      routeChanges++;
      console.log("patched route:", key);
    }
  }

  const framerDir = path.join(ROOT, "public/framer-site");
  let jsChanges = 0;
  for (const name of fs.readdirSync(framerDir)) {
    if (!name.endsWith(".mjs")) continue;
    const fp = path.join(framerDir, name);
    let text = fs.readFileSync(fp, "utf8");
    const orig = text;
    text = applyReplacements(text, replacements);
    text = rewriteScriptUrls(text);
    if (text !== orig) {
      fs.writeFileSync(fp, text, "utf8");
      jsChanges++;
      console.log("patched js:", name);
    }
  }

  console.log(`\nDone: ${routeChanges} routes, ${jsChanges} JS chunks updated.`);

  const { repairAllRoutes } = require("./repair-html-escapes.js");
  const repaired = repairAllRoutes();
  if (repaired) console.log(`Escape repair: ${repaired} route file(s) fixed.`);
}

main();
