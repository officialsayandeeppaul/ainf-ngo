import type { FieldProjectView } from "@/lib/field-projects";

/**
 * Server-side twin of fillCard()/applyFieldProjects() in ainf-projects-theme.js.
 *
 * /projects ships Hopper's template cards. Filling them in the browser meant
 * the template titles and photos painted first and were swapped a moment
 * later (and a sixth card pushed the page down). Filling them here makes the
 * served HTML final; the browser pass then finds nothing to change.
 *
 * Framer's markup is well formed, so a small offset-keeping tree is enough:
 * edits replace exact source ranges and everything else is left byte for byte
 * (Framer's hydration comments included).
 */

type El = {
  tag: string;
  open: [number, number];
  close: [number, number] | null;
  attrs: Record<string, string>;
  parent: El | null;
  children: Array<El | Text>;
};
type Text = { text: string; start: number; end: number };

const VOID = /^(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i;

function decode(text: string) {
  return text
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeText(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(text: string) {
  return escapeText(text).replace(/"/g, "&quot;");
}

function parse(html: string): El {
  const root: El = { tag: "#root", open: [0, 0], close: [html.length, html.length], attrs: {}, parent: null, children: [] };
  const token = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>|([^<]+)/g;
  let current = root;
  for (let m = token.exec(html); m; m = token.exec(html)) {
    if (m[0].startsWith("<!--")) continue;
    if (m[4] !== undefined) {
      current.children.push({ text: m[4], start: m.index, end: m.index + m[0].length });
      continue;
    }
    const [whole, closing, rawTag, rawAttrs] = m;
    const tag = rawTag.toLowerCase();
    if (closing) {
      for (let node: El | null = current; node && node !== root; node = node.parent) {
        if (node.tag === tag) {
          node.close = [m.index, m.index + whole.length];
          current = node.parent ?? root;
          break;
        }
      }
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of rawAttrs.matchAll(/([^\s=/]+)(?:="([^"]*)")?/g)) attrs[a[1].toLowerCase()] = a[2] ?? "";
    const el: El = { tag, open: [m.index, m.index + whole.length], close: null, attrs, parent: current, children: [] };
    current.children.push(el);
    if (!VOID.test(tag) && !whole.endsWith("/>")) current = el;
  }
  return root;
}

const isEl = (node: El | Text): node is El => "tag" in node;

function descendants(el: El, out: El[] = []): El[] {
  for (const child of el.children) {
    if (!isEl(child)) continue;
    out.push(child);
    descendants(child, out);
  }
  return out;
}

const named = (el: El, name: string) => descendants(el).filter((node) => node.attrs["data-framer-name"] === name);

function within(el: El, ancestor: El) {
  for (let node = el.parent; node; node = node.parent) if (node === ancestor) return true;
  return false;
}

function inside(el: El, names: string[]) {
  for (let node = el.parent; node; node = node.parent) {
    if (names.includes(node.attrs["data-framer-name"] ?? "")) return true;
  }
  return false;
}

function textOf(el: El): string {
  return el.children.map((child) => (isEl(child) ? textOf(child) : decode(child.text))).join("");
}

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

type Edit = { start: number; end: number; text: string };

class Card {
  texts = new Map<El, string>();
  tags = new Map<El, Record<string, string | null>>();
  constructor(readonly html: string, readonly root: El) {}

  /** Last write wins, as with textContent; the tree reflects it for later reads. */
  setText(el: El, text: string) {
    if (!el.close) return;
    this.texts.set(el, text);
    el.children = [{ text: escapeText(text), start: -1, end: -1 }];
  }

  setAttr(el: El, name: string, value: string | null) {
    const pending = this.tags.get(el) ?? {};
    pending[name] = value;
    this.tags.set(el, pending);
    if (value === null) delete el.attrs[name];
    else el.attrs[name] = value;
  }

  styleWith(el: El, props: Record<string, string>) {
    const style = el.attrs.style ?? "";
    const kept = style
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part && !Object.keys(props).includes(part.split(":")[0].trim().toLowerCase()));
    for (const [key, value] of Object.entries(props)) kept.push(`${key}:${value}`);
    this.setAttr(el, "style", kept.join(";"));
  }

  render(): string {
    const all: Edit[] = [];
    const replaced = [...this.texts.keys()];
    // An element whose content was replaced takes its descendants' edits with it.
    const gone = (el: El) => replaced.some((other) => other !== el && within(el, other));
    for (const [el, text] of this.texts) {
      if (!gone(el)) all.push({ start: el.open[1], end: el.close![0], text: escapeText(text) });
    }
    for (const [el, changes] of this.tags) {
      if (gone(el)) continue;
      let tag = this.html.slice(el.open[0], el.open[1]);
      for (const [name, value] of Object.entries(changes)) {
        const re = new RegExp(`\\s${name}(?:="[^"]*")?(?=[\\s/>])`, "i");
        if (value === null) tag = tag.replace(re, "");
        else if (re.test(tag)) tag = tag.replace(re, ` ${name}="${escapeAttr(value)}"`);
        else tag = tag.replace(/^<[a-zA-Z][a-zA-Z0-9-]*/, (head) => `${head} ${name}="${escapeAttr(value)}"`);
      }
      all.push({ start: el.open[0], end: el.open[1], text: tag });
    }
    all.sort((a, b) => b.start - a.start);
    let out = this.html;
    for (const edit of all) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
    return out;
  }
}

function rupees(label: string) {
  const raw = String(label || "").replace(/[₹,\s]/g, "").toLowerCase();
  const match = raw.match(/([\d.]+)(k|l|cr)?/);
  if (!match) return 0;
  let value = parseFloat(match[1]);
  if (match[2] === "k") value *= 1000;
  if (match[2] === "l") value *= 100000;
  if (match[2] === "cr") value *= 10000000;
  return value;
}

function writeLeaves(card: Card, root: El | undefined, label: string) {
  if (!root) return;
  const leaves = descendants(root).filter(
    (el) => /^(?:p|h4|span)$/.test(el.tag) && !descendants(el).some((d) => /^(?:p|h4|span)$/.test(d.tag))
  );
  if (!leaves.length) {
    if (textOf(root) !== label) card.setText(root, label);
    return;
  }
  if (textOf(leaves[0]) !== label) card.setText(leaves[0], label);
  for (const leaf of leaves.slice(1)) if (textOf(leaf)) card.setText(leaf, "");
}

function writeCaption(card: Card, block: El | undefined, label: string) {
  if (!block) return;
  const caption = descendants(block).find((el) => el.tag === "p" && !inside(el, ["Number"]));
  if (!caption) return;
  if (clean(textOf(caption)) !== label) card.setText(caption, label);
  card.setAttr(caption, "data-ainf-cms", "1");
  card.styleWith(caption, { opacity: "1", color: "rgb(61, 74, 68)" });
}

function fillCard(html: string, project: FieldProjectView): string {
  const root = parse(html);
  const anchor = root.children.find(isEl);
  if (!anchor) return html;
  const card = new Card(html, root);
  const all = descendants(root);

  const titleBlock = named(root, "Title")[0];
  const titleH4 = titleBlock && descendants(titleBlock).find((el) => el.tag === "h4");
  if (titleH4) {
    card.setAttr(titleH4, "data-ainf-cms", "1");
    if (clean(textOf(titleH4)) !== project.title) card.setText(titleH4, project.title);
  }
  let wroteChip = false;
  for (const heading of all.filter((el) => el.tag === "h4")) {
    if (heading === titleH4) continue;
    const text = textOf(heading).trim();
    if (/^raised$/i.test(text)) continue;
    if (!wroteChip) {
      if (text !== project.raisedLabel) card.setText(heading, project.raisedLabel);
      wroteChip = true;
    } else if (text) card.setText(heading, "");
  }
  const raisedBlock = named(root, "Raised")[0];
  const goalBlock = named(root, "Goal")[0];
  writeLeaves(card, raisedBlock && named(raisedBlock, "Number")[0], project.raisedLabel);
  writeLeaves(card, goalBlock && named(goalBlock, "Number")[0], project.goalLabel);
  writeCaption(card, raisedBlock, "Raised :");
  writeCaption(card, goalBlock, "Goal :");

  let summary: El | null = null;
  let summaryLen = 0;
  for (const paragraph of all.filter((el) => el.tag === "p")) {
    if (inside(paragraph, ["Raised", "Goal", "Title"])) continue;
    const len = textOf(paragraph).trim().length;
    if (len > summaryLen) {
      summary = paragraph;
      summaryLen = len;
    }
  }
  if (summary) {
    card.setAttr(summary, "data-ainf-cms", "1");
    if (clean(textOf(summary)) !== project.summary) card.setText(summary, project.summary);
  }

  let href = project.href || `/projects/${project.slug}`;
  if (href.charAt(0) !== "/") href = "/" + href.replace(/^\.\//, "");
  for (const link of [anchor, ...all].filter((el) => el.tag === "a" && el.attrs.href != null)) {
    const current = link.attrs.href;
    if (current.indexOf("project") < 0 && current.indexOf("#") !== 0) continue;
    if (current !== href) card.setAttr(link, "href", href);
  }
  card.setAttr(anchor, "data-ainf-href", href);

  const image = all.find((el) => el.tag === "img" && !inside(el, ["Icon", "Icon Sphere"]));
  if (image && project.imageUrl) {
    const pinned = project.imageUrl.split("?")[0];
    card.setAttr(image, "data-ainf-cms", "1");
    card.setAttr(image, "data-ainf-pin", pinned);
    card.setAttr(image, "alt", project.title);
    card.setAttr(image, "srcset", null);
    card.setAttr(image, "sizes", null);
    card.setAttr(image, "src", pinned);
    card.styleWith(image, { opacity: "1 !important", visibility: "visible !important" });
    for (let node = image.parent; node; node = node.parent) {
      if (node.attrs["data-framer-background-image-wrapper"] == null) continue;
      card.styleWith(node, { opacity: "1 !important", visibility: "visible !important" });
      break;
    }
  }

  const raised = rupees(project.raisedLabel);
  const goal = rupees(project.goalLabel);
  if (goal > 0) {
    const pct = Math.max(4, Math.min(100, Math.round((raised / goal) * 100)));
    for (const el of all) {
      const width = /(?:^|;)\s*width:\s*([\d.]+%)/i.exec(el.attrs.style ?? "")?.[1];
      if (width && width !== "100%") card.styleWith(el, { width: `${pct}%` });
    }
  }
  return card.render();
}

/** [start, end) of each project card: an <a> holding exactly one Title plus Raised and Goal. */
function cardRanges(html: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const open = /<a\b[^>]*\shref="\.?\/projects\/[a-z0-9-]+"[^>]*>/gi;
  for (let m = open.exec(html); m; m = open.exec(html)) {
    const tags = /<(\/?)a\b[^>]*>/gi;
    tags.lastIndex = m.index;
    let depth = 0;
    let end = -1;
    for (let t = tags.exec(html); t; t = tags.exec(html)) {
      depth += t[1] ? -1 : 1;
      if (depth === 0) {
        end = t.index + t[0].length;
        break;
      }
    }
    if (end < 0) continue;
    const block = html.slice(m.index, end);
    const titles = block.split('data-framer-name="Title"').length - 1;
    if (titles === 1 && block.includes('data-framer-name="Raised"') && block.includes('data-framer-name="Goal"')) {
      ranges.push([m.index, end]);
    }
    open.lastIndex = end;
  }
  return ranges;
}

/** Fills the /projects cards with the published projects, adding or hiding cards to match. */
export function fillProjectCards(html: string, projects: FieldProjectView[]): string {
  const live = projects.filter((project) => project.published !== false);
  const ranges = cardRanges(html);
  if (!ranges.length || !live.length) return html;
  const blocks = ranges.map(([start, end]) => html.slice(start, end));
  const template = blocks[blocks.length - 1];
  while (blocks.length < live.length) blocks.push(template.replace(/\sdata-ainf-bound="[^"]*"/g, ""));
  const filled = blocks.map((block, index) => {
    const project = live[index];
    if (project) return fillCard(block, project);
    // More template cards than projects: hidden, as the browser pass does.
    return /^<a\b[^>]*\sstyle="/i.test(block)
      ? block.replace(/^(<a\b[^>]*\sstyle=")/i, "$1display:none;")
      : block.replace(/^<a\b/i, '<a style="display:none"');
  });
  const [first] = ranges;
  const last = ranges[ranges.length - 1];
  // Cards sit side by side in one container; extra ones follow the last.
  return html.slice(0, first[0]) + rebuild(html, ranges, filled) + html.slice(last[1]);
}

function rebuild(html: string, ranges: Array<[number, number]>, filled: string[]) {
  let out = "";
  for (let i = 0; i < ranges.length; i++) {
    out += filled[i];
    if (i < ranges.length - 1) out += html.slice(ranges[i][1], ranges[i + 1][0]);
  }
  for (let i = ranges.length; i < filled.length; i++) out += filled[i];
  return out;
}
