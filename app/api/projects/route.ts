import { listPublicFieldProjects } from "@/lib/field-projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public project cards for /projects. No auth. */
export async function GET() {
  const projects = await listPublicFieldProjects();
  return Response.json(
    { projects },
    { headers: { "Cache-Control": "no-cache, must-revalidate" } }
  );
}
