export type YearlyDiscountKind = "NONE" | "PERCENT" | "FLAT";

export type TierPricingInput = {
  monthlyPaise: number;
  yearlyDiscountKind: YearlyDiscountKind;
  yearlyDiscountValue: number;
};

export const BADGE_COLORS = [
  { id: "#39a46b", label: "Green" },
  { id: "#c9a227", label: "Gold" },
  { id: "#1f6f8b", label: "Blue" },
  { id: "#b26a00", label: "Amber" },
  { id: "#8e3a59", label: "Rose" },
  { id: "#3d4a44", label: "Slate" },
] as const;

export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees) || rupees < 0) return 0;
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

export function formatInr(paise: number): string {
  const negative = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100);
  const fraction = abs % 100;
  const body = fraction === 0 ? String(rupees) : `${rupees}.${String(fraction).padStart(2, "0")}`;
  return `${negative ? "-" : ""}₹${body}`;
}

export function yearlyPaise(input: TierPricingInput): number {
  const monthly = Math.max(0, Math.round(input.monthlyPaise));
  const full = monthly * 12;
  if (input.yearlyDiscountKind === "NONE") return full;
  if (input.yearlyDiscountKind === "PERCENT") {
    const pct = Math.min(90, Math.max(0, input.yearlyDiscountValue));
    return Math.max(0, Math.round(full * (1 - pct / 100)));
  }
  const off = Math.max(0, Math.round(input.yearlyDiscountValue));
  return Math.max(0, full - off);
}

export function yearlySavingsPaise(input: TierPricingInput): number {
  return Math.max(0, Math.round(input.monthlyPaise) * 12 - yearlyPaise(input));
}

export function chargePaise(input: TierPricingInput, interval: "MONTHLY" | "YEARLY"): number {
  return interval === "YEARLY" ? yearlyPaise(input) : Math.max(0, Math.round(input.monthlyPaise));
}

export function slugifyTierName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "member";
}

export function discountLabel(kind: YearlyDiscountKind, value: number): string {
  if (kind === "NONE" || value <= 0) return "No yearly discount";
  if (kind === "PERCENT") return `${value}% off yearly`;
  return `${formatInr(value)} off yearly`;
}
