/**
 * Client-safe mirror of the Prisma enums used in "use client" components.
 *
 * Importing `Role` or `UserStatus` from "@prisma/client" directly — even just
 * for the enum value, never the database client itself — makes webpack treat
 * the whole package as part of the client bundle and try to resolve
 * ".prisma/client/index-browser", which isn't generated with this project's
 * driver-adapter Prisma setup (@prisma/adapter-pg). That fails the build:
 *   Module not found: Can't resolve '.prisma/client/index-browser'
 *
 * These are plain string unions, identical in shape and value to the
 * generated enums (see prisma/schema.prisma), with zero dependency on
 * @prisma/client. Server code should keep importing the real enums from
 * "@prisma/client" as usual — this file exists only for client components.
 */

export const Role = {
  USER: "USER",
  VERIFIED_USER: "VERIFIED_USER",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const UserStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  BANNED: "BANNED",
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
