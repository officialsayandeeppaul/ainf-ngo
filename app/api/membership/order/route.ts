import { BillingInterval, MembershipOrderStatus, type MembershipTier } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { env, isRazorpayConfigured } from "@/lib/env";
import { dbChangeKind, quoteForUser } from "@/lib/membership-checkout";
import { applyComplimentarySwitch, expireMembershipIfNeeded } from "@/lib/membership-pay";
import { razorpayDuePaise } from "@/lib/membership-quote";
import { canStartPayment, membershipIsLive, paymentBlockMessage } from "@/lib/membership-state";
import { identityReadyForMembership } from "@/lib/donation-rules";
import { getVerificationPolicy } from "@/lib/verification-policy";
import {
  createRazorpayOrder,
  createRazorpayPlan,
  createRazorpaySubscription,
} from "@/lib/razorpay";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  tierId: z.string().min(1),
  interval: z.nativeEnum(BillingInterval),
});

async function planIdFor(tier: MembershipTier, interval: BillingInterval, amountPaise: number) {
  const yearly = interval === BillingInterval.YEARLY;
  const existing = yearly ? tier.razorpayPlanYearlyId : tier.razorpayPlanMonthlyId;
  if (existing) return existing;
  const created = await createRazorpayPlan({
    name: `${tier.name} ${yearly ? "yearly" : "monthly"}`,
    amountPaise,
    period: yearly ? "yearly" : "monthly",
  });
  await db.membershipTier.update({
    where: { id: tier.id },
    data: yearly ? { razorpayPlanYearlyId: created.id } : { razorpayPlanMonthlyId: created.id },
  });
  return created.id;
}

export async function POST(request: Request) {
  const guard = await guardApi({ limiter: "checkout" });
  if (!guard.ok) return guard.response;

  if (!isRazorpayConfigured) {
    return Response.json(
      { error: "not_configured", message: "Razorpay keys are not set." },
      { status: 503 }
    );
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_input", message: "Pick a plan and monthly or yearly." }, { status: 400 });
  }

  await expireMembershipIfNeeded(guard.ctx.user.id);
  const user = await db.user.findUnique({
    where: { id: guard.ctx.user.id },
    include: { membershipTier: true },
  });
  if (!user) {
    return Response.json({ error: "not_found", message: "Account not found." }, { status: 404 });
  }
  if (!identityReadyForMembership(user, getVerificationPolicy())) {
    return Response.json(
      {
        error: "identity_required",
        message: "Verify your identity before you take a membership plan.",
      },
      { status: 403 }
    );
  }

  const pending = await db.membershipOrder.findFirst({
    where: { userId: user.id, status: MembershipOrderStatus.CREATED },
    orderBy: { createdAt: "desc" },
  });

  const tier = await db.membershipTier.findUnique({ where: { id: input.tierId } });
  if (!tier || !tier.active) {
    return Response.json({ error: "not_found", message: "That member type is not offered." }, { status: 404 });
  }

  const quote = await quoteForUser({ user, tier, interval: input.interval });
  if (quote.kind === "same") {
    return Response.json({ error: "blocked", message: paymentBlockMessage("same") }, { status: 409 });
  }

  const switching = quote.kind !== "new";
  const gate = canStartPayment({
    live: membershipIsLive(user),
    pendingCreatedAt: pending?.createdAt ?? null,
    switching,
  });
  if (!gate.ok) {
    return Response.json({ error: "blocked", message: paymentBlockMessage(gate.reason) }, { status: 409 });
  }

  const due = razorpayDuePaise(quote.duePaise);
  const notes = {
    userId: user.id,
    tierId: tier.id,
    interval: input.interval,
    change: quote.kind,
  };

  let razorpayPlanId: string | null = null;
  try {
    razorpayPlanId = await planIdFor(tier, input.interval, quote.listPaise);
  } catch {
    razorpayPlanId = null;
  }

  if (due === 0) {
    const order = await applyComplimentarySwitch({
      user,
      tierId: tier.id,
      interval: input.interval,
      quote,
      changeKind: dbChangeKind(quote.kind),
      razorpayPlanId,
    });
    await recordAudit({
      action: AuditAction.MembershipPaymentCaptured,
      actorUserId: user.id,
      actorClerkId: guard.ctx.clerkId,
      actorRole: guard.ctx.role,
      targetType: "membership_order",
      targetId: order.id,
      context: contextFromRequest(request),
      metadata: {
        source: "credit_switch",
        kind: quote.kind,
        creditPaise: quote.creditPaise,
        to: tier.name,
      },
    });
    return Response.json({
      ok: true,
      applied: true,
      duePaise: 0,
      expiresAt: quote.expiresAt.toISOString(),
    });
  }

  let razorpayOrderId: string | null = null;
  let razorpaySubscriptionId: string | null = null;
  let recurring = false;
  const restartTerm = switching;

  if (!switching) {
    try {
      if (!razorpayPlanId) throw new Error("no plan");
      const subscription = await createRazorpaySubscription({ planId: razorpayPlanId, notes });
      razorpaySubscriptionId = subscription.id;
      recurring = true;
    } catch {
      const receipt = `ainf_${user.id.slice(-8)}_${Date.now().toString(36)}`;
      const order = await createRazorpayOrder({ amountPaise: due, receipt, notes });
      razorpayOrderId = order.id;
    }
  } else {
    const receipt = `ainf_${user.id.slice(-8)}_${Date.now().toString(36)}`;
    const order = await createRazorpayOrder({ amountPaise: due, receipt, notes });
    razorpayOrderId = order.id;
  }

  const order = await db.membershipOrder.create({
    data: {
      userId: user.id,
      tierId: tier.id,
      interval: input.interval,
      amountPaise: due,
      listPaise: quote.listPaise,
      creditPaise: quote.creditPaise,
      offerId: quote.offerId,
      previousTierId: user.membershipTierId,
      changeKind: dbChangeKind(quote.kind),
      restartTerm,
      recurring,
      razorpayOrderId,
      razorpaySubscriptionId,
      razorpayPlanId,
    },
  });

  await recordAudit({
    action: AuditAction.MembershipOrderCreated,
    actorUserId: user.id,
    actorClerkId: guard.ctx.clerkId,
    actorRole: guard.ctx.role,
    targetType: "membership_order",
    targetId: order.id,
    context: contextFromRequest(request),
    metadata: {
      name: tier.name,
      interval: input.interval,
      amountPaise: due,
      creditPaise: quote.creditPaise,
      kind: quote.kind,
      recurring,
      razorpayOrderId,
      razorpaySubscriptionId,
    },
  });

  const verb =
    quote.kind === "upgrade" ? "Upgrade to" : quote.kind === "downgrade" ? "Downgrade to" : "AINF membership";

  return Response.json({
    ok: true,
    applied: false,
    orderId: order.id,
    razorpayOrderId,
    razorpaySubscriptionId,
    recurring,
    amountPaise: due,
    currency: "INR",
    keyId: env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    name: "AINF membership",
    description: `${verb} ${tier.name} · ${input.interval === "YEARLY" ? "yearly" : "monthly"}${
      quote.creditPaise ? ` · ${quote.creditPaise / 100} credit applied` : ""
    }`,
    prefill: {
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(" "),
    },
  });
}
