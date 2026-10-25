import { revalidatePath } from "next/cache";
import type { FieldProjectView } from "@/lib/field-projects";

/**
 * The public project pages are served from the CDN (ISR) and rebuilt only when
 * an admin changes a project, instead of querying Postgres on every visit.
 *
 * Their `revalidate = 3600` (a literal: Next reads segment config statically)
 * is a safety net for changes made outside the admin API, such as seeds or
 * direct SQL. Admin saves call this for an immediate refresh.
 */
/** Each detail page shows only its own project; pass the old slug too when it changes. */
export function revalidateProjectPages(...slugs: Array<string | null | undefined>) {
  const paths = new Set<string>(["/projects", "/api/projects"]);
  for (const slug of slugs) if (slug) paths.add(`/projects/${slug}`);
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // Outside a request scope (scripts, tests) there is no cache to purge.
    }
  }
}

/** What the /projects cards read (ainf-projects-theme.js), without the long detail copy. */
export function inlineFieldProjects(html: string, projects: FieldProjectView[]): string {
  const cards = projects.map((project) => ({
    id: project.id,
    slug: project.slug,
    title: project.title,
    summary: project.summary,
    raisedLabel: project.raisedLabel,
    goalLabel: project.goalLabel,
    imageUrl: project.imageUrl,
    href: project.href,
    sortOrder: project.sortOrder,
    published: project.published,
  }));
  const json = JSON.stringify(cards).replace(/</g, "\\u003c");
  // Registered with the image guard so the project photos are never taken for stock.
  const own = JSON.stringify(cards.map((card) => card.imageUrl)).replace(/</g, "\\u003c");
  const script = `<script id="ainf-field-projects">window.__ainfFieldProjects=${json};if(window.__ainfImgRules)window.__ainfImgRules.own(${own});</script>`;
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, (tag) => script + tag) : script + html;
}
