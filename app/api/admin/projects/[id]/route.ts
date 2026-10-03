import { Role } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { contextFromRequest } from "@/lib/request-context";
import { projectsDelegate, toFieldProjectView } from "@/lib/field-projects";
import { detailFor } from "@/lib/project-detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug uses lowercase letters, numbers, and hyphens.");

const imageSchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine((value) => value.startsWith("/assets/") || /^https?:\/\//i.test(value), {
    message: "Image must be a site path or an http(s) URL.",
  });

const detailSchema = z.object({
  howEyebrow: z.string().trim().min(1).max(40),
  howIntro: z.string().trim().min(1).max(280),
  howParagraphs: z.array(z.string().trim().min(1).max(500)).length(3),
  missionEyebrow: z.string().trim().min(1).max(40),
  missionTitle: z.string().trim().min(1).max(200),
  missionPoints: z.array(z.string().trim().min(1).max(280)).length(3),
  missionImage: imageSchema,
  impactTitle: z.string().trim().min(1).max(80),
  impactPoints: z.array(z.string().trim().min(1).max(140)).length(4),
  galleryImage: imageSchema,
});

const patchSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(400),
  raisedLabel: z.string().trim().min(1).max(20),
  goalLabel: z.string().trim().min(1).max(20),
  imageUrl: imageSchema,
  detail: detailSchema.optional(),
  sortOrder: z.number().int().min(0).max(99),
  published: z.boolean(),
  acceptDonations: z.boolean().default(false),
  donateMinPaise: z.number().int().min(100).max(10_000_000).nullable().default(null),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;
  const delegate = projectsDelegate();
  if (!delegate) {
    return Response.json(
      { error: "client_stale", message: "Restart the dev server after the projects table is created." },
      { status: 503 }
    );
  }
  const { id } = await ctx.params;

  let input: z.infer<typeof patchSchema>;
  try {
    input = patchSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? (error.issues[0]?.message ?? "Invalid input.") : "Invalid input.";
    return Response.json({ error: "invalid_input", message }, { status: 400 });
  }

  try {
    const row = await delegate.update({
      where: { id },
      data: {
        ...input,
        detail: input.detail ?? detailFor(input.slug),
        updatedByUserId: guard.ctx.user.id,
      },
    });
    await recordAudit({
      action: AuditAction.FieldProjectSaved,
      actorUserId: guard.ctx.user.id,
      actorClerkId: guard.ctx.clerkId,
      actorRole: guard.ctx.role,
      targetType: "field_project",
      targetId: row.id,
      context: contextFromRequest(request),
      metadata: { slug: row.slug, title: row.title.slice(0, 80), published: row.published },
    });
    return Response.json({ ok: true, project: toFieldProjectView(row) });
  } catch {
    return Response.json(
      { error: "invalid_input", message: "Could not save that project. The slug may already be used." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;
  const delegate = projectsDelegate();
  if (!delegate) {
    return Response.json(
      { error: "client_stale", message: "Restart the dev server after the projects table is created." },
      { status: 503 }
    );
  }
  const { id } = await ctx.params;
  try {
    const row = await delegate.delete({ where: { id } });
    await recordAudit({
      action: AuditAction.FieldProjectSaved,
      actorUserId: guard.ctx.user.id,
      actorClerkId: guard.ctx.clerkId,
      actorRole: guard.ctx.role,
      targetType: "field_project",
      targetId: row.id,
      context: contextFromRequest(request),
      metadata: { slug: row.slug, deleted: true },
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "not_found", message: "That project is already gone." }, { status: 404 });
  }
}
