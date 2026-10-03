import { KycStatus, Role, UserStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { crmListHref, crmUserOrder, crmUserWhere, parseCrmQuery, parseDayStart } from "@/lib/crm-filters";

describe("parseCrmQuery", () => {
  it("trims search and rejects unknown enums", () => {
    const query = parseCrmQuery({
      q: "  ada@ainf.in  ",
      role: "WIZARD",
      status: UserStatus.SUSPENDED,
      kyc: KycStatus.APPROVED,
      membership: "lapsed",
      seen: "never",
      joinedFrom: "not-a-day",
      page: "0",
    });
    expect(query).toMatchObject({
      q: "ada@ainf.in",
      role: undefined,
      status: UserStatus.SUSPENDED,
      kyc: KycStatus.APPROVED,
      membership: "lapsed",
      seen: "never",
      joinedFrom: undefined,
      sort: "newest",
      page: 1,
    });
  });

  it("accepts a known sort and ignores an unknown one", () => {
    expect(parseCrmQuery({ sort: "seen" }).sort).toBe("seen");
    expect(parseCrmQuery({ sort: "paid" }).sort).toBe("newest");
    expect(crmUserOrder("name")).toEqual([{ lastName: "asc" }, { firstName: "asc" }, { email: "asc" }]);
  });

  it("keeps a valid joined range", () => {
    const query = parseCrmQuery({ joinedFrom: "2026-01-01", joinedTo: "2026-01-31", page: "3" });
    expect(query.joinedFrom).toBe("2026-01-01");
    expect(query.joinedTo).toBe("2026-01-31");
    expect(query.page).toBe(3);
  });
});

describe("crmUserWhere", () => {
  const now = new Date("2026-09-03T06:00:00.000Z");

  it("searches email, name, clerk id, and phone together", () => {
    const where = crmUserWhere(parseCrmQuery({ q: "Ada" }), now);
    expect(where).toEqual({
      OR: [
        { email: { contains: "Ada", mode: "insensitive" } },
        { firstName: { contains: "Ada", mode: "insensitive" } },
        { lastName: { contains: "Ada", mode: "insensitive" } },
        { clerkId: { contains: "Ada", mode: "insensitive" } },
        { phone: { contains: "Ada" } },
      ],
    });
  });

  it("combines live membership with role", () => {
    const where = crmUserWhere(parseCrmQuery({ role: Role.VERIFIED_USER, membership: "live" }), now);
    expect(where).toEqual({
      AND: [
        { role: Role.VERIFIED_USER },
        { membershipTierId: { not: null }, membershipExpiresAt: { gt: now } },
      ],
    });
  });

  it("treats never-paid members as none and paid-but-ended as lapsed", () => {
    expect(crmUserWhere(parseCrmQuery({ membership: "none" }), now)).toEqual({
      membershipOrders: { none: { status: "PAID" } },
    });
    expect(crmUserWhere(parseCrmQuery({ membership: "lapsed" }), now)).toEqual({
      membershipOrders: { some: { status: "PAID" } },
      OR: [{ membershipTierId: null }, { membershipExpiresAt: { lte: now } }],
    });
  });

  it("filters last seen and joined dates", () => {
    const where = crmUserWhere(
      parseCrmQuery({ seen: "recent", joinedFrom: "2026-08-01", joinedTo: "2026-08-31" }),
      now
    );
    expect(where).toEqual({
      AND: [
        {
          createdAt: {
            gte: parseDayStart("2026-08-01"),
            lt: new Date(parseDayStart("2026-08-31")!.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        { lastSeenAt: { gte: new Date("2026-08-27T06:00:00.000Z") } },
      ],
    });
  });
});

describe("crmListHref", () => {
  it("omits empty filters and page 1", () => {
    expect(crmListHref(parseCrmQuery({}))).toBe("/admin/crm");
    expect(crmListHref(parseCrmQuery({ q: "ada", membership: "live", sort: "seen", page: "2" }))).toBe(
      "/admin/crm?q=ada&membership=live&sort=seen&page=2"
    );
  });
});
