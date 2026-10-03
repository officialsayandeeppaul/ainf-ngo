import { chargePaise, type TierPricingInput } from "./membership";
import { addUtcMonths, nextExpiry } from "./membership-state";

export type ChangeKind = "new" | "same" | "upgrade" | "downgrade" | "interval";

export type OfferInput = {
  id: string;
  name: string;
  kind: "PERCENT" | "FLAT";
  value: number;
};

export type MembershipQuote = {
  kind: ChangeKind;
  listPaise: number;
  offerId: string | null;
  offerName: string | null;
  offerOffPaise: number;
  payablePaise: number;
  creditPaise: number;
  leftoverPaise: number;
  duePaise: number;
  periodStartsAt: Date;
  expiresAt: Date;
};

export function inferPeriodStart(expiresAt: Date, interval: "MONTHLY" | "YEARLY"): Date {
  if (interval === "YEARLY") {
    const start = new Date(expiresAt.getTime());
    start.setUTCFullYear(start.getUTCFullYear() - 1);
    return start;
  }
  return addUtcMonths(expiresAt, -1);
}

export function classifyChange(input: {
  live: boolean;
  fromTierId: string | null;
  fromMonthlyPaise: number;
  fromInterval: "MONTHLY" | "YEARLY";
  toTierId: string;
  toMonthlyPaise: number;
  toInterval: "MONTHLY" | "YEARLY";
}): ChangeKind {
  if (!input.live || !input.fromTierId) return "new";
  if (input.fromTierId === input.toTierId && input.fromInterval === input.toInterval) return "same";
  if (input.fromTierId === input.toTierId) return "interval";
  if (input.toMonthlyPaise > input.fromMonthlyPaise) return "upgrade";
  if (input.toMonthlyPaise < input.fromMonthlyPaise) return "downgrade";
  return "upgrade";
}

export function unusedCreditPaise(input: {
  termPaise: number;
  periodStart: Date;
  periodEnd: Date;
  now?: Date;
}): number {
  const now = input.now ?? new Date();
  const total = input.periodEnd.getTime() - input.periodStart.getTime();
  if (total <= 0 || input.termPaise <= 0) return 0;
  const left = input.periodEnd.getTime() - now.getTime();
  if (left <= 0) return 0;
  return Math.round(input.termPaise * Math.min(1, left / total));
}

export function applyOfferDiscount(
  listPaise: number,
  offer: { kind: "PERCENT" | "FLAT"; value: number } | null
): { payablePaise: number; offPaise: number } {
  const list = Math.max(0, Math.round(listPaise));
  if (!offer) return { payablePaise: list, offPaise: 0 };
  if (offer.kind === "PERCENT") {
    const pct = Math.min(90, Math.max(0, offer.value));
    const payablePaise = Math.max(0, Math.round(list * (1 - pct / 100)));
    return { payablePaise, offPaise: list - payablePaise };
  }
  const offPaise = Math.min(list, Math.max(0, Math.round(offer.value)));
  return { payablePaise: list - offPaise, offPaise };
}

export function pickBestOffer(listPaise: number, offers: OfferInput[]): OfferInput | null {
  let best: OfferInput | null = null;
  let bestOff = 0;
  for (const offer of offers) {
    const { offPaise } = applyOfferDiscount(listPaise, offer);
    if (offPaise > bestOff) {
      best = offer;
      bestOff = offPaise;
    }
  }
  return best;
}

export function offerAppliesNow(
  offer: {
    active: boolean;
    interval: "MONTHLY" | "YEARLY" | null;
    startsAt: Date | null;
    endsAt: Date | null;
    firstCycleOnly: boolean;
  },
  interval: "MONTHLY" | "YEARLY",
  firstCycle: boolean,
  now = new Date()
): boolean {
  if (!offer.active) return false;
  if (offer.interval && offer.interval !== interval) return false;
  if (offer.firstCycleOnly && !firstCycle) return false;
  if (offer.startsAt && offer.startsAt.getTime() > now.getTime()) return false;
  if (offer.endsAt && offer.endsAt.getTime() <= now.getTime()) return false;
  return true;
}

function leftoverMs(leftoverPaise: number, payablePaise: number, periodStart: Date, periodEnd: Date): number {
  const termMs = periodEnd.getTime() - periodStart.getTime();
  if (leftoverPaise <= 0 || payablePaise <= 0 || termMs <= 0) return 0;
  return (leftoverPaise / payablePaise) * termMs;
}

export function quoteMembershipChange(input: {
  now?: Date;
  live: boolean;
  from: {
    tierId: string | null;
    monthlyPaise: number;
    interval: "MONTHLY" | "YEARLY";
    expiresAt: Date | null;
    periodStartedAt: Date | null;
    termPaise: number | null;
  };
  to: {
    tierId: string;
    interval: "MONTHLY" | "YEARLY";
    pricing: TierPricingInput;
  };
  offer: OfferInput | null;
}): MembershipQuote {
  const now = input.now ?? new Date();
  const listPaise = chargePaise(input.to.pricing, input.to.interval);
  const kind = classifyChange({
    live: input.live,
    fromTierId: input.from.tierId,
    fromMonthlyPaise: input.from.monthlyPaise,
    fromInterval: input.from.interval,
    toTierId: input.to.tierId,
    toMonthlyPaise: input.to.pricing.monthlyPaise,
    toInterval: input.to.interval,
  });
  const firstCycle = kind !== "same";
  const offer = firstCycle ? input.offer : null;
  const discounted = applyOfferDiscount(listPaise, offer);
  const periodStartsAt = now;
  let expiresAt = nextExpiry(now, input.to.interval);

  if (kind === "same" || kind === "new" || !input.live || !input.from.expiresAt) {
    return {
      kind,
      listPaise,
      offerId: offer?.id ?? null,
      offerName: offer?.name ?? null,
      offerOffPaise: discounted.offPaise,
      payablePaise: discounted.payablePaise,
      creditPaise: 0,
      leftoverPaise: 0,
      duePaise: discounted.payablePaise,
      periodStartsAt,
      expiresAt,
    };
  }

  const periodEnd = input.from.expiresAt;
  const periodStart =
    input.from.periodStartedAt ?? inferPeriodStart(periodEnd, input.from.interval);
  const termPaise = input.from.termPaise ?? 0;
  const creditPaise = unusedCreditPaise({
    termPaise,
    periodStart,
    periodEnd,
    now,
  });
  const duePaise = Math.max(0, discounted.payablePaise - creditPaise);
  const leftoverPaise = Math.max(0, creditPaise - discounted.payablePaise);
  expiresAt = new Date(
    expiresAt.getTime() + leftoverMs(leftoverPaise, discounted.payablePaise, periodStartsAt, expiresAt)
  );

  return {
    kind,
    listPaise,
    offerId: offer?.id ?? null,
    offerName: offer?.name ?? null,
    offerOffPaise: discounted.offPaise,
    payablePaise: discounted.payablePaise,
    creditPaise,
    leftoverPaise,
    duePaise,
    periodStartsAt,
    expiresAt,
  };
}

export function changeKindToDb(
  kind: ChangeKind
): "NEW" | "UPGRADE" | "DOWNGRADE" | "INTERVAL_CHANGE" {
  if (kind === "upgrade") return "UPGRADE";
  if (kind === "downgrade") return "DOWNGRADE";
  if (kind === "interval") return "INTERVAL_CHANGE";
  return "NEW";
}

export function razorpayDuePaise(duePaise: number): number {
  if (duePaise <= 0) return 0;
  return Math.max(100, duePaise);
}
