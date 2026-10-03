const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const APP = path.join(ROOT, "app");
const OUT = path.join(ROOT, "framer-html");

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "api" || name === "(portal)") continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (name === "route.ts") out.push(p);
  }
  return out;
}

function pageIdFromRoute(abs) {
  const rel = path.relative(APP, abs).replace(/\\/g, "/");
  if (rel === "route.ts") return "home";
  return rel.replace(/\/route\.ts$/, "");
}

function extractHtml(src) {
  const htmlAt = src.indexOf("const HTML = ");
  const gzipAt = src.indexOf("\nconst HTML_GZIP");
  const exportAt = src.search(/\nexport (async )?function GET/);
  if (htmlAt < 0 || exportAt < 0) return null;
  const end = gzipAt > htmlAt && gzipAt < exportAt ? gzipAt : exportAt;
  const raw = src.slice(htmlAt + "const HTML = ".length, end).trim().replace(/;$/, "");
  if (raw.charAt(0) !== '"') return null;
  return vm.runInNewContext(raw, Object.create(null), { timeout: 120000 });
}

function headerComment(src) {
  const importAt = src.search(/^import /m);
  if (importAt < 0) return "";
  return src.slice(0, importAt).replace(/\s+$/, "\n\n");
}

function thinRoute(id, comment) {
  return (
    comment +
    'import { serveFramerPage } from "@/lib/framer-page";\n\n' +
    'export const dynamic = "force-static";\n\n' +
    "export function GET() {\n" +
    `  return serveFramerPage(${JSON.stringify(id)});\n` +
    "}\n"
  );
}

const routes = walk(APP);
let n = 0;
for (const file of routes) {
  const src = fs.readFileSync(file, "utf8");
  if (!src.includes("const HTML = ")) continue;
  const html = extractHtml(src);
  if (typeof html !== "string" || html.length < 1000) {
    console.error("skip, no html", path.relative(ROOT, file));
    continue;
  }
  const id = pageIdFromRoute(file);
  const dest = path.join(OUT, id + ".html");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
  fs.writeFileSync(dest + ".gz", require("zlib").gzipSync(html));
  fs.writeFileSync(file, thinRoute(id, headerComment(src)));
  n += 1;
  console.log(id, Math.round(html.length / 1024) + "kb");
}
console.log("extracted", n, "pages");
