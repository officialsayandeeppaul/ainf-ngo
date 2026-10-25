import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIELD_PROJECT_DEFAULTS } from "@/lib/field-projects";
import { fillProjectCards } from "@/lib/project-cards";

const html = readFileSync(path.join(process.cwd(), "framer-html", "projects.html"), "utf8");

function cards(page: string) {
  return [...page.matchAll(/<a\b[^>]*\shref="\/projects\/([a-z0-9-]+)"[^>]*>/g)].map((m) => m[1]);
}

describe("fillProjectCards", () => {
  const projects = [
    ...FIELD_PROJECT_DEFAULTS,
    { ...FIELD_PROJECT_DEFAULTS[0], id: "proj_rozgar", slug: "rozgar-desk", title: "Rozgar Desk", href: "/projects/rozgar-desk", sortOrder: 5 },
  ];
  const filled = fillProjectCards(html, projects);

  it("gives every published project a card, in order", () => {
    expect(cards(filled)).toEqual(projects.map((p) => p.slug));
  });

  it("writes title, photo, amounts, and summary into each card", () => {
    for (const project of projects) {
      const at = filled.indexOf(`href="/projects/${project.slug}"`);
      const card = filled.slice(at, at + 20000);
      expect(card).toContain(`>${project.title.replace(/&/g, "&amp;")}</h4>`);
      expect(card).toContain(`src="${project.imageUrl}"`);
      // The chip shows the raised amount in an h4; the bar's amounts are paragraphs.
      expect(card).toContain(`>${project.raisedLabel}</h4>`);
      expect(card).toContain(`>${project.raisedLabel}</p>`);
      expect(card).toContain(`>${project.goalLabel}</p>`);
    }
    expect(filled).toContain(`>${FIELD_PROJECT_DEFAULTS[1].summary}</p>`);
  });

  it("drops the template srcset so the browser loads the project photo only", () => {
    const at = filled.indexOf(`href="/projects/${projects[0].slug}"`);
    const img = /<img\b[^>]*>/.exec(filled.slice(at))![0];
    expect(img).not.toMatch(/\ssrcset=/);
    expect(img).toContain(`alt="${projects[0].title}"`);
  });

  it("leaves everything outside the cards byte for byte", () => {
    const firstTemplate = html.indexOf('href="./projects/');
    const start = html.lastIndexOf("<a", firstTemplate);
    expect(filled.slice(0, start)).toBe(html.slice(0, start));
    const tail = html.slice(html.lastIndexOf("</section>"));
    expect(filled.endsWith(tail)).toBe(true);
  });

  it("hides template cards beyond the project list", () => {
    const short = fillProjectCards(html, FIELD_PROJECT_DEFAULTS.slice(0, 2));
    expect(cards(short).slice(0, 2)).toEqual(FIELD_PROJECT_DEFAULTS.slice(0, 2).map((p) => p.slug));
    expect(short.match(/<a style="display:none"|<a\b[^>]*style="display:none;/g)?.length).toBe(3);
  });

  it("is a no-op without projects", () => {
    expect(fillProjectCards(html, [])).toBe(html);
  });
});
