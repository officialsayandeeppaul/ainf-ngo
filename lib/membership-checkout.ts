import {
  BillingInterval,
  MembershipChangeKind,
  type MembershipOffer,
  type MembershipTier,
  type User,
} from "@prisma/client";
import { db } from "./db";
import { chargePaise } from "./membership";
import {
  changeKindToDb,
  offerAppliesNow,
  pickBestOffer,
  quoteMembershipChange,
  type MembershipQuote,
  type OfferInput,
} from "./membership-quote";
import { membershipIsLive } from "./membership-state";

function pricingOf(tier: MembershipTier) {
  return {
    monthlyPaise: tier.monthlyPaise,
    yearlyDiscountKind: tier.yearlyDiscountKind,
    yearlyDiscountValue: tier.yearlyDiscountValue,
  };
}

function asOffer(offer: MembershipOffer): OfferInput {
  return { id: offer.id, name: offer.name, kind: offer.kind, value: offer.value };
}

export async function offersForCheckout(
  tierId: string,
  interval: BillingInterval,
  firstCycle: boolean,
  now = new Date()
): Promise<OfferInput[]> {
  const rows = await db.membershipOffer.findMany({
    where: { active: true, plans: { some: { tierId } } },
  });
  return rows
    .filter((row) =>
      offerAppliesNow(
        {
          active: row.active,
          interval: row.interval,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          firstCycleOnly: row.firstCycleOnly,
        },
        interval,
        firstCycle,
        now
      )
    )
    .map(asOffer);
}

export async function quoteForUser(input: {
  user: User & { membershipTier?: MembershipTier | null };
  tier: MembershipTier;
  interval: BillingInterval;
  now?: Date;
}): Promise<MembershipQuote> {
  const now = input.now ?? new Date();
  const live = membershipIsLive(input.user, now);
  const fromTier = input.user.membershipTier ?? null;
  const fromInterval: "MONTHLY" | "YEARLY" =
    input.user.membershipInterval === BillingInterval.YEARLY ? "YEARLY" : "MONTHLY";
  const from = {
    tierId: input.user.membershipTierId,
    monthlyPaise: fromTier?.monthlyPaise ?? 0,
    interval: fromInterval,
    expiresAt: input.user.membershipExpiresAt,
    periodStartedAt: input.user.membershipPeriodStartedAt,
    termPaise:
      input.user.membershipTermPaise ??
      (fromTier ? chargePaise(pricingOf(fromTier), fromInterval) : null),
  };
  const to = {
    tierId: input.tier.id,
    interval: input.interval,
    pricing: pricingOf(input.tier),
  };
  const skeleton = quoteMembershipChange({ now, live, from, to, offer: null });
  const offer = pickBestOffer(
    skeleton.listPaise,
    await offersForCheckout(input.tier.id, input.interval, skeleton.kind !== "same", now)
  );
  return quoteMembershipChange({ now, live, from, to, offer });
}

export function dbChangeKind(kind: MembershipQuote["kind"]): MembershipChangeKind {
  return changeKindToDb(kind) as MembershipChangeKind;
}
