import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  ROLE_RANK,
  dashboardPathFor,
  hasRole,
  isSuperAdmin,
  isVerified,
  roleFromUnknown,
} from "@/lib/auth/roles";

describe("role hierarchy", () => {
  it("orders roles by privilege", () => {
    expect(ROLE_RANK.USER).toBeLessThan(ROLE_RANK.VERIFIED_USER);
    expect(ROLE_RANK.VERIFIED_USER).toBeLessThan(ROLE_RANK.SUPER_ADMIN);
  });

  it("lets each role satisfy its own requirement", () => {
    expect(hasRole(Role.USER, Role.USER)).toBe(true);
    expect(hasRole(Role.VERIFIED_USER, Role.VERIFIED_USER)).toBe(true);
    expect(hasRole(Role.SUPER_ADMIN, Role.SUPER_ADMIN)).toBe(true);
  });

  it("lets a super admin satisfy every lower requirement", () => {
    expect(hasRole(Role.SUPER_ADMIN, Role.USER)).toBe(true);
    expect(hasRole(Role.SUPER_ADMIN, Role.VERIFIED_USER)).toBe(true);
  });

  it("does not let a plain member reach verified or admin surfaces", () => {
    expect(hasRole(Role.USER, Role.VERIFIED_USER)).toBe(false);
    expect(hasRole(Role.USER, Role.SUPER_ADMIN)).toBe(false);
  });

  it("does not let a verified member reach admin surfaces", () => {
    expect(hasRole(Role.VERIFIED_USER, Role.SUPER_ADMIN)).toBe(false);
  });

  it("treats absent roles as unauthorised", () => {
    expect(hasRole(null, Role.USER)).toBe(false);
    expect(hasRole(undefined, Role.USER)).toBe(false);
  });
});

describe("role predicates", () => {
  it("identifies super admins exactly", () => {
    expect(isSuperAdmin(Role.SUPER_ADMIN)).toBe(true);
    expect(isSuperAdmin(Role.VERIFIED_USER)).toBe(false);
    expect(isSuperAdmin(Role.USER)).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
  });

  it("treats super admins as verified", () => {
    expect(isVerified({ role: Role.SUPER_ADMIN })).toBe(true);
    expect(isVerified({ role: Role.VERIFIED_USER })).toBe(true);
    expect(isVerified({ role: Role.USER })).toBe(false);
    expect(isVerified(null)).toBe(false);
  });
});

describe("dashboard routing", () => {
  it("sends super admins to /admin and everyone else to /account", () => {
    expect(dashboardPathFor(Role.SUPER_ADMIN)).toBe("/admin");
    expect(dashboardPathFor(Role.VERIFIED_USER)).toBe("/account");
    expect(dashboardPathFor(Role.USER)).toBe("/account");
    expect(dashboardPathFor(null)).toBe("/account");
  });
});

describe("parsing a role from an untrusted session claim", () => {
  it("accepts the three known roles", () => {
    expect(roleFromUnknown("USER")).toBe(Role.USER);
    expect(roleFromUnknown("VERIFIED_USER")).toBe(Role.VERIFIED_USER);
    expect(roleFromUnknown("SUPER_ADMIN")).toBe(Role.SUPER_ADMIN);
  });

  it("rejects anything else rather than coercing it", () => {
    // A tampered claim must not become a valid role.
    expect(roleFromUnknown("ADMIN")).toBeNull();
    expect(roleFromUnknown("super_admin")).toBeNull();
    expect(roleFromUnknown("")).toBeNull();
    expect(roleFromUnknown(null)).toBeNull();
    expect(roleFromUnknown(undefined)).toBeNull();
    expect(roleFromUnknown(2)).toBeNull();
    expect(roleFromUnknown({ role: "SUPER_ADMIN" })).toBeNull();
    expect(roleFromUnknown(["SUPER_ADMIN"])).toBeNull();
  });

  it("rejects prototype keys that would pass a naive `in` check", () => {
    expect(roleFromUnknown("toString")).toBeNull();
    expect(roleFromUnknown("constructor")).toBeNull();
    expect(roleFromUnknown("__proto__")).toBeNull();
  });
});
