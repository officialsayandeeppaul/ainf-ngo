import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cardArtworkForUser, cardFilePaths, cardFromLookupRow } from "@/lib/membership-card";
import {
  CARD_ORG,
  canIssueMembershipCard,
  inspectCardPhoto,
  cardVerifyCopy,
  cardVerifyVerdict,
  escapeXml,
  formatCardRegNo,
  isCardToken,
  memberDisplayName,
  nextCardRegNo,
  parseCardRegNo,
  qrModules,
  renderBackSvg,
  renderFrontSvg,
} from "@/lib/membership-card-art";

const now = new Date("2026-09-03T10:00:00.000Z");

function sampleArt() {
  return cardArtworkForUser({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phone: "+91 9000000001",
    imageUrl: null,
    regNo: "AINF-2026-0007",
    token: "abcdefghijklmnopqrstuvwx",
    tierName: "Gold Friend",
    issuedAt: now,
    expiresAt: new Date("2026-10-03T10:00:00.000Z"),
  });
}

describe("card numbers and tokens", () => {
  it("formats and parses AINF-YYYY-NNNN", () => {
    expect(formatCardRegNo(2026, 7)).toBe("AINF-2026-0007");
    expect(parseCardRegNo("AINF-2026-0007")).toEqual({ year: 2026, sequence: 7 });
    expect(parseCardRegNo("AINF-26-7")).toBeNull();
    expect(nextCardRegNo(null, 2026)).toBe("AINF-2026-0001");
    expect(nextCardRegNo("AINF-2026-0009", 2026)).toBe("AINF-2026-0010");
    expect(nextCardRegNo("AINF-2025-0099", 2026)).toBe("AINF-2026-0001");
  });

  it("rejects a guessable or short scan token", () => {
    expect(isCardToken("abcdefghijklmnopqrstuvwx")).toBe(true);
    expect(isCardToken("short")).toBe(false);
    expect(isCardToken("AINF-2026-0001")).toBe(false);
    expect(isCardToken("../../etc/passwd")).toBe(false);
  });
});

describe("who may receive a card", () => {
  it("issues only for an active account with a live badge", () => {
    // canIssueMembershipCard reads the real clock, so "still valid" must use a
    // date far enough ahead that the test never flips on its own run day.
    const farFuture = new Date("2099-01-01T10:00:00.000Z");
    expect(
      canIssueMembershipCard({
        status: "ACTIVE",
        membershipTierId: "tier_1",
        membershipExpiresAt: farFuture,
      })
    ).toBe(true);
    expect(
      canIssueMembershipCard({
        status: "SUSPENDED",
        membershipTierId: "tier_1",
        membershipExpiresAt: farFuture,
      })
    ).toBe(false);
    expect(
      canIssueMembershipCard({
        status: "ACTIVE",
        membershipTierId: null,
        membershipExpiresAt: farFuture,
      })
    ).toBe(false);
    expect(
      canIssueMembershipCard({
        status: "ACTIVE",
        membershipTierId: "tier_1",
        membershipExpiresAt: new Date("2026-09-01T10:00:00.000Z"),
      })
    ).toBe(false);
  });
});

describe("scan verdict", () => {
  const token = "abcdefghijklmnopqrstuvwx";
  const user = {
    firstName: "Ada",
    lastName: "Lovelace",
    status: "ACTIVE" as const,
    membershipTierId: "tier_1",
    membershipExpiresAt: new Date("2026-10-03T10:00:00.000Z"),
    membershipTier: { name: "Gold Friend", badge: "Gold" },
  };

  it("is live only while the membership term is still open", () => {
    const live = cardVerifyVerdict({
      token,
      card: { expiresAt: user.membershipExpiresAt, user },
      now,
    });
    expect(live.kind).toBe("live");
    expect(live.live).toBe(true);
    expect(live.name).toBe("ADA LOVELACE");
    expect(cardVerifyCopy(live.kind).title).toMatch(/active ainf member/i);
  });

  it("fails after expiry even if the printed card still exists", () => {
    const expired = cardVerifyVerdict({
      token,
      card: {
        expiresAt: new Date("2026-09-01T10:00:00.000Z"),
        user: { ...user, membershipExpiresAt: new Date("2026-09-01T10:00:00.000Z") },
      },
      now,
    });
    expect(expired).toMatchObject({ kind: "expired", live: false });
    expect(cardVerifyCopy(expired.kind).title).toMatch(/not an active/i);
  });

  it("fails for a suspended account and an unknown token", () => {
    expect(
      cardVerifyVerdict({
        token,
        card: { expiresAt: user.membershipExpiresAt, user: { ...user, status: "SUSPENDED" } },
        now,
      }).kind
    ).toBe("suspended");
    expect(cardVerifyVerdict({ token: "nope", card: null, now }).kind).toBe("unknown");
    expect(cardVerifyVerdict({ token: null, card: { expiresAt: now, user }, now }).kind).toBe("unknown");
  });

  it("maps a SQL lookup row onto the same verdict shape", () => {
    const card = cardFromLookupRow({
      expiresAt: user.membershipExpiresAt,
      regNo: "AINF-2026-0007",
      firstName: "Ada",
      lastName: "Lovelace",
      status: "ACTIVE",
      membershipTierId: "tier_1",
      membershipExpiresAt: user.membershipExpiresAt,
      cardPhotoPath: null,
      tierName: "Gold Friend",
      badge: "Gold",
    });
    expect(cardVerifyVerdict({ token, card, now })).toMatchObject({ kind: "live", live: true });
    expect(cardFromLookupRow(null)).toBeNull();
    const fromSqlStrings = cardFromLookupRow({
      expiresAt: "2026-10-03T10:00:00.000Z",
      regNo: "AINF-2026-0007",
      firstName: "Ada",
      lastName: "Lovelace",
      status: "ACTIVE",
      membershipTierId: "tier_1",
      membershipExpiresAt: "2026-10-03T10:00:00.000Z",
      cardPhotoPath: null,
      tierName: "Gold Friend",
      badge: "Gold",
    });
    expect(fromSqlStrings?.expiresAt).toBeInstanceOf(Date);
    expect(cardVerifyVerdict({ token, card: fromSqlStrings, now })).toMatchObject({ kind: "live", live: true });
  });
});

describe("card artwork", () => {
  it("prints the AINF face with member fields and a scannable verify URL", () => {
    const art = sampleArt();
    const front = renderFrontSvg(art);
    // Branding lives in the Word header asset; body fields are SVG text.
    expect(front).toContain("ainf-card-header.jpeg");
    expect(front).toContain("ainf-card-seal-word.png");
    expect(front).toContain("ADA LOVELACE");
    expect(front).toContain("AINF-2026-0007");
    expect(front).toContain("GOLD FRIEND");
    expect(front).toContain("+91 9000000001");
    expect(front).toContain("AINF Card Tahoma");
    expect(front).toContain("/assets/fonts/tahoma.ttf");
    expect(front).toContain('width="1007"');
    expect(front).toContain('height="647"');
    expect(front).toContain("card/verify?c=abcdefghijklmnopqrstuvwx");
    expect(front).toContain("Director Sign");
    expect(front).toContain("/assets/img/idcard/image.png");
    expect(front).toContain('aria-label="Membership QR"');
    expect(front).toContain('x="813"');
    expect(front).not.toContain("img.clerk");
    expect(qrModules(art.verifyUrl).size).toBeGreaterThan(20);
  });

  it("embeds a passport photo inside the Word photo slot", () => {
    const front = renderFrontSvg({
      ...sampleArt(),
      photoUrl: "/ilove-pdf/AINF-2026-0007/photo.jpg",
    });
    expect(front).toContain("ainfPassportClip");
    expect(front).toContain("/ilove-pdf/AINF-2026-0007/photo.jpg");
  });

  it("prints the rules back and office details", () => {
    const back = renderBackSvg({
      regNo: "AINF-2026-0007",
      verifyUrl: "http://localhost:3000/card/verify?c=abcdefghijklmnopqrstuvwx",
    });
    expect(back).toContain("Rules and Regulations");
    expect(back).toContain("Inquiries &amp; Rights");
    expect(back).toContain("Lost ID Cards");
    expect(back).toContain("Misconduct &amp; Jurisdiction");
    expect(back).toContain("REGD. OFFICE");
    expect(back).toContain(CARD_ORG.office);
    expect(back).toContain(CARD_ORG.email);
    expect(back).toContain(CARD_ORG.website);
    expect(back).toContain("AINF Card Tahoma");
    expect(back).toContain("/assets/fonts/tahoma.ttf");
    expect(back).toContain("ainf-card-back-bg.jpeg");
  });

  it("escapes untrusted names so the SVG cannot carry markup", () => {
    expect(escapeXml(`Ada <script> & "K"`)).toBe("Ada &lt;script&gt; &amp; &quot;K&quot;");
    const front = renderFrontSvg({
      ...sampleArt(),
      name: `Ada <img src=x>`,
    });
    expect(front).toContain("ADA &lt;IMG SRC=X&gt;");
    expect(front).not.toContain("<img src=x>");
  });

  it("accepts a small JPG and rejects other files", () => {
    expect(inspectCardPhoto({ type: "image/jpeg", size: 12_000 })).toEqual({ ok: true });
    expect(inspectCardPhoto({ type: "application/pdf", size: 12_000 }).ok).toBe(false);
    expect(inspectCardPhoto({ type: "image/png", size: 3 * 1024 * 1024 }).ok).toBe(false);
  });

  it("falls back to an email local-part when no name is on file", () => {
    expect(memberDisplayName({ email: "first.last@ainf.in" })).toBe("FIRST LAST");
  });
});

describe("ilove-pdf file layout", () => {
  const previous = process.env.AINF_CARD_DIR;
  afterEach(() => {
    if (previous === undefined) delete process.env.AINF_CARD_DIR;
    else process.env.AINF_CARD_DIR = previous;
  });

  it("writes front and back under the card number folder", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ainf-cards-"));
    process.env.AINF_CARD_DIR = root;
    const files = cardFilePaths("AINF-2026-0007");
    expect(files.frontUrl).toBe("/ilove-pdf/AINF-2026-0007/front.svg");
    expect(files.folder).toBe(path.join(root, "AINF-2026-0007"));
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(files.folder, { recursive: true });
    await writeFile(files.frontPath, renderFrontSvg(sampleArt()), "utf8");
    const saved = await readFile(files.frontPath, "utf8");
    expect(saved).toContain("AINF-2026-0007");
  });
});
