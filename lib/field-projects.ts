import { fieldProjectDelegate } from "@/lib/db";
import { normalizeDetail, type ProjectDetail } from "@/lib/project-detail";

export type { ProjectDetail };

export type FieldProjectView = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  raisedLabel: string;
  goalLabel: string;
  imageUrl: string;
  detail: ProjectDetail;
  href: string;
  sortOrder: number;
  published: boolean;
  acceptDonations: boolean;
  donateMinPaise: number | null;
  updatedAt: string;
};

type FieldProjectRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  raisedLabel: string;
  goalLabel: string;
  imageUrl: string;
  detail: unknown;
  sortOrder: number;
  published: boolean;
  acceptDonations: boolean;
  donateMinPaise: number | null;
  updatedAt: Date;
  updatedByUserId: string | null;
};

/** Shown when the table is empty or the database is not ready yet. */
export const FIELD_PROJECT_DEFAULTS: FieldProjectView[] = [
  {
    id: "proj_swasthya",
    slug: "medical-aid-health-camps",
    title: "Swasthya Camps",
    summary: "Checkups, referrals, and medicines for families in Nala, Jamtara, and nearby blocks.",
    raisedLabel: "₹75k",
    goalLabel: "₹100k",
    imageUrl: "/assets/img/hero-third/518fb7f61a5e6510.webp",
    detail: normalizeDetail(null, "medical-aid-health-camps"),
    href: "/projects/medical-aid-health-camps",
    sortOrder: 0,
    published: true,
    acceptDonations: false,
    donateMinPaise: null,
    updatedAt: "2026-09-27T00:00:00.000Z",
  },
  {
    id: "proj_meals",
    slug: "daily-meal-program",
    title: "Daily Meal Program",
    summary: "A meal with the coaching batch, so hunger never sends a student home before class ends.",
    raisedLabel: "₹50k",
    goalLabel: "₹65k",
    imageUrl: "/assets/img/hero-third/4a27119994acc349.webp",
    detail: normalizeDetail(null, "daily-meal-program"),
    href: "/projects/daily-meal-program",
    sortOrder: 1,
    published: true,
    acceptDonations: false,
    donateMinPaise: null,
    updatedAt: "2026-09-27T00:00:00.000Z",
  },
  {
    id: "proj_shiksha",
    slug: "education-support-drive",
    title: "Education Support Drive",
    summary: "Books, uniforms, and fees so a child in our blocks does not have to leave class.",
    raisedLabel: "₹25k",
    goalLabel: "₹40k",
    imageUrl: "/assets/img/home-sixth/ce25dc676c029d0e.webp",
    detail: normalizeDetail(null, "education-support-drive"),
    href: "/projects/education-support-drive",
    sortOrder: 2,
    published: true,
    acceptDonations: false,
    donateMinPaise: null,
    updatedAt: "2026-09-27T00:00:00.000Z",
  },
  {
    id: "proj_winter",
    slug: "winter-relief-program",
    title: "Winter Kits for Our Blocks",
    summary: "Blankets and warm sets for families in our blocks when the cold sets in.",
    raisedLabel: "₹40k",
    goalLabel: "₹80k",
    imageUrl: "/assets/img/hero-third/9fzzlw9fzzlw9fzz.webp",
    detail: normalizeDetail(null, "winter-relief-program"),
    href: "/projects/winter-relief-program",
    sortOrder: 3,
    published: true,
    acceptDonations: false,
    donateMinPaise: null,
    updatedAt: "2026-09-27T00:00:00.000Z",
  },
  {
    id: "proj_water",
    slug: "clean-water-initiative",
    title: "Safe Water in Our Hamlets",
    summary: "Safe drinking water for hamlets where the source turns bad after the rains.",
    raisedLabel: "₹30k",
    goalLabel: "₹90k",
    imageUrl: "/assets/img/hero-third/571e61ddc71daaf0.webp",
    detail: normalizeDetail(null, "clean-water-initiative"),
    href: "/projects/clean-water-initiative",
    sortOrder: 4,
    published: true,
    acceptDonations: false,
    donateMinPaise: null,
    updatedAt: "2026-09-27T00:00:00.000Z",
  },
];

export function toFieldProjectView(row: FieldProjectRow): FieldProjectView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    raisedLabel: row.raisedLabel,
    goalLabel: row.goalLabel,
    imageUrl: row.imageUrl,
    detail: normalizeDetail(row.detail, row.slug),
    href: `/projects/${row.slug}`,
    sortOrder: row.sortOrder,
    published: row.published,
    acceptDonations: row.acceptDonations,
    donateMinPaise: row.donateMinPaise,
    updatedAt: row.updatedAt.toISOString(),
  };
}

type ProjectDelegate = {
  findMany: (args: unknown) => Promise<FieldProjectRow[]>;
  create: (args: unknown) => Promise<FieldProjectRow>;
  update: (args: unknown) => Promise<FieldProjectRow>;
  delete: (args: unknown) => Promise<FieldProjectRow>;
};

export function projectsDelegate(): ProjectDelegate | null {
  return fieldProjectDelegate() as ProjectDelegate | null;
}

export async function listFieldProjects(): Promise<FieldProjectView[] | null> {
  const delegate = projectsDelegate();
  if (!delegate) return null;
  try {
    const rows = await delegate.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }] });
    if (!rows.length) return FIELD_PROJECT_DEFAULTS;
    return rows.map(toFieldProjectView);
  } catch {
    return null;
  }
}

export async function listPublicFieldProjects(): Promise<FieldProjectView[]> {
  const rows = await listFieldProjects();
  const source = rows ?? FIELD_PROJECT_DEFAULTS;
  return source.filter((row) => row.published).sort((a, b) => a.sortOrder - b.sortOrder);
}
