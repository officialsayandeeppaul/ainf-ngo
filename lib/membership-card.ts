import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AuditAction, recordAudit } from "./audit";
import { randomToken } from "./crypto";
import { db, membershipCardDelegate } from "./db";
import { absoluteUrl } from "./env";
import { formatDay } from "./format-date";
import {
  canIssueMembershipCard,
  cardVerifyVerdict,
  isCardToken,
  memberDisplayName,
  nextCardRegNo,
  parseCardRegNo,
  renderBackSvg,
  renderFrontSvg,
  type CardArtworkInput,
} from "./membership-card-art";

export const CARD_PUBLIC_DIR = "ilove-pdf";

export type IssuedMembershipCard = {
  regNo: string;
  token: string;
  verifyUrl: string;
  frontPath: string;
  backPath: string;
  frontUrl: string;
  backUrl: string;
  frontSvg: string;
  backSvg: string;
  tierName: string;
  badge: string;
  expiresAt: Date;
};

function cardRootDir(): string {
  return process.env.AINF_CARD_DIR?.trim() || path.join(process.cwd(), "public", CARD_PUBLIC_DIR);
}

export function cardFilePaths(regNo: string, root = cardRootDir()) {
  const folder = path.join(root, regNo);
  return {
    folder,
    frontPath: path.join(folder, "front.svg"),
    backPath: path.join(folder, "back.svg"),
    frontUrl: `/${CARD_PUBLIC_DIR}/${regNo}/front.svg`,
    backUrl: `/${CARD_PUBLIC_DIR}/${regNo}/back.svg`,
  };
}

export function cardVerifyUrl(token: string): string {
  return absoluteUrl(`/card/verify?c=${encodeURIComponent(token)}`);
}

export function cardArtworkForUser(input: {
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  fatherName?: string | null;
  address?: string | null;
  imageUrl: string | null;
  photoHref?: string | null;
  regNo: string;
  token: string;
  tierName: string;
  issuedAt: Date;
  expiresAt: Date;
}): CardArtworkInput {
  return {
    name: memberDisplayName(input),
    fatherName: input.fatherName?.trim() || "—",
    regNo: input.regNo,
    address: input.address?.trim() || "—",
    designation: input.tierName,
    mobile: input.phone?.trim() || "—",
    photoUrl: input.photoHref ?? null,
    verifyUrl: cardVerifyUrl(input.token),
    issuedLabel: formatDay(input.issuedAt),
    expiresLabel: formatDay(input.expiresAt),
  };
}

export async function loadUserMembership(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const [membershipTier, membershipCard] = await Promise.all([
    user.membershipTierId
      ? db.membershipTier.findUnique({ where: { id: user.membershipTierId } })
      : Promise.resolve(null),
    findMembershipCardByUserId(userId),
  ]);
  return { ...user, membershipTier, membershipCard };
}

async function readPhotoDataUri(abs: string): Promise<string | null> {
  try {
    const buf = await readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function photoHrefFor(input: {
  cardPhotoPath?: string | null;
  regNo?: string | null;
}): Promise<string | null> {
  const candidates: string[] = [];
  if (input.cardPhotoPath) {
    candidates.push(
      path.isAbsolute(input.cardPhotoPath)
        ? input.cardPhotoPath
        : path.join(process.cwd(), "public", input.cardPhotoPath.replace(/^\/+/, ""))
    );
  }
  if (input.regNo && parseCardRegNo(input.regNo)) {
    candidates.push(path.join(cardRootDir(), input.regNo, "photo.jpg"));
  }
  for (const abs of candidates) {
    const href = await readPhotoDataUri(abs);
    if (href) return href;
  }
  return null;
}

type StoredCard = {
  id: string;
  userId: string;
  regNo: string;
  token: string;
  frontPath: string;
  backPath: string;
  tierName: string;
  badge: string;
  issuedAt: Date;
  expiresAt: Date;
};

type LookupRow = {
  expiresAt: Date | string;
  regNo: string | null;
  firstName: string | null;
  lastName: string | null;
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  membershipTierId: string | null;
  membershipExpiresAt: Date | string | null;
  cardPhotoPath: string | null;
  tierName: string | null;
  badge: string | null;
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function cardFromLookupRow(row: LookupRow | null) {
  if (!row) return null;
  const expiresAt = asDate(row.expiresAt);
  if (!expiresAt) return null;
  return {
    expiresAt,
    user: {
      firstName: row.firstName,
      lastName: row.lastName,
      status: row.status,
      membershipTierId: row.membershipTierId,
      membershipExpiresAt: asDate(row.membershipExpiresAt),
      membershipTier: row.tierName ? { name: row.tierName, badge: row.badge ?? row.tierName } : null,
    },
  };
}

export async function findMembershipCardByUserId(userId: string): Promise<StoredCard | null> {
  const cards = membershipCardDelegate() as { findUnique?: (args: unknown) => Promise<StoredCard | null> } | null;
  if (cards?.findUnique) {
    try {
      return await cards.findUnique({ where: { userId } });
    } catch {
      // Fall through to SQL when this process still has a stale Prisma client.
    }
  }
  const rows = await db.$queryRaw<StoredCard[]>`
    SELECT id, "userId", "regNo", token, "frontPath", "backPath", "tierName", badge, "issuedAt", "expiresAt"
    FROM "MembershipCard"
    WHERE "userId" = ${userId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function allocateRegNo(year: number): Promise<string> {
  const prefix = `AINF-${year}-`;
  const cards = membershipCardDelegate() as {
    findFirst?: (args: unknown) => Promise<{ regNo: string } | null>;
  } | null;
  if (cards?.findFirst) {
    try {
      const last = await cards.findFirst({
        where: { regNo: { startsWith: prefix } },
        orderBy: { regNo: "desc" },
        select: { regNo: true },
      });
      return nextCardRegNo(last?.regNo ?? null, year);
    } catch {
      // Use SQL below.
    }
  }
  const like = `${prefix}%`;
  const rows = await db.$queryRaw<Array<{ regNo: string }>>`
    SELECT "regNo" FROM "MembershipCard" WHERE "regNo" LIKE ${like} ORDER BY "regNo" DESC LIMIT 1
  `;
  return nextCardRegNo(rows[0]?.regNo ?? null, year);
}

async function writeCardFiles(regNo: string, frontSvg: string, backSvg: string) {
  const files = cardFilePaths(regNo);
  await mkdir(files.folder, { recursive: true });
  await writeFile(files.frontPath, frontSvg, "utf8");
  await writeFile(files.backPath, backSvg, "utf8");
  return files;
}

export async function issueMembershipCard(userId: string): Promise<IssuedMembershipCard | null> {
  const user = await loadUserMembership(userId);
  if (!user || !user.membershipExpiresAt || !user.membershipTier) return null;
  if (!canIssueMembershipCard(user)) return null;

  const year = user.membershipExpiresAt.getUTCFullYear();
  const issuedAt = user.membershipCard?.issuedAt ?? new Date();
  const token = user.membershipCard?.token ?? randomToken(18);
  const regNo = user.membershipCard?.regNo ?? (await allocateRegNo(year));
  if (!parseCardRegNo(regNo)) throw new Error("Allocated an invalid membership card number.");

  const art = cardArtworkForUser({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    fatherName: user.fatherName,
    address: user.address,
    imageUrl: user.imageUrl,
    photoHref: await photoHrefFor({ cardPhotoPath: user.cardPhotoPath, regNo }),
    regNo,
    token,
    tierName: user.membershipTier.name,
    issuedAt,
    expiresAt: user.membershipExpiresAt,
  });
  const frontSvg = renderFrontSvg(art);
  const backSvg = renderBackSvg({ regNo, verifyUrl: art.verifyUrl });
  const files = await writeCardFiles(regNo, frontSvg, backSvg);

  const row = await upsertMembershipCard({
    userId,
    regNo,
    token,
    frontPath: files.frontPath,
    backPath: files.backPath,
    tierName: user.membershipTier.name,
    badge: user.membershipTier.badge,
    issuedAt,
    expiresAt: user.membershipExpiresAt,
  });

  await recordAudit({
    action: AuditAction.MembershipCardIssued,
    actorUserId: userId,
    targetType: "membership_card",
    targetId: row.id,
    metadata: {
      regNo,
      tierName: user.membershipTier.name,
      expiresAt: user.membershipExpiresAt.toISOString(),
      refreshed: Boolean(user.membershipCard),
    },
  });

  return {
    regNo: row.regNo,
    token: row.token,
    verifyUrl: art.verifyUrl,
    frontPath: files.frontPath,
    backPath: files.backPath,
    frontUrl: files.frontUrl,
    backUrl: files.backUrl,
    frontSvg,
    backSvg,
    tierName: row.tierName,
    badge: row.badge,
    expiresAt: row.expiresAt,
  };
}

export function previewMembershipCard(input: {
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  fatherName?: string | null;
  address?: string | null;
  imageUrl: string | null;
  photoHref?: string | null;
  membershipExpiresAt: Date | null;
  membershipTier: { name: string } | null;
  membershipCard: {
    regNo: string;
    token: string;
    issuedAt: Date;
    expiresAt: Date;
  } | null;
}): Omit<IssuedMembershipCard, "token" | "frontPath" | "backPath" | "frontUrl" | "backUrl" | "tierName" | "badge"> | null {
  if (!input.membershipCard || !input.membershipExpiresAt || !input.membershipTier) return null;
  const art = cardArtworkForUser({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    fatherName: input.fatherName,
    address: input.address,
    imageUrl: input.imageUrl,
    photoHref: input.photoHref,
    regNo: input.membershipCard.regNo,
    token: input.membershipCard.token,
    tierName: input.membershipTier.name,
    issuedAt: input.membershipCard.issuedAt,
    expiresAt: input.membershipExpiresAt,
  });
  return {
    regNo: art.regNo,
    verifyUrl: art.verifyUrl,
    frontSvg: renderFrontSvg(art),
    backSvg: renderBackSvg({ regNo: art.regNo, verifyUrl: art.verifyUrl }),
    expiresAt: input.membershipExpiresAt,
  };
}

export async function ensureMembershipCard(userId: string): Promise<IssuedMembershipCard | null> {
  try {
    return await issueMembershipCard(userId);
  } catch (error) {
    console.error("[membership-card] issue failed", error);
    return null;
  }
}

async function upsertMembershipCard(input: {
  userId: string;
  regNo: string;
  token: string;
  frontPath: string;
  backPath: string;
  tierName: string;
  badge: string;
  issuedAt: Date;
  expiresAt: Date;
}): Promise<StoredCard> {
  const cards = membershipCardDelegate() as {
    upsert?: (args: unknown) => Promise<StoredCard>;
  } | null;
  if (cards?.upsert) {
    try {
      return await cards.upsert({
        where: { userId: input.userId },
        create: input,
        update: {
          frontPath: input.frontPath,
          backPath: input.backPath,
          tierName: input.tierName,
          badge: input.badge,
          expiresAt: input.expiresAt,
        },
      });
    } catch {
      // Fall through to SQL when this process still has a stale Prisma client.
    }
  }
  const rows = await db.$queryRaw<StoredCard[]>`
    INSERT INTO "MembershipCard"
      (id, "userId", "regNo", token, "frontPath", "backPath", "tierName", badge, "issuedAt", "expiresAt", "updatedAt")
    VALUES
      (${`card_${input.userId.slice(-16)}`}, ${input.userId}, ${input.regNo}, ${input.token}, ${input.frontPath}, ${input.backPath}, ${input.tierName}, ${input.badge}, ${input.issuedAt}, ${input.expiresAt}, NOW())
    ON CONFLICT ("userId") DO UPDATE SET
      "frontPath" = EXCLUDED."frontPath",
      "backPath" = EXCLUDED."backPath",
      "tierName" = EXCLUDED."tierName",
      badge = EXCLUDED.badge,
      "expiresAt" = EXCLUDED."expiresAt",
      "updatedAt" = NOW()
    RETURNING id, "userId", "regNo", token, "frontPath", "backPath", "tierName", badge, "issuedAt", "expiresAt"
  `;
  if (!rows[0]) throw new Error("Could not persist the membership card.");
  return rows[0];
}

export async function lookupMembershipCard(token: string | null | undefined) {
  const empty = {
    ...cardVerifyVerdict({ token, card: null }),
    card: null,
    regNo: null as string | null,
    photoUrl: null as string | null,
    frontSvg: null as string | null,
    frontUrl: null as string | null,
    dbError: false,
  };
  if (!isCardToken(token)) return empty;
  try {
    const rows = await db.$queryRaw<LookupRow[]>`
      SELECT
        c."expiresAt",
        c."regNo",
        u."firstName",
        u."lastName",
        u.status,
        u."membershipTierId",
        u."membershipExpiresAt",
        u."cardPhotoPath",
        t.name AS "tierName",
        t.badge
      FROM "MembershipCard" c
      JOIN "User" u ON u.id = c."userId"
      LEFT JOIN "MembershipTier" t ON t.id = u."membershipTierId"
      WHERE c.token = ${token.trim()}
      LIMIT 1
    `;
    const row = rows[0] ?? null;
    const card = cardFromLookupRow(row);
    const verdict = cardVerifyVerdict({ token, card, now: new Date() });
    const regNo = row?.regNo?.trim() || null;
    let photoUrl: string | null = null;
    let frontSvg: string | null = null;
    let frontUrl: string | null = null;
    if (row?.cardPhotoPath) {
      photoUrl = row.cardPhotoPath.startsWith("/") ? row.cardPhotoPath : `/${row.cardPhotoPath}`;
    } else if (regNo) {
      const onDisk = path.join(cardRootDir(), regNo, "photo.jpg");
      try {
        await readFile(onDisk);
        photoUrl = `/${CARD_PUBLIC_DIR}/${regNo}/photo.jpg`;
      } catch {
        photoUrl = null;
      }
    }
    if (regNo && parseCardRegNo(regNo)) {
      const files = cardFilePaths(regNo);
      frontUrl = files.frontUrl;
      try {
        frontSvg = await readFile(files.frontPath, "utf8");
      } catch {
        frontSvg = null;
      }
    }
    return { ...verdict, card, regNo, photoUrl, frontSvg, frontUrl, dbError: false };
  } catch (error) {
    console.error("[membership-card] lookup failed", error);
    return { ...empty, dbError: true };
  }
}
