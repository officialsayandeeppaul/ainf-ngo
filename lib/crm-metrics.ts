export type PaidPoint = {
  paidAt: Date | null;
  createdAt: Date;
  amountPaise: number;
  tierName?: string;
};

export function monthKeyUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabelUtc(key: string): string {
  const [year, month] = key.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const index = Number(month) - 1;
  return `${names[index] ?? month} ${year?.slice(2) ?? ""}`.trim();
}

export function lastMonthKeys(count: number, now = new Date()): string[] {
  const keys: string[] = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = count - 1; i >= 0; i -= 1) {
    const stamp = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - i, 1));
    keys.push(monthKeyUtc(stamp));
  }
  return keys;
}

export function paidByMonth(orders: PaidPoint[], months = 6, now = new Date()) {
  const keys = lastMonthKeys(months, now);
  const totals = new Map(keys.map((key) => [key, 0]));
  for (const order of orders) {
    const when = order.paidAt ?? order.createdAt;
    const key = monthKeyUtc(when);
    if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + order.amountPaise);
  }
  return keys.map((key) => ({
    key,
    label: monthLabelUtc(key),
    paise: totals.get(key) ?? 0,
  }));
}

export function paidByPlan(orders: Array<{ tierName: string; amountPaise: number }>) {
  const totals = new Map<string, number>();
  for (const order of orders) {
    totals.set(order.tierName, (totals.get(order.tierName) ?? 0) + order.amountPaise);
  }
  return [...totals.entries()]
    .map(([label, paise]) => ({ label, paise }))
    .sort((a, b) => b.paise - a.paise);
}

export function sumPaise(orders: Array<{ amountPaise: number }>): number {
  return orders.reduce((sum, order) => sum + order.amountPaise, 0);
}
