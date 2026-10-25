import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

/**
 * The project pages' AINF copy, applied to the served HTML.
 *
 * ainf-projects-theme.js holds the tables (PROJECT_COPY: template sentence ->
 * AINF sentence, REBRAND_COPY: brand fixes) and used to apply them only in
 * the browser, after first paint. They are read from that file so the server,
 * the browser, and scripts/apply-project-copy-to-modules.mjs share one list.
 */

type Pair = [string, string];

let tables: { copy: Map<string, string>; rebrand: Pair[] } | null = null;

function readTable(source: string, name: string): Pair[] {
  const head = `var ${name} = `;
  const start = source.indexOf(head);
  if (start < 0) return [];
  let depth = 0;
  let end = start + head.length;
  for (; end < source.length; end++) {
    if (source[end] === "[") depth++;
    else if (source[end] === "]" && --depth === 0) break;
  }
  return vm.runInNewContext(source.slice(start + head.length, end + 1)) as Pair[];
}

function load() {
  if (tables) return tables;
  let source = "";
  try {
    source = readFileSync(path.join(process.cwd(), "public/assets/js", "ainf-projects-theme.js"), "utf8");
  } catch {
    // Without the script the browser pass still runs; the HTML stays as exported.
  }
  const copy = new Map<string, string>();
  for (const [from, to] of readTable(source, "PROJECT_COPY")) copy.set(from.replace(/[‘’]/g, "'"), to);
  tables = { copy, rebrand: readTable(source, "REBRAND_COPY") };
  return tables;
}

const decode = (text: string) =>
  text
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** indianizeCopy() and rebrandCopy() from ainf-projects-theme.js, done before the page is sent. */
export function applyProjectCopy(html: string): string {
  const { copy, rebrand } = load();
  if (!copy.size && !rebrand.length) return html;
  // Leaf text blocks only (no nested block inside), like the browser pass.
  let next = html.replace(/<(h[1-4]|p|li)\b([^>]*)>((?:(?!<\/?(?:h[1-6]|p|li|div|section)\b)[\s\S])*?)<\/\1>/gi, (full, tag: string, attrs: string, inner: string) => {
    if (/data-ainf-cms="1"/.test(attrs)) return full;
    const text = decode(inner.replace(/<[^>]+>/g, "")).replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
    const to = copy.get(text);
    return to && to !== text ? `<${tag}${attrs}>${escape(to)}</${tag}>` : full;
  });
  if (rebrand.length) {
    // Text between tags only: attributes, scripts, and styles are untouched.
    next = next
      .split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>)/i)
      .map((part, i) =>
        i % 2
          ? part
          : part.replace(/>([^<]*)</g, (full, text: string) => {
              let out = text;
              for (const [from, to] of rebrand) if (out.includes(from)) out = out.split(from).join(to);
              return out === text ? full : `>${out}<`;
            })
      )
      .join("");
  }
  return next;
}
