import { MembershipOrderStatus, type Prisma } from "@prisma/client";
import { lastMonthKeys, monthKeyUtc, monthLabelUtc, paidByMonth, paidByPlan } from "@/lib/crm-metrics";

export type RevenueOrderRow = {
  id: string;
  amountPaise: number;
  creditPaise: number;
  listPaise: number | null;
  interval: "MONTHLY" | "YEARLY";
  changeKind: string;
  recurring: boolean;
  status: MembershipOrderStatus;
  paidAt: Date | null;
  createdAt: Date;
  razorpayPaymentId: string | null;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  tier: { name: string; badge: string };
  offer: { name: string } | null;
};

export type RevenueSnapshot = {
  paidTotalPaise: number;
  paidCount: number;
  refundCreditPaise: number;
  liveMembers: number;
  payingMembers: number;
  monthlyPaise: number;
  yearlyPaise: number;
  createdCount: number;
  failedCount: number;
  cancelledCount: number;
  byMonth: Array<{ key: string; label: string; paise: number }>;
  byPlan: Array<{ label: string; paise: number }>;
  byKind: Array<{ label: string; count: number; paise: number }>;
};

const KIND_LABEL: Record<string, string> = {
  NEW: "New",
  RENEWAL: "Renewal",
  UPGRADE: "Upgrade",
  DOWNGRADE: "Downgrade",
  INTERVAL_CHANGE: "Cycle change",
};

export function revenueKindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}

export function parseRevenueDay(value: string | undefined, end = false): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function revenuePaidWhere(from: Date | null, to: Date | null): Prisma.MembershipOrderWhereInput {
  const paidAt: Prisma.DateTimeFilter | undefined =
    from || to
      ? {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        }
      : undefined;
  return {
    status: MembershipOrderStatus.PAID,
    ...(paidAt ? { paidAt } : {}),
  };
}

export function buildRevenueSnapshot(input: {
  paidOrders: Array<{
    amountPaise: number;
    creditPaise: number;
    interval: "MONTHLY" | "YEARLY";
    changeKind: string;
    paidAt: Date | null;
    createdAt: Date;
    tierName: string;
  }>;
  liveMembers: number;
  payingMembers: number;
  createdCount: number;
  failedCount: number;
  cancelledCount: number;
  now?: Date;
}): RevenueSnapshot {
  const now = input.now ?? new Date();
  const paidTotalPaise = input.paidOrders.reduce((sum, row) => sum + row.amountPaise, 0);
  const refundCreditPaise = input.paidOrders.reduce((sum, row) => sum + row.creditPaise, 0);
  const monthlyPaise = input.paidOrders
    .filter((row) => row.interval === "MONTHLY")
    .reduce((sum, row) => sum + row.amountPaise, 0);
  const yearlyPaise = input.paidOrders
    .filter((row) => row.interval === "YEARLY")
    .reduce((sum, row) => sum + row.amountPaise, 0);

  const kindMap = new Map<string, { count: number; paise: number }>();
  for (const row of input.paidOrders) {
    const current = kindMap.get(row.changeKind) ?? { count: 0, paise: 0 };
    kindMap.set(row.changeKind, {
      count: current.count + 1,
      paise: current.paise + row.amountPaise,
    });
  }

  return {
    paidTotalPaise,
    paidCount: input.paidOrders.length,
    refundCreditPaise,
    liveMembers: input.liveMembers,
    payingMembers: input.payingMembers,
    monthlyPaise,
    yearlyPaise,
    createdCount: input.createdCount,
    failedCount: input.failedCount,
    cancelledCount: input.cancelledCount,
    byMonth: paidByMonth(
      input.paidOrders.map((row) => ({
        paidAt: row.paidAt,
        createdAt: row.createdAt,
        amountPaise: row.amountPaise,
      })),
      12,
      now
    ),
    byPlan: paidByPlan(
      input.paidOrders.map((row) => ({
        tierName: row.tierName,
        amountPaise: row.amountPaise,
      }))
    ),
    byKind: [...kindMap.entries()]
      .map(([kind, stats]) => ({
        label: revenueKindLabel(kind),
        count: stats.count,
        paise: stats.paise,
      }))
      .sort((a, b) => b.paise - a.paise),
  };
}

/** Keep month helpers available for tests / charts without re-export noise. */
export { lastMonthKeys, monthKeyUtc, monthLabelUtc };
