import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

/**
 * The project pages' AINF copy, applied to the served HTML.
 *
 * ainf-projects-theme.js holds the tables (PROJECT_COPY: template sentence ->
 * AINF sentence, REBRAND_COPY: brand fixes, TESTIMONIAL_COPY: one coloured run
 * of a testimonial slide) and used to apply them only in the browser, after
 * first paint. They are read from that file so the server, the browser, and
 * scripts/apply-project-copy-to-modules.mjs share one list.
 */

type Pair = [string, string];

let tables: { copy: Map<string, string>; rebrand: Pair[]; runs: Map<string, string> } | null = null;

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
  const runs = new Map<string, string>();
  for (const [from, to] of readTable(source, "TESTIMONIAL_COPY")) runs.set(from.replace(/[‘’]/g, "'"), to);
  tables = { copy, rebrand: readTable(source, "REBRAND_COPY"), runs };
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

/** Framer's appear effect ships each word as its own inline-block span. */
const WORD_SPAN = /<span style="(display:inline-block;[^"]*)">([^<]*)<\/span>/g;
const WORD_RUN =
  /<span class="framer-text" style="([^"]*)">((?:<span style="display:inline-block;[^"]*">[^<]*<\/span> ?)+)<\/span>/g;

/**
 * Rewrites one coloured run of a text-effect heading word by word, keeping
 * Framer's span markup so the served HTML says what the module renders and
 * hydration leaves the animation alone.
 */
export function rewriteWordRuns(html: string, runs: Map<string, string>): string {
  if (!runs.size) return html;
  return html.replace(WORD_RUN, (full, runStyle: string, inner: string) => {
    const words: string[] = [];
    let wordStyle = "";
    for (const match of inner.matchAll(WORD_SPAN)) {
      wordStyle ||= match[1];
      words.push(decode(match[2]));
    }
    const to = runs.get(words.join(" ").replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim());
    if (!to || !wordStyle) return full;
    const spans = to
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => `<span style="${wordStyle}">${escape(word)}</span>`)
      .join(" ");
    return `<span class="framer-text" style="${runStyle}">${spans}</span>`;
  });
}

/** indianizeCopy() and rebrandCopy() from ainf-projects-theme.js, done before the page is sent. */
export function applyProjectCopy(html: string): string {
  const { copy, rebrand, runs } = load();
  if (!copy.size && !rebrand.length && !runs.size) return html;
  // Leaf text blocks only (no nested block inside), like the browser pass.
  let next = rewriteWordRuns(html, runs).replace(
    /<(h[1-4]|p|li)\b([^>]*)>((?:(?!<\/?(?:h[1-6]|p|li|div|section)\b)[\s\S])*?)<\/\1>/gi,
    (full, tag: string, attrs: string, inner: string) => {
      if (/data-ainf-cms="1"/.test(attrs)) return full;
      // Animated text: flattening its word spans breaks hydration and the effect.
      if (/display:inline-block/.test(inner)) return full;
      const text = decode(inner.replace(/<[^>]+>/g, "")).replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
      const to = copy.get(text);
      return to && to !== text ? `<${tag}${attrs}>${escape(to)}</${tag}>` : full;
    }
  );
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
