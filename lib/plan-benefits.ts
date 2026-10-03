export type PlanBenefit = {
  label: string;
  included: boolean;
};

export const PLAN_BENEFIT_LIMIT = 16;
export const PLAN_BENEFIT_LABEL_MAX = 80;

/** Shared comparison lines so each plan can mark include vs not-included. */
export const PLAN_BENEFIT_CATALOG = [
  "Member badge on your account",
  "Monthly support for field programmes",
  "Name on the public donor roll",
  "Gold badge",
  "Field-visit invites",
  "Patron briefings and field access",
] as const;

export const SAMPLE_PLAN_BENEFITS: Record<string, PlanBenefit[]> = {
  friend: [
    { label: "Member badge on your account", included: true },
    { label: "Monthly support for field programmes", included: true },
    { label: "Name on the public donor roll", included: false },
    { label: "Gold badge", included: false },
    { label: "Field-visit invites", included: false },
    { label: "Patron briefings and field access", included: false },
  ],
  gold: [
    { label: "Member badge on your account", included: true },
    { label: "Monthly support for field programmes", included: true },
    { label: "Name on the public donor roll", included: true },
    { label: "Gold badge", included: true },
    { label: "Field-visit invites", included: false },
    { label: "Patron briefings and field access", included: false },
  ],
  patron: [
    { label: "Member badge on your account", included: true },
    { label: "Monthly support for field programmes", included: true },
    { label: "Name on the public donor roll", included: true },
    { label: "Gold badge", included: true },
    { label: "Field-visit invites", included: true },
    { label: "Patron briefings and field access", included: true },
  ],
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function emptyBenefit(included = true): PlanBenefit {
  return { label: "", included };
}

export function catalogBenefits(included = false): PlanBenefit[] {
  return PLAN_BENEFIT_CATALOG.map((label) => ({ label, included }));
}

export function normalizePlanBenefits(input: unknown): PlanBenefit[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: PlanBenefit[] = [];
  for (const row of input) {
    if (out.length >= PLAN_BENEFIT_LIMIT) break;
    const record = asRecord(row);
    const label = typeof record?.label === "string" ? record.label.trim().replace(/\s+/g, " ") : "";
    if (label.length < 2 || label.length > PLAN_BENEFIT_LABEL_MAX) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, included: record?.included !== false });
  }
  return out;
}

export function parsePlanBenefits(value: unknown): PlanBenefit[] {
  return normalizePlanBenefits(value);
}

export function mergeCatalog(existing: PlanBenefit[]): PlanBenefit[] {
  const have = new Set(existing.map((row) => row.label.toLowerCase()));
  const extra = PLAN_BENEFIT_CATALOG.filter((label) => !have.has(label.toLowerCase())).map((label) => ({
    label,
    included: false,
  }));
  return normalizePlanBenefits([...existing, ...extra]);
}
