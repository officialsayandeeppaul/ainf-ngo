import { Role } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { supportBannerDelegate } from "@/lib/db";
import { contextFromRequest } from "@/lib/request-context";
import { getSupportBanner, toSupportBannerView } from "@/lib/support-banner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  enabled: z.boolean(),
  headline: z.string().trim().max(120),
  message: z.string().trim().max(500),
  ctaLabel: z.string().trim().min(1).max(40).default("Support AINF"),
  ctaHref: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((value) => value.startsWith("/") || /^https?:\/\//i.test(value), {
      message: "CTA link must be a path or http(s) URL.",
    })
    .default("/donate-now"),
  endsAt: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) throw new Error("invalid_ends_at");
      return date;
    }),
});

export async function GET() {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminRead" });
  if (!guard.ok) return guard.response;
  const row = await getSupportBanner();
  return Response.json({ banner: toSupportBannerView(row) });
}

export async function PATCH(request: Request) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid input.")
        : error instanceof Error && error.message === "invalid_ends_at"
          ? "Countdown end time is invalid."
          : "Invalid input.";
    return Response.json({ error: "invalid_input", message }, { status: 400 });
  }

  if (input.enabled && !input.headline && !input.message) {
    return Response.json(
      { error: "invalid_input", message: "Add a headline or message before turning the banner on." },
      { status: 400 }
    );
  }

  const delegate = supportBannerDelegate() as {
    upsert: (args: unknown) => Promise<{
      enabled: boolean;
      headline: string;
      message: string;
      ctaLabel: string;
      ctaHref: string;
      endsAt: Date | null;
      updatedAt: Date;
    }>;
  } | null;
  if (!delegate) {
    return Response.json(
      {
        error: "client_stale",
        message: "Prisma client is stale. Restart the Next.js dev server after prisma generate.",
      },
      { status: 503 }
    );
  }

  const row = await delegate.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      enabled: input.enabled,
      headline: input.headline,
      message: input.message,
      ctaLabel: input.ctaLabel,
      ctaHref: input.ctaHref,
      endsAt: input.endsAt ?? null,
      updatedByUserId: guard.ctx.user.id,
    },
    update: {
      enabled: input.enabled,
      headline: input.headline,
      message: input.message,
      ctaLabel: input.ctaLabel,
      ctaHref: input.ctaHref,
      endsAt: input.endsAt ?? null,
      updatedByUserId: guard.ctx.user.id,
    },
  });

  await recordAudit({
    action: AuditAction.SupportBannerUpdated,
    actorUserId: guard.ctx.user.id,
    actorClerkId: guard.ctx.clerkId,
    actorRole: guard.ctx.role,
    targetType: "support_banner",
    targetId: "singleton",
    context: contextFromRequest(request),
    metadata: {
      enabled: row.enabled,
      endsAt: row.endsAt?.toISOString() ?? null,
      headline: row.headline.slice(0, 80),
    },
  });

  return Response.json({ ok: true, banner: toSupportBannerView(row) });
}
