import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Role } from "@prisma/client";
import sharp from "sharp";
import { guardApi } from "@/lib/auth/guard";
import { mediaStore, mediaUrl, putMedia } from "@/lib/object-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg"]);

export async function POST(request: Request) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminMutation" });
  if (!guard.ok) return guard.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "invalid_photo", message: "The upload could not be read." }, { status: 400 });
  }

  const file = form.get("photo");
  if (!(file instanceof File) || file.size <= 0) {
    return Response.json({ error: "invalid_photo", message: "Choose a photo to upload." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "invalid_photo", message: "Photo must be under 8 MB." }, { status: 400 });
  }
  if (file.type && !TYPES.has(file.type)) {
    return Response.json(
      { error: "invalid_photo", message: "Use a JPG, PNG, or WebP photo." },
      { status: 400 }
    );
  }

  let webp: Buffer;
  try {
    webp = await sharp(Buffer.from(await file.arrayBuffer()), { failOn: "none" })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return Response.json({ error: "invalid_photo", message: "That file is not a usable photo." }, { status: 400 });
  }

  const name = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.webp`;

  // Neon Object Storage, served from /media/. The deployment's filesystem is
  // read-only, so writing into public/ only ever worked on a local dev server.
  if (mediaStore()) {
    const key = `projects/${name}`;
    try {
      await putMedia(key, webp, "image/webp");
    } catch (error) {
      console.error("[admin/projects/image] upload failed", error);
      return Response.json(
        { error: "save_failed", message: "The photo could not be stored. Please try again in a moment." },
        { status: 503 }
      );
    }
    return Response.json({ ok: true, imageUrl: mediaUrl(key) });
  }

  const dir = path.join(process.cwd(), "public", "assets", "img", "projects");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), webp);

  return Response.json({ ok: true, imageUrl: `/assets/img/projects/${name}` });
}
