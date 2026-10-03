import { BillingInterval } from "@prisma/client";
import { z } from "zod";
import { guardApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { formatDay } from "@/lib/format-date";
import { formatInr } from "@/lib/membership";
import { expireMembershipIfNeeded } from "@/lib/membership-pay";
import { quoteForUser } from "@/lib/membership-checkout";
import { membershipIsLive } from "@/lib/membership-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  interval: z.nativeEnum(BillingInterval),
  tierId: z.string().min(1).optional(),
});

function publicQuote(quote: Awaited<ReturnType<typeof quoteForUser>>) {
  return {
    kind: quote.kind,
    listPaise: quote.listPaise,
    listLabel: formatInr(quote.listPaise),
    offerName: quote.offerName,
    offerOffPaise: quote.offerOffPaise,
    offerOffLabel: quote.offerOffPaise ? formatInr(quote.offerOffPaise) : null,
    payablePaise: quote.payablePaise,
    creditPaise: quote.creditPaise,
    creditLabel: formatInr(quote.creditPaise),
    leftoverPaise: quote.leftoverPaise,
    duePaise: quote.duePaise,
    dueLabel: formatInr(quote.duePaise),
    expiresAt: quote.expiresAt.toISOString(),
    expiresLabel: formatDay(quote.expiresAt),
    cta:
      quote.kind === "same"
        ? "Current plan"
        : quote.kind === "upgrade"
          ? quote.duePaise > 0
            ? `Upgrade · ${formatInr(quote.duePaise)} today`
            : "Upgrade now"
          : quote.kind === "downgrade"
            ? quote.duePaise > 0
              ? `Downgrade · ${formatInr(quote.duePaise)} today`
              : "Downgrade now"
            : quote.kind === "interval"
              ? quote.duePaise > 0
                ? `Switch · ${formatInr(quote.duePaise)} today`
                : "Switch now"
              : quote.duePaise > 0
                ? `Pay ${formatInr(quote.duePaise)}`
                : "Start membership",
  };
}

export async function POST(request: Request) {
  const guard = await guardApi({ limiter: "checkout" });
  if (!guard.ok) return guard.response;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_input", message: "Pick monthly or yearly." }, { status: 400 });
  }

  await expireMembershipIfNeeded(guard.ctx.user.id);
  const user = await db.user.findUnique({
    where: { id: guard.ctx.user.id },
    include: { membershipTier: true },
  });
  if (!user) {
    return Response.json({ error: "not_found", message: "Account not found." }, { status: 404 });
  }

  const tiers = input.tierId
    ? await db.membershipTier.findMany({ where: { id: input.tierId, active: true } })
    : await db.membershipTier.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });

  const quotes: Record<string, ReturnType<typeof publicQuote>> = {};
  for (const tier of tiers) {
    quotes[tier.id] = publicQuote(await quoteForUser({ user, tier, interval: input.interval }));
  }

  return Response.json({
    ok: true,
    live: membershipIsLive(user),
    quotes,
  });
}
