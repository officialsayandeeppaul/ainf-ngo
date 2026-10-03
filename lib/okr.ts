export type OkrStatus = "on_track" | "at_risk" | "done";

export type OkrKeyResult = {
  label: string;
  current: number;
  target: number;
  unit: string;
};

export type Okr = {
  id: string;
  cycle: string;
  objective: string;
  owner: string;
  status: OkrStatus;
  keyResults: OkrKeyResult[];
};

/** AINF programme OKRs. Catalog is paginated on the portal OKR page. */
export const OKRS: Okr[] = [
  {
    id: "edu-access",
    cycle: "2026 H2",
    objective: "Widen learning access in the districts we already serve",
    owner: "Education",
    status: "on_track",
    keyResults: [
      { label: "Learners enrolled this cycle", current: 1840, target: 2500, unit: "" },
      { label: "Learning centres open", current: 11, target: 14, unit: "" },
      { label: "Volunteer teaching hours", current: 620, target: 900, unit: "h" },
    ],
  },
  {
    id: "health-camps",
    cycle: "2026 H2",
    objective: "Run reliable community health camps with follow-up",
    owner: "Health",
    status: "on_track",
    keyResults: [
      { label: "Camps completed", current: 7, target: 12, unit: "" },
      { label: "People screened", current: 2100, target: 4000, unit: "" },
      { label: "Follow-up cases closed", current: 310, target: 500, unit: "" },
    ],
  },
  {
    id: "livelihood",
    cycle: "2026 H2",
    objective: "Put more households on a stable income path",
    owner: "Livelihoods",
    status: "at_risk",
    keyResults: [
      { label: "People trained", current: 140, target: 300, unit: "" },
      { label: "Placed in work or self-employed", current: 48, target: 120, unit: "" },
    ],
  },
  {
    id: "verify-members",
    cycle: "2026 H2",
    objective: "Keep the member roll verified without leaking identity data",
    owner: "Platform",
    status: "on_track",
    keyResults: [
      { label: "Verified members", current: 1, target: 200, unit: "" },
      { label: "PAN stored as hash only", current: 100, target: 100, unit: "%" },
    ],
  },
  {
    id: "stories",
    cycle: "2026 H2",
    objective: "Publish field stories that donors can trust",
    owner: "Communications",
    status: "on_track",
    keyResults: [
      { label: "Stories published", current: 9, target: 18, unit: "" },
      { label: "Field photos with consent on file", current: 100, target: 100, unit: "%" },
    ],
  },
  {
    id: "donors",
    cycle: "2026 H2",
    objective: "Grow recurring support without paid ads",
    owner: "Development",
    status: "at_risk",
    keyResults: [
      { label: "Monthly donors", current: 36, target: 80, unit: "" },
      { label: "Retention after 90 days", current: 71, target: 85, unit: "%" },
    ],
  },
  {
    id: "volunteer",
    cycle: "2026 H2",
    objective: "Build a volunteer bench that actually shows up",
    owner: "Community",
    status: "on_track",
    keyResults: [
      { label: "Active volunteers", current: 54, target: 80, unit: "" },
      { label: "Shifts fulfilled", current: 88, target: 95, unit: "%" },
    ],
  },
  {
    id: "transparency",
    cycle: "2026 H2",
    objective: "Make spend and impact visible on every public page",
    owner: "Finance",
    status: "done",
    keyResults: [
      { label: "Quarterly reports published", current: 2, target: 2, unit: "" },
      { label: "Projects with a live budget line", current: 100, target: 100, unit: "%" },
    ],
  },
];

export const OKR_PAGE_SIZE = 4;

export function paginateOkrs(page: number, pageSize = OKR_PAGE_SIZE) {
  const safe = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const pages = Math.max(1, Math.ceil(OKRS.length / pageSize));
  const current = Math.min(safe, pages);
  const start = (current - 1) * pageSize;
  return {
    page: current,
    pages,
    total: OKRS.length,
    items: OKRS.slice(start, start + pageSize),
  };
}

export function okrProgress(okr: Okr): number {
  if (!okr.keyResults.length) return 0;
  const scores = okr.keyResults.map((kr) =>
    kr.target <= 0 ? 0 : Math.min(100, (kr.current / kr.target) * 100)
  );
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
