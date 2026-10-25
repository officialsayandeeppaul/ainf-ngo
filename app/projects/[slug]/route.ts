import { serveFramerPage } from "@/lib/framer-page";
import { listPublicFieldProjects } from "@/lib/field-projects";
import { patchProjectHtml } from "@/lib/project-page";

// Built on first visit, then served from the CDN until an admin save or the hour is up.
export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

const KNOWN = new Set([
  "medical-aid-health-camps",
  "daily-meal-program",
  "education-support-drive",
  "winter-relief-program",
  "clean-water-initiative",
]);

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || KNOWN.has(slug)) {
    return new Response("Not found", { status: 404 });
  }
  const projects = await listPublicFieldProjects();
  const project = projects.find((row) => row.slug === slug);
  if (!project) return new Response("Not found", { status: 404 });
  return serveFramerPage("projects/daily-meal-program", (html) => patchProjectHtml(html, project));
}
