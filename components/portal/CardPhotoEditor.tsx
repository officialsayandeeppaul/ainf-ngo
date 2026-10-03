"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    const form = new FormData(event.currentTarget);
    const result = await fetch("/api/membership/card-photo", { method: "POST", body: form });
    const payload = await result.json().catch(() => ({}));
    setBusy(false);
    if (!result.ok) {
      setError(payload.message ?? "Could not update the ID card.");
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
            <input name="fatherName" defaultValue={fatherName} maxLength={80} />
          </label>
          <label className="pt-card-editor__field">
            <span>Address</span>
            <input name="address" defaultValue={address} maxLength={160} />
          </label>
          <label className="pt-card-editor__field">
            <span>Mobile</span>
            <input name="mobile" defaultValue={mobile} maxLength={24} placeholder="+91 …" />
          </label>
          <label className="pt-card-editor__field">
            <span>Passport photo</span>
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
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
