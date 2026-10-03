import { Role, type User } from "@prisma/client";

/** Ascending privilege. SUPER_ADMIN implicitly satisfies every lower role. */
export const ROLE_RANK: Record<Role, number> = {
  USER: 0,
  VERIFIED_USER: 1,
  SUPER_ADMIN: 2,
};

export const ROLE_LABEL: Record<Role, string> = {
  USER: "Member",
  VERIFIED_USER: "Verified member",
  SUPER_ADMIN: "Super admin",
};

export function hasRole(actual: Role | null | undefined, required: Role): boolean {
  if (!actual) return false;
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export function isSuperAdmin(role: Role | null | undefined): boolean {
  return role === Role.SUPER_ADMIN;
}

export function isVerified(user: Pick<User, "role"> | null | undefined): boolean {
  return hasRole(user?.role, Role.VERIFIED_USER);
}

/** Home route for a role, used after sign-in and by the portal nav. */
export function dashboardPathFor(role: Role | null | undefined): string {
  return role === Role.SUPER_ADMIN ? "/admin" : "/account";
}

/** Shape mirrored into Clerk publicMetadata so middleware can read it. */
export type ClerkPublicMetadata = {
  role?: Role;
  kycStatus?: string;
  panVerified?: boolean;
};

export function roleFromUnknown(value: unknown): Role | null {
  // Object.hasOwn rather than `in`: inherited keys such as "toString" and
  // "constructor" would otherwise pass and be cast to a Role.
  return typeof value === "string" && Object.hasOwn(ROLE_RANK, value)
    ? (value as Role)
    : null;
}
