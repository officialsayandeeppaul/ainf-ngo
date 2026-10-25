import { listPublicFieldProjects } from "@/lib/field-projects";

export const runtime = "nodejs";
// Served from the CDN; admin project saves revalidate it (lib/public-cache.ts).
export const revalidate = 3600;

/** Public project cards for /projects. No auth. */
export async function GET() {
  const projects = await listPublicFieldProjects();
  return Response.json({ projects });
}
