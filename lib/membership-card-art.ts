import QRCode from "qrcode";
import { membershipIsLive } from "./membership-state";

export const CARD_ORG = {
  name: "ALL INDIAN NEVARLANDS FOUNDATION",
  motto: "PATRIOTISM ★ UNITEDLIFE ★ JUSTICE FOR ALL",
  office: "01/A, DHAWATAR, NALA, DIST- JAMTARA, JHARKHAND - 815355",
  mca: "U85500JH2026NPL028188",
  section8: "186659",
  niti: "JH/2026/1133191",
  phone: "+91 9386495099",
  email: "theainfinfo@ainf.com",
  website: "www.theainf.in",
  director: "Mantu",
} as const;

export const CARD_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const CARD_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function inspectCardPhoto(input: { type: string; size: number }): { ok: true } | { ok: false; reason: string } {
  if (!CARD_PHOTO_TYPES.includes(input.type as (typeof CARD_PHOTO_TYPES)[number])) {
    return { ok: false, reason: "Use a JPG, PNG, or WebP photo." };
  }
  if (input.size < 32 || input.size > CARD_PHOTO_MAX_BYTES) {
    return { ok: false, reason: "Photo must be under 2 MB." };
  }
  return { ok: true };
}

export const CARD_REG_NO = /^AINF-\d{4}-\d{4}$/;
export const CARD_TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/** Exact copy from AINF_ID_Cards_WITH_PROFILE.docx / final id card.docx back. */
export const CARD_RULES: { title: string; body: string }[] = [
  {
    title: "Inquiries & Rights",
    body: "If you have any doubt, question, or problem, please contact the AINF Head Office. All rights are reserved to All India Nevarlands Foundation.",
  },
  {
    title: "Application Forms",
    body: "Applicants can use a photocopy of the application form, which will be duly acknowledged by the Head Office once received duly filled in.",
  },
  {
    title: "Disciplinary Action",
    body: "Strict action will be taken against the Member if found guilty of flouting (violating) the rules and regulations of AINF, and such acts are also punishable under the Law of the Govt. of India.",
  },
  {
    title: "Monthly Communication",
    body: "All AINF members should contact their respective Area Unit / Head Office once a month.",
  },
  {
    title: "Lost ID Cards",
    body: "In case of loss of the Identity Card, inform the Head Office in writing along with an F.I.R. immediately.",
  },
  {
    title: "Liability",
    body: "All India Nevarlands Foundation will not be responsible for any misuse of the Identity Card issued to the Members during the course of their Membership with AINF.",
  },
  {
    title: "Card Expiry & Renewal",
    body: "On expiry, the Identity Card must be submitted to the Head Office. After expiry, renewal is a must for regular membership.",
  },
  {
    title: "Misconduct & Jurisdiction",
    body: "Any kind of misbehavior or misconduct may result in the rejection of membership of AINF. All disputes are subject to the Jurisdiction of INDIA only.",
  },
];

export type CardArtworkInput = {
  name: string;
  fatherName: string;
  regNo: string;
  address: string;
  designation: string;
  mobile: string;
  photoUrl: string | null;
  verifyUrl: string;
  issuedLabel: string;
  expiresLabel: string;
};

export type CardVerifyKind = "unknown" | "live" | "expired" | "ended" | "suspended";

export type CardVerifyInput = {
  token: string | null | undefined;
  card: {
    expiresAt: Date;
    user: {
      firstName: string | null;
      lastName: string | null;
      status: "ACTIVE" | "SUSPENDED" | "BANNED";
      membershipTierId: string | null;
      membershipExpiresAt: Date | null;
      membershipTier?: { name: string; badge: string } | null;
    };
  } | null;
  now?: Date;
};

export function isCardToken(value: string | null | undefined): value is string {
  return Boolean(value && CARD_TOKEN.test(value.trim()));
}

export function formatCardRegNo(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Card year is out of range.");
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999) {
    throw new Error("Card sequence is out of range.");
  }
  return `AINF-${year}-${String(sequence).padStart(4, "0")}`;
}

export function parseCardRegNo(regNo: string): { year: number; sequence: number } | null {
  const match = CARD_REG_NO.exec(regNo);
  if (!match) return null;
  return { year: Number(regNo.slice(5, 9)), sequence: Number(regNo.slice(10)) };
}

export function nextCardRegNo(last: string | null, year: number): string {
  if (!last) return formatCardRegNo(year, 1);
  const parsed = parseCardRegNo(last);
  if (!parsed || parsed.year !== year) return formatCardRegNo(year, 1);
  return formatCardRegNo(year, parsed.sequence + 1);
}

export function memberDisplayName(input: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  if (name) return name.toUpperCase();
  const local = input.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return (local || "AINF MEMBER").toUpperCase();
}

export function canIssueMembershipCard(input: {
  status: string;
  membershipTierId: string | null;
  membershipExpiresAt: Date | null;
}): boolean {
  return input.status === "ACTIVE" && membershipIsLive(input);
}

export function cardVerifyVerdict(input: CardVerifyInput): {
  kind: CardVerifyKind;
  live: boolean;
  name: string | null;
  designation: string | null;
  badge: string | null;
  validUntil: Date | null;
} {
  const token = input.token?.trim() ?? "";
  if (!isCardToken(token) || !input.card) {
    return { kind: "unknown", live: false, name: null, designation: null, badge: null, validUntil: null };
  }
  const now = input.now ?? new Date();
  const user = input.card.user;
  const name = memberDisplayName(user);
  const designation = user.membershipTier?.name ?? null;
  const badge = user.membershipTier?.badge ?? null;
  if (user.status !== "ACTIVE") {
    return { kind: "suspended", live: false, name, designation, badge, validUntil: null };
  }
  if (membershipIsLive(user, now)) {
    return {
      kind: "live",
      live: true,
      name,
      designation,
      badge,
      validUntil: user.membershipExpiresAt,
    };
  }
  if (input.card.expiresAt.getTime() <= now.getTime() || user.membershipExpiresAt) {
    return {
      kind: "expired",
      live: false,
      name,
      designation,
      badge,
      validUntil: user.membershipExpiresAt ?? input.card.expiresAt,
    };
  }
  return { kind: "ended", live: false, name, designation, badge, validUntil: null };
}

export function cardVerifyCopy(kind: CardVerifyKind): { title: string; body: string } {
  if (kind === "live") {
    return {
      title: "Active AINF member",
      body: "This person holds a live All Indian Nevarlands Foundation membership.",
    };
  }
  if (kind === "expired") {
    return {
      title: "Not an active AINF member",
      body: "This card was issued, but the membership term has ended. Renewal is required.",
    };
  }
  if (kind === "suspended") {
    return {
      title: "Not an active AINF member",
      body: "This account is not in good standing. The card cannot be used.",
    };
  }
  if (kind === "ended") {
    return {
      title: "Not an active AINF member",
      body: "Membership on this card is no longer live.",
    };
  }
  return {
    title: "Card not recognised",
    body: "This code is not a valid AINF membership card.",
  };
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function qrModules(text: string): { size: number; darkAt: (x: number, y: number) => boolean } {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  return {
    size: qr.modules.size,
    darkAt: (x, y) => Boolean(qr.modules.get(x, y)),
  };
}

export function qrSvgGroup(text: string, x: number, y: number, width: number): string {
  const { size, darkAt } = qrModules(text);
  const cell = width / size;
  const parts: string[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!darkAt(col, row)) continue;
      const left = (x + col * cell).toFixed(2);
      const top = (y + row * cell).toFixed(2);
      const step = cell.toFixed(2);
      parts.push(`M${left} ${top}h${step}v${step}h-${step}z`);
    }
  }
  return `<g aria-label="Membership QR"><path fill="#000000" d="${parts.join("")}"/></g>`;
}

/** White quiet zone so a phone can read the unique verify link. */
function frontQrBlock(url: string): string {
  const x = 48;
  const y = 490;
  const size = 124;
  const pad = 8;
  return [
    `<rect x="${x - pad}" y="${y - pad}" width="${size + pad * 2}" height="${size + pad * 2}" rx="6" fill="#ffffff" stroke="#dbe3ee" stroke-width="1"/>`,
    qrSvgGroup(url, x, y, size),
  ].join("");
}

function blank(value: string | null | undefined, fallback = "—"): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}



const TAHOM = "'AINF Card Tahoma', Tahoma, Geneva, sans-serif";
const TAHOM_HREF = "/assets/fonts/tahoma.ttf";
/** Absolute public paths — inline SVG resolves against the page URL, not the file. */
const SEAL_HREF = "/assets/img/ainf-card-seal-word.png";
const HEADER_HREF = "/assets/img/ainf-card-header.jpeg";
/** Word body wash (image2): starts under the header, waves at the lower right. */
const BODY_HREF = "/assets/img/ainf-card-footer-bar.jpeg";
const SIGN_HREF = "/assets/img/idcard/image.png";
const BACK_BG_HREF = "/assets/img/ainf-card-back-bg.jpeg";

/**
 * Word ID card geometry (final id card.docx @ 300 dpi).
 * Card 3.357×2.157 in → 1007×647 px.
 */
export const CARD_W = 1007;
export const CARD_H = 647;

/** Passport slot ratio from the Word ID template (EMU 485422×598311 ≈ 0.811). */
export const PASSPORT_PHOTO_ASPECT = 485422 / 598311;

/** Exact Word photo box: EMU (2479423, 860792, 457200, 568325) @ 300 dpi. */
export const PASSPORT_PHOTO = { x: 813, y: 282, w: 150, h: 186 } as const;
const PHOTO_RADIUS = 12;
const PHOTO_BG = "#ffffff";
/** Word run color w:val 2E3092 — labels and values. */
const LABEL_BLUE = "#2E3092";
const VALUE_BLUE = "#2E3092";
/**
 * Six baselines beside the photo.
 * Word value lines are exact 250 twips (12.5pt → 52px at 300 dpi).
 * Type is 11pt Tahoma (sz 22 → 46px). Rows stay above the signature.
 */
const FIELD_SIZE = 28;
const FIELD_YS = [308, 338, 368, 398, 428, 458] as const;

function svgFontDefs(): string {
  return `<defs>
  <style type="text/css"><![CDATA[
    @font-face {
      font-family: 'AINF Card Tahoma';
      src: url('${TAHOM_HREF}') format('truetype');
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }
  ]]></style>
</defs>`;
}

function wordSeal(x: number, y: number, w: number, h: number): string {
  return `<image href="${SEAL_HREF}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
}

function wrapWords(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Values stop before the passport frame so a long address cannot run into the photo. */
const VALUE_MAX = 22;

/** Word front: Tahoma label, colon column, uppercase value. Same blue as the docx runs. */
function fieldLine(label: string, value: string, y: number): string {
  const raw = blank(value);
  const display = raw === "—" ? "—" : raw.toUpperCase();
  const short = display.length > VALUE_MAX ? `${display.slice(0, VALUE_MAX - 1)}…` : display;
  const size = FIELD_SIZE;
  return [
    `<text x="46" y="${y}" font-size="${size}" font-weight="700" letter-spacing="-0.4" fill="${LABEL_BLUE}" font-family="${TAHOM}">${escapeXml(label)}</text>`,
    `<text x="292" y="${y}" font-size="${size}" font-weight="700" fill="${LABEL_BLUE}" font-family="${TAHOM}">:</text>`,
    `<text x="316" y="${y}" font-size="${size}" font-weight="700" letter-spacing="-0.6" fill="${VALUE_BLUE}" font-family="${TAHOM}" clip-path="url(#ainfFieldValues)">${escapeXml(short)}</text>`,
  ].join("");
}

function passportPhotoSlot(photoUrl: string | null): string {
  const { x, y, w, h } = PASSPORT_PHOTO;
  const clipId = "ainfPassportClip";
  const rx = PHOTO_RADIUS;
  const frame = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${PHOTO_BG}" stroke="#ed1c24" stroke-width="2.2"/>`;
  if (photoUrl) {
    return [
      `<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/></clipPath></defs>`,
      frame,
      `<image href="${escapeXml(photoUrl)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`,
    ].join("");
  }
  return frame;
}

/**
 * Same size as the Word seal and signature, dropped just below the photo
 * so the ink and the seal do not touch the passport frame.
 */
function directorBlock(): string {
  const top = PASSPORT_PHOTO.y + PASSPORT_PHOTO.h + 14;
  const signW = 210;
  const signH = 68;
  const seal = 112;
  const sealX = 836;
  const signX = sealX - 16 - signW;
  return [
    `<image href="${SIGN_HREF}" x="${signX}" y="${top}" width="${signW}" height="${signH}" preserveAspectRatio="xMidYMid meet"/>`,
    `<line x1="${signX}" y1="${top + signH + 6}" x2="${signX + signW}" y2="${top + signH + 6}" stroke="#2E3092" stroke-width="1.4"/>`,
    wordSeal(sealX, top, seal, seal),
    `<text x="${signX + signW / 2}" y="${top + signH + 26}" text-anchor="middle" font-size="16" font-weight="700" fill="${LABEL_BLUE}" font-family="${TAHOM}">Director Sign</text>`,
  ].join("\n  ");
}

/** Word back text box is center-aligned. Titles are bold; bodies are regular. */
function renderRulesBlock(): string {
  const parts: string[] = [];
  let y = 72;
  for (const rule of CARD_RULES) {
    const head = `${rule.title}: `;
    const lines = wrapWords(`${head}${rule.body}`, 102);
    lines.forEach((line, lineIndex) => {
      if (lineIndex === 0) {
        const titlePart = line.slice(0, Math.min(head.length, line.length));
        const rest = line.slice(titlePart.length);
        parts.push(
          `<text x="503" y="${y}" text-anchor="middle" font-size="16.5" fill="#1a1a1a" font-family="${TAHOM}">` +
            `<tspan font-weight="700">${escapeXml(titlePart)}</tspan>` +
            `<tspan font-weight="400">${escapeXml(rest)}</tspan>` +
            `</text>`
        );
      } else {
        parts.push(
          `<text x="503" y="${y}" text-anchor="middle" font-size="16.5" font-weight="400" fill="#1a1a1a" font-family="${TAHOM}">${escapeXml(line)}</text>`
        );
      }
      y += 21;
    });
    y += 6;
  }
  return parts.join("\n  ");
}

export function renderFrontSvg(input: CardArtworkInput): string {
  const name = escapeXml(blank(input.name).toUpperCase());
  const [yName, yFather, yReg, yAddr, yDesig, yMob] = FIELD_YS;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" role="img" aria-label="AINF membership card front">
  <desc>${escapeXml(input.verifyUrl)}</desc>
  ${svgFontDefs()}
  <rect width="${CARD_W}" height="${CARD_H}" fill="#ffffff"/>
  <image href="${BODY_HREF}" x="1" y="225" width="1005" height="421" preserveAspectRatio="xMidYMid slice"/>
  <image href="${HEADER_HREF}" x="1" y="1" width="1005" height="256" preserveAspectRatio="xMidYMid slice"/>
  <rect x="1.5" y="1.5" width="${CARD_W - 3}" height="${CARD_H - 3}" fill="none" stroke="#231F20" stroke-width="2"/>
  <defs><clipPath id="ainfFieldValues"><rect x="310" y="280" width="490" height="200"/></clipPath></defs>
  ${fieldLine("Name", blank(input.name), yName)}
  ${fieldLine("Father's Name", blank(input.fatherName), yFather)}
  ${fieldLine("Regd. No.", blank(input.regNo), yReg)}
  ${fieldLine("Address", blank(input.address), yAddr)}
  ${fieldLine("Designation", blank(input.designation), yDesig)}
  ${fieldLine("Mob.", blank(input.mobile), yMob)}
  ${passportPhotoSlot(input.photoUrl)}
  ${directorBlock()}
  ${frontQrBlock(input.verifyUrl)}
  <text opacity="0" font-size="1">${name}</text>
</svg>`;
}

export function renderBackSvg(input: { regNo: string; verifyUrl: string }): string {
  const rules = renderRulesBlock();

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" role="img" aria-label="AINF membership card back">
  <desc>${escapeXml(input.verifyUrl)} ${escapeXml(input.regNo)}</desc>
  ${svgFontDefs()}
  <rect width="${CARD_W}" height="${CARD_H}" fill="#ffffff"/>
  <image href="${BACK_BG_HREF}" x="1" y="1" width="1005" height="645" preserveAspectRatio="xMidYMid slice"/>
  <rect x="1.5" y="1.5" width="${CARD_W - 3}" height="${CARD_H - 3}" fill="none" stroke="#231F20" stroke-width="2"/>
  <text x="503" y="42" text-anchor="middle" font-size="26" font-weight="700" fill="#EE0000" font-family="${TAHOM}" text-decoration="underline">Rules and Regulations</text>
  ${rules}
  ${wordSeal(42, 508, 118, 118)}
  <text x="560" y="528" text-anchor="middle" font-size="22" font-weight="700" fill="#EE0000" font-family="${TAHOM}" text-decoration="underline">REGD. OFFICE</text>
  <text x="560" y="556" text-anchor="middle" font-size="16" font-weight="700" fill="#111111" font-family="${TAHOM}">${escapeXml(CARD_ORG.office)}</text>
  <text x="560" y="582" text-anchor="middle" font-size="16" font-weight="700" fill="#111111" font-family="${TAHOM}">Contact – ${escapeXml(CARD_ORG.phone.replace("+91 ", ""))}</text>
  <text x="560" y="608" text-anchor="middle" font-size="16" font-weight="700" fill="#111111" font-family="${TAHOM}">Email – ${escapeXml(CARD_ORG.email)}</text>
  <text x="560" y="634" text-anchor="middle" font-size="16" font-weight="700" fill="#111111" font-family="${TAHOM}">Website – ${escapeXml(CARD_ORG.website)}</text>
</svg>`;
}
