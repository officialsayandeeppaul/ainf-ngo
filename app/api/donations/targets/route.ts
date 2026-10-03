import { z } from "zod";
import { suggestionsFor, listGiftTargets } from "@/lib/donations";
import { isDatabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  project: z.string().trim().max(80).optional(),
  mission: z.string().trim().max(80).optional(),
});

/** Public list of gift targets and the floors that apply to each. */
export async function GET(request: Request) {
  if (!isDatabaseConfigured) {
    return Response.json({ error: "not_configured", message: "Gifts are temporarily unavailable." }, { status: 503 });
  }
  const url = new URL(request.url);
  const query = querySchema.parse({
    project: url.searchParams.get("project") ?? undefined,
    mission: url.searchParams.get("mission") ?? undefined,
  });
  const { settings, targets } = await listGiftTargets();
  const preferred =
    targets.find((target) => query.project && target.kind === "PROJECT" && target.slug === query.project) ??
    targets.find((target) => query.mission && target.kind === "MISSION" && target.slug === query.mission) ??
    targets.find((target) => target.kind === "GENERAL") ??
    null;

  return Response.json({
    minPaise: settings.minPaise,
    maxPaise: settings.maxPaise,
    targets: targets.map((target) => ({
      ...target,
      suggestedPaise: suggestionsFor(settings, target.minPaise),
    })),
    selected: preferred ? { kind: preferred.kind, slug: preferred.slug } : null,
  });
}
