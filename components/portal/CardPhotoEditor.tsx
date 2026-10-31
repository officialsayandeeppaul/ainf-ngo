"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CARD_ADDRESS_MAX, CARD_FATHER_NAME_MAX } from "@/lib/card-fields";
import { PhoneField } from "./PhoneField";

/** What the server takes (lib/membership-card-art.ts CARD_PHOTO_TYPES, 2 MB). */
const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SHRINK_ABOVE_BYTES = 1_500_000;

/**
 * Phone photos are often 3–8 MB (or HEIC), over the 2 MB limit and the host's
 * request cap. Big or unusual files are redrawn as a JPEG of at most 1600 px
 * first; the server still crops it to the passport slot.
 */
async function shrinkPhoto(file: File): Promise<File> {
  if (file.size <= SHRINK_ABOVE_BYTES && UPLOAD_TYPES.includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    // The browser cannot read it (e.g. HEIC on Windows); the server explains.
    return file;
  }
}

export function CardPhotoEditor({
  fatherName,
  address,
  mobile = "",
  savedPhoto = null,
}: {
  fatherName: string;
  address: string;
  mobile?: string;
  savedPhoto?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(savedPhoto);
  const [father, setFather] = useState(() => fatherName.slice(0, CARD_FATHER_NAME_MAX));
  const [home, setHome] = useState(() => address.slice(0, CARD_ADDRESS_MAX));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    const form = new FormData(event.currentTarget);
    const photo = form.get("photo");
    if (photo instanceof File && photo.size > 0) form.set("photo", await shrinkPhoto(photo));
    let result: Response;
    try {
      result = await fetch("/api/membership/card-photo", { method: "POST", body: form });
    } catch {
      setBusy(false);
      setError("The connection dropped. Check your network and try again.");
      return;
    }
    const payload = await result.json().catch(() => ({}));
    setBusy(false);
    if (!result.ok) {
      setError(
        payload.message ??
          (result.status === 413 ? "That photo is too large. Use one under 2 MB." : "Could not update the ID card. Please try again.")
      );
      return;
    }
    setNote("ID card updated — passport photo is cropped into the red frame.");
    router.refresh();
  }

  return (
    <form className="pt-card-editor" onSubmit={submit}>
      <h3 className="pt-section-title">Passport photo &amp; card details</h3>
      <p className="pt-hint" style={{ marginTop: 0 }}>
        Use a clear face photo like a passport picture (head and shoulders). We crop it to the
        official AINF photo slot. Father&apos;s name, address, and mobile print on the card.
      </p>
      <div className="pt-card-editor__grid">
        <div>
          <label className="pt-card-editor__field">
            <span>Father&apos;s name</span>
            <input
              name="fatherName"
              value={father}
              onChange={(event) => setFather(event.target.value)}
              maxLength={CARD_FATHER_NAME_MAX}
              autoComplete="off"
            />
            <span className="pt-field-count">
              {father.length}/{CARD_FATHER_NAME_MAX}
            </span>
          </label>
          <label className="pt-card-editor__field">
            <span>Address</span>
            <input
              name="address"
              value={home}
              onChange={(event) => setHome(event.target.value)}
              maxLength={CARD_ADDRESS_MAX}
              autoComplete="street-address"
              placeholder="Village / town, district, PIN"
            />
            <span className="pt-field-count">
              {home.length}/{CARD_ADDRESS_MAX}
            </span>
          </label>
          <label className="pt-card-editor__field">
            <span>Mobile</span>
            <PhoneField name="mobile" defaultValue={mobile} />
          </label>
          <label className="pt-card-editor__field">
            <span>Passport photo</span>
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  setPreview(null);
                  return;
                }
                const url = URL.createObjectURL(file);
                setPreview(url);
              }}
            />
          </label>
        </div>
        <div className="pt-card-editor__preview" aria-hidden={!preview}>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" />
          ) : (
            <span>Passport preview</span>
          )}
        </div>
      </div>
      {error ? <p className="pt-alert pt-alert--warning">{error}</p> : null}
      {note ? <p className="pt-hint">{note}</p> : null}
      <button type="submit" className="pt-btn pt-btn--secondary" disabled={busy}>
        {busy ? "Saving…" : "Save on ID card"}
      </button>
    </form>
  );
}
