import { KycStatus, Prisma, Role, UserStatus } from "@prisma/client";

export const CRM_PAGE_SIZE = 24;

export const CRM_MEMBERSHIP = ["live", "none", "canceling", "lapsed"] as const;
export const CRM_SEEN = ["recent", "stale", "never"] as const;
export const CRM_SORT = ["newest", "oldest", "seen", "name"] as const;

export type CrmMembershipFilter = (typeof CRM_MEMBERSHIP)[number];
export type CrmSeenFilter = (typeof CRM_SEEN)[number];
export type CrmSort = (typeof CRM_SORT)[number];

export type CrmQuery = {
  q: string;
  role?: Role;
  status?: UserStatus;
  kyc?: KycStatus;
  membership?: CrmMembershipFilter;
  plan?: string;
  seen?: CrmSeenFilter;
  joinedFrom?: string;
  joinedTo?: string;
  sort: CrmSort;
  page: number;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function pickEnum<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export function parseDayStart(value: string | undefined): Date | undefined {
  if (!value || !DAY.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function parseCrmQuery(params: {
  q?: string;
  role?: string;
  status?: string;
  kyc?: string;
  membership?: string;
  plan?: string;
  seen?: string;
  joinedFrom?: string;
  joinedTo?: string;
  sort?: string;
  page?: string;
}): CrmQuery {
  const joinedFrom = parseDayStart(params.joinedFrom) ? params.joinedFrom!.trim() : undefined;
  const joinedTo = parseDayStart(params.joinedTo) ? params.joinedTo!.trim() : undefined;
  return {
    q: (params.q ?? "").trim(),
    role: pickEnum(params.role, Object.values(Role)),
    status: pickEnum(params.status, Object.values(UserStatus)),
    kyc: pickEnum(params.kyc, Object.values(KycStatus)),
    membership: pickEnum(params.membership, CRM_MEMBERSHIP),
    plan: params.plan?.trim() || undefined,
    seen: pickEnum(params.seen, CRM_SEEN),
    joinedFrom,
    joinedTo,
    sort: pickEnum(params.sort, CRM_SORT) ?? "newest",
    page: Math.max(1, Number(params.page ?? "1") || 1),
  };
}

export function crmUserOrder(sort: CrmSort): Prisma.UserOrderByWithRelationInput[] {
  if (sort === "oldest") return [{ createdAt: "asc" }, { id: "asc" }];
  if (sort === "seen") return [{ lastSeenAt: "desc" }, { createdAt: "desc" }];
  if (sort === "name") return [{ lastName: "asc" }, { firstName: "asc" }, { email: "asc" }];
  return [{ createdAt: "desc" }, { id: "desc" }];
}

export function crmUserWhere(query: CrmQuery, now = new Date()): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];

  if (query.role) and.push({ role: query.role });
  if (query.status) and.push({ status: query.status });
  if (query.kyc) and.push({ kycStatus: query.kyc });
  if (query.plan) and.push({ membershipTierId: query.plan });

  if (query.q) {
    and.push({
      OR: [
        { email: { contains: query.q, mode: "insensitive" } },
        { firstName: { contains: query.q, mode: "insensitive" } },
        { lastName: { contains: query.q, mode: "insensitive" } },
        { clerkId: { contains: query.q, mode: "insensitive" } },
        { phone: { contains: query.q } },
      ],
    });
  }

  const from = parseDayStart(query.joinedFrom);
  const to = parseDayStart(query.joinedTo);
  if (from || to) {
    and.push({
      createdAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lt: new Date(to.getTime() + 24 * 60 * 60 * 1000) } : {}),
      },
    });
  }

  if (query.seen === "never") {
    and.push({ lastSeenAt: null });
  } else if (query.seen === "recent") {
    and.push({ lastSeenAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } });
  } else if (query.seen === "stale") {
    and.push({ lastSeenAt: { lte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } });
  }

  if (query.membership === "live") {
    and.push({
      membershipTierId: { not: null },
      membershipExpiresAt: { gt: now },
    });
  } else if (query.membership === "canceling") {
    and.push({
      membershipTierId: { not: null },
      membershipExpiresAt: { gt: now },
      membershipCancelAtPeriodEnd: true,
    });
  } else if (query.membership === "none") {
    and.push({ membershipOrders: { none: { status: "PAID" } } });
  } else if (query.membership === "lapsed") {
    and.push({
      membershipOrders: { some: { status: "PAID" } },
      OR: [{ membershipTierId: null }, { membershipExpiresAt: { lte: now } }],
    });
  }

  return and.length === 1 ? and[0]! : and.length > 1 ? { AND: and } : {};
}

export function crmListHref(query: CrmQuery, page = query.page): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.role) params.set("role", query.role);
  if (query.status) params.set("status", query.status);
  if (query.kyc) params.set("kyc", query.kyc);
  if (query.membership) params.set("membership", query.membership);
  if (query.plan) params.set("plan", query.plan);
  if (query.seen) params.set("seen", query.seen);
  if (query.joinedFrom) params.set("joinedFrom", query.joinedFrom);
  if (query.joinedTo) params.set("joinedTo", query.joinedTo);
  if (query.sort && query.sort !== "newest") params.set("sort", query.sort);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/crm?${qs}` : "/admin/crm";
}
