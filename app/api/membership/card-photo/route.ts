import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { guardApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { CARD_PUBLIC_DIR, cardFilePaths, ensureMembershipCard, loadUserMembership } from "@/lib/membership-card";
import { CARD_PHOTO_MAX_BYTES, inspectCardPhoto, PASSPORT_PHOTO_ASPECT } from "@/lib/membership-card-art";
import { membershipIsLive } from "@/lib/membership-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Match Word ID photo slot (150×186 @ 300 dpi). */
const OUT_W = 300;
const OUT_H = Math.round(OUT_W / PASSPORT_PHOTO_ASPECT);

async function toPassportJpeg(buf: Buffer): Promise<Buffer> {
  const img = sharp(buf, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const width = meta.width || OUT_W;
  const height = meta.height || OUT_H;
  const srcAspect = width / height;
  let left = 0;
  let top = 0;
  let cropW = width;
  let cropH = height;
  if (srcAspect > PASSPORT_PHOTO_ASPECT) {
    cropW = Math.round(height * PASSPORT_PHOTO_ASPECT);
    left = Math.round((width - cropW) / 2);
  } else {
    cropH = Math.round(width / PASSPORT_PHOTO_ASPECT);
    top = Math.max(0, Math.round((height - cropH) * 0.18));
    if (top + cropH > height) top = height - cropH;
  }
  return img
    .extract({ left, top, width: cropW, height: cropH })
    .resize(OUT_W, OUT_H, { fit: "fill" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

export async function POST(request: Request) {
  const guard = await guardApi({ limiter: "checkout" });
  if (!guard.ok) return guard.response;

  const member = await loadUserMembership(guard.ctx.user.id);
  if (!member || !membershipIsLive(member) || !member.membershipCard) {
    return Response.json(
      { error: "not_live", message: "A live membership is required before a card photo can be saved." },
      { status: 400 }
    );
  }

  const form = await request.formData();
  const fatherName = String(form.get("fatherName") ?? "").trim().slice(0, 80);
  const address = String(form.get("address") ?? "").trim().slice(0, 160);
  const mobile = String(form.get("mobile") ?? "").trim().slice(0, 24);
  const file = form.get("photo");

  const data: {
    fatherName: string | null;
    address: string | null;
    phone?: string | null;
    cardPhotoPath?: string;
  } = {
    fatherName: fatherName || null,
    address: address || null,
  };
  if (mobile) data.phone = mobile;

  if (file instanceof File && file.size > 0) {
    const check = inspectCardPhoto({ type: file.type, size: file.size });
    if (!check.ok) {
      return Response.json({ error: "invalid_photo", message: check.reason }, { status: 400 });
    }
    if (file.size > CARD_PHOTO_MAX_BYTES) {
      return Response.json({ error: "invalid_photo", message: "Photo must be under 2 MB." }, { status: 400 });
    }
    const files = cardFilePaths(member.membershipCard.regNo);
    const filename = "photo.jpg";
    await mkdir(files.folder, { recursive: true });
    const raw = Buffer.from(await file.arrayBuffer());
    let passport: Buffer;
    try {
      passport = await toPassportJpeg(raw);
    } catch {
      return Response.json(
        { error: "invalid_photo", message: "Could not read that image. Use a clear JPG or PNG face photo." },
        { status: 400 }
      );
    }
    await writeFile(path.join(files.folder, filename), passport);
    data.cardPhotoPath = `/${CARD_PUBLIC_DIR}/${member.membershipCard.regNo}/${filename}`;
  }

  await db.user.update({ where: { id: member.id }, data });
  const card = await ensureMembershipCard(member.id);
  return Response.json({
    ok: true,
    regNo: card?.regNo ?? member.membershipCard.regNo,
  });
}
