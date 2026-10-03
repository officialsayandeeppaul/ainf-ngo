"use client";

import { useMemo, useState } from "react";
import type { FieldProjectView } from "@/lib/field-projects";
import { detailFor, type ProjectDetail } from "@/lib/project-detail";

type Draft = FieldProjectView;

const EMPTY: Draft = {
  id: "",
  slug: "",
  title: "",
  summary: "",
  raisedLabel: "₹0",
  goalLabel: "₹0",
  imageUrl: "/assets/img/hero-third/518fb7f61a5e6510.webp",
  href: "/projects/",
  sortOrder: 0,
  published: true,
  acceptDonations: false,
  donateMinPaise: null,
  updatedAt: "",
  detail: detailFor(""),
};

function messageFrom(body: { message?: string } | null, fallback: string) {
  return body?.message || fallback;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function sameProject(a: Draft, b: Draft) {
  return (
    a.title === b.title &&
    a.slug === b.slug &&
    a.summary === b.summary &&
    a.raisedLabel === b.raisedLabel &&
    a.goalLabel === b.goalLabel &&
    a.imageUrl === b.imageUrl &&
    a.sortOrder === b.sortOrder &&
    a.published === b.published &&
    a.acceptDonations === b.acceptDonations &&
    a.donateMinPaise === b.donateMinPaise &&
    JSON.stringify(a.detail) === JSON.stringify(b.detail)
  );
}

function ProjectEditor({
  row,
  uploading,
  onChange,
  onUpload,
}: {
  row: Draft;
  uploading: boolean;
  onChange: (next: Partial<Draft>) => void;
  onUpload: (file: File, field: "imageUrl" | "missionImage" | "galleryImage") => void;
}) {
  function patchDetail(next: Partial<ProjectDetail>) {
    onChange({ detail: { ...row.detail, ...next } });
  }

  function setLines(key: "howParagraphs" | "missionPoints" | "impactPoints", index: number, value: string) {
    const lines = row.detail[key].slice() as string[];
    lines[index] = value;
    patchDetail({ [key]: lines } as Partial<ProjectDetail>);
  }

  return (
    <div className="pt-project-card">
      <div className="pt-project-photo">
        <img src={row.imageUrl || EMPTY.imageUrl} alt="" />
        <label className="pt-btn pt-btn--secondary pt-btn--sm pt-project-upload">
          {uploading ? "Uploading…" : "Replace photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onUpload(file, "imageUrl");
            }}
          />
        </label>
        <p className="pt-hint">JPG, PNG, or WebP, under 8 MB. This photo is the card and the page banner.</p>
        <details className="pt-project-address">
          <summary>Photo address</summary>
          <input
            className="pt-input"
            value={row.imageUrl}
            aria-label="Photo address"
            onChange={(event) => onChange({ imageUrl: event.target.value })}
          />
        </details>
      </div>
      <div className="pt-project-fields">
        <label className="pt-label pt-span">
          Title
          <input className="pt-input" value={row.title} onChange={(event) => onChange({ title: event.target.value })} />
        </label>
        <label className="pt-label pt-span">
          Summary
          <textarea className="pt-input" rows={3} value={row.summary} onChange={(event) => onChange({ summary: event.target.value })} />
        </label>
        <label className="pt-label">
          Raised
          <input className="pt-input" value={row.raisedLabel} onChange={(event) => onChange({ raisedLabel: event.target.value })} />
        </label>
        <label className="pt-label">
          Goal
          <input className="pt-input" value={row.goalLabel} onChange={(event) => onChange({ goalLabel: event.target.value })} />
        </label>
        <label className="pt-label pt-span">
          Page address
          <span className="pt-project-slug">
            <span>/projects/</span>
            <input
              className="pt-input"
              value={row.slug}
              onChange={(event) => onChange({ slug: event.target.value })}
            />
          </span>
        </label>
        <label className="pt-label">
          Order
          <input
            className="pt-input"
            type="number"
            min={0}
            value={row.sortOrder}
            onChange={(event) => onChange({ sortOrder: Number(event.target.value) })}
          />
        </label>
        <label className="pt-project-switch">
          <input
            type="checkbox"
            checked={row.published}
            onChange={(event) => onChange({ published: event.target.checked })}
          />
          <span>
            <strong>{row.published ? "Live on the site" : "Hidden"}</strong>
            <small>{row.published ? "Visitors can open this project." : "Saved here, not shown on the site."}</small>
          </span>
        </label>
        <label className="pt-project-switch">
          <input
            type="checkbox"
            checked={row.acceptDonations}
            onChange={(event) => onChange({ acceptDonations: event.target.checked })}
          />
          <span>
            <strong>{row.acceptDonations ? "Gifts on" : "Gifts off"}</strong>
            <small>
              {row.acceptDonations
                ? "This project can be chosen on the gift page."
                : "Hidden from the gift page."}
            </small>
          </span>
        </label>
        <label className="pt-label">
          Gift minimum (₹)
          <input
            className="pt-input"
            inputMode="decimal"
            placeholder="Use the global minimum"
            value={row.donateMinPaise == null ? "" : String(row.donateMinPaise / 100)}
            onChange={(event) => {
              const raw = event.target.value.trim();
              if (!raw) {
                onChange({ donateMinPaise: null });
                return;
              }
              const rupees = Number(raw);
              if (!Number.isFinite(rupees)) return;
              onChange({ donateMinPaise: Math.round(rupees * 100) });
            }}
          />
        </label>
      </div>
        <div className="pt-project-page">
          <h3>On the project page</h3>
          <p className="pt-hint">These blocks sit under the banner. Save, then open the page.</p>
          <details className="pt-project-block" open>
            <summary>
              <span>How this works</span>
              <svg className="pt-project-chevron" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
          <div className="pt-project-block__body">
          <label className="pt-label">
            Label
            <input className="pt-input" value={row.detail.howEyebrow} onChange={(event) => patchDetail({ howEyebrow: event.target.value })} />
          </label>
          <label className="pt-label">
            Intro
            <textarea className="pt-input" rows={2} value={row.detail.howIntro} onChange={(event) => patchDetail({ howIntro: event.target.value })} />
          </label>
          {row.detail.howParagraphs.map((line, index) => (
            <label className="pt-label" key={`how-${index}`}>
              Step {index + 1}
              <textarea className="pt-input" rows={3} value={line} onChange={(event) => setLines("howParagraphs", index, event.target.value)} />
            </label>
          ))}
          </div>
          </details>
          <details className="pt-project-block">
            <summary>
              <span>Our mission</span>
              <svg className="pt-project-chevron" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
          <div className="pt-project-block__body">
          <label className="pt-label">
            Label
            <input className="pt-input" value={row.detail.missionEyebrow} onChange={(event) => patchDetail({ missionEyebrow: event.target.value })} />
          </label>
          <label className="pt-label">
            Heading
            <textarea className="pt-input" rows={2} value={row.detail.missionTitle} onChange={(event) => patchDetail({ missionTitle: event.target.value })} />
          </label>
          {row.detail.missionPoints.map((line, index) => (
            <label className="pt-label" key={`mission-${index}`}>
              Point {index + 1}
              <textarea className="pt-input" rows={2} value={line} onChange={(event) => setLines("missionPoints", index, event.target.value)} />
            </label>
          ))}
          <div className="pt-project-side">
            <img src={row.detail.missionImage} alt="" />
            <label className="pt-btn pt-btn--secondary pt-btn--sm pt-project-upload">
              Mission photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) onUpload(file, "missionImage");
                }}
              />
            </label>
          </div>
          </div>
          </details>
          <details className="pt-project-block">
            <summary>
              <span>Impact</span>
              <svg className="pt-project-chevron" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
          <div className="pt-project-block__body">
          <label className="pt-label">
            Heading
            <input className="pt-input" value={row.detail.impactTitle} onChange={(event) => patchDetail({ impactTitle: event.target.value })} />
          </label>
          {row.detail.impactPoints.map((line, index) => (
            <label className="pt-label" key={`impact-${index}`}>
              Result {index + 1}
              <input className="pt-input" value={line} onChange={(event) => setLines("impactPoints", index, event.target.value)} />
            </label>
          ))}
          <div className="pt-project-side">
            <img src={row.detail.galleryImage} alt="" />
            <label className="pt-btn pt-btn--secondary pt-btn--sm pt-project-upload">
              Impact photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) onUpload(file, "galleryImage");
                }}
              />
            </label>
          </div>
          </div>
          </details>
        </div>
      </div>
  );
}

export function FieldProjectsEditor({ initial }: { initial: FieldProjectView[] }) {
  const [rows, setRows] = useState<Draft[]>(initial);
  const [saved, setSaved] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(initial.map((row) => [row.id, row]))
  );
  const [draft, setDraft] = useState<Draft>({ ...EMPTY, sortOrder: initial.length });
  const [slugTouched, setSlugTouched] = useState(false);
  const [selected, setSelected] = useState<string>(initial[0]?.id || "new");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ordered = useMemo(
    () => [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)),
    [rows]
  );
  const active = selected === "new" ? draft : rows.find((row) => row.id === selected) || ordered[0] || draft;
  const isNew = selected === "new" || !active.id;
  const dirty = !isNew && saved[active.id] ? !sameProject(active, saved[active.id]) : isNew;

  function patchRow(id: string, next: Partial<Draft>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...next } : row)));
  }

  function patchActive(next: Partial<Draft>) {
    if (isNew) {
      if (next.slug != null) setSlugTouched(true);
      setDraft((current) => {
        const title = next.title ?? current.title;
        const touched = next.slug != null || slugTouched;
        const slug = touched ? (next.slug ?? current.slug) : slugify(title);
        return { ...current, ...next, slug };
      });
      return;
    }
    patchRow(active.id, next);
  }

  async function upload(file: File, apply: (url: string) => void) {
    setError(null);
    setNotice(null);
    const body = new FormData();
    body.set("photo", file);
    const response = await fetch("/api/admin/projects/image", { method: "POST", body });
    const payload = (await response.json().catch(() => null)) as { message?: string; imageUrl?: string } | null;
    if (!response.ok || !payload?.imageUrl) {
      setError(messageFrom(payload, "The photo could not be uploaded."));
      return;
    }
    apply(payload.imageUrl);
    setNotice("Photo ready. Save to put it on the page.");
  }

  async function save(row: Draft) {
    setBusyId(row.id);
    setError(null);
    setNotice(null);
    const response = await fetch(`/api/admin/projects/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        raisedLabel: row.raisedLabel,
        goalLabel: row.goalLabel,
        imageUrl: row.imageUrl,
        sortOrder: Number(row.sortOrder) || 0,
        published: row.published,
        acceptDonations: row.acceptDonations,
        donateMinPaise: row.donateMinPaise,
        detail: row.detail,
      }),
    });
    const body = (await response.json().catch(() => null)) as { message?: string; project?: FieldProjectView } | null;
    setBusyId(null);
    if (!response.ok || !body?.project) {
      setError(messageFrom(body, "Could not save that project."));
      return;
    }
    patchRow(row.id, body.project);
    setSaved((current) => ({ ...current, [row.id]: body.project! }));
    setNotice(`${body.project.title} is updated on the site.`);
  }

  async function remove(row: Draft) {
    if (!window.confirm(`Remove “${row.title}” from the site?`)) return;
    setBusyId(row.id);
    setError(null);
    setNotice(null);
    const response = await fetch(`/api/admin/projects/${row.id}`, { method: "DELETE" });
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    setBusyId(null);
    if (!response.ok) {
      setError(messageFrom(body, "Could not remove that project."));
      return;
    }
    const remaining = rows.filter((item) => item.id !== row.id);
    setRows(remaining);
    setSelected(remaining[0]?.id || "new");
    setNotice(`${row.title} was removed.`);
  }

  async function create() {
    setBusyId("new");
    setError(null);
    setNotice(null);
    const response = await fetch("/api/admin/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: draft.slug,
        title: draft.title,
        summary: draft.summary,
        raisedLabel: draft.raisedLabel,
        goalLabel: draft.goalLabel,
        imageUrl: draft.imageUrl,
        sortOrder: Number(draft.sortOrder) || 0,
        published: draft.published,
        acceptDonations: draft.acceptDonations,
        donateMinPaise: draft.donateMinPaise,
        detail: draft.detail,
      }),
    });
    const body = (await response.json().catch(() => null)) as { message?: string; project?: FieldProjectView } | null;
    setBusyId(null);
    if (!response.ok || !body?.project) {
      setError(messageFrom(body, "Could not add that project."));
      return;
    }
    const project = body.project;
    setRows((current) => [...current, project]);
    setSaved((current) => ({ ...current, [project.id]: project }));
    setDraft({ ...EMPTY, sortOrder: project.sortOrder + 1 });
    setSlugTouched(false);
    setSelected(project.id);
    setNotice(`${project.title} was added.`);
  }

  return (
    <div className="pt-project-editor">
      {notice ? <p className="pt-project-note">{notice}</p> : null}
      {error ? <p className="pt-project-note pt-project-note--bad">{error}</p> : null}
      <div className="pt-project-layout">
        <aside className="pt-card pt-project-list">
          <div className="pt-project-list__head">
            <p>{ordered.length} on the site</p>
            <button className="pt-btn pt-btn--primary pt-btn--sm" type="button" onClick={() => setSelected("new")}>
              Add
            </button>
          </div>
          <div className="pt-project-list__items">
            {ordered.map((row) => {
              const changed = saved[row.id] ? !sameProject(row, saved[row.id]) : false;
              return (
                <button
                  key={row.id}
                  type="button"
                  className={`pt-project-pick${selected === row.id ? " is-on" : ""}`}
                  onClick={() => setSelected(row.id)}
                >
                  <img src={row.imageUrl || EMPTY.imageUrl} alt="" />
                  <span>
                    <strong>{row.title || "Untitled"}</strong>
                    <small>
                      {row.raisedLabel} raised · {row.goalLabel} goal
                    </small>
                  </span>
                  <em className={row.published ? "" : "is-hidden"}>{changed ? "Unsaved" : row.published ? "Live" : "Hidden"}</em>
                </button>
              );
            })}
            {selected === "new" ? (
              <button type="button" className="pt-project-pick is-on" onClick={() => setSelected("new")}>
                <img src={draft.imageUrl || EMPTY.imageUrl} alt="" />
                <span>
                  <strong>{draft.title || "New project"}</strong>
                  <small>Not saved yet</small>
                </span>
                <em>New</em>
              </button>
            ) : null}
          </div>
        </aside>

        <section className="pt-card pt-project-section">
          <div className="pt-project-section__head">
            <div>
              <p className="pt-eyebrow">{isNew ? "New project" : active.published ? "Live" : "Hidden"}</p>
              <h2 className="pt-section-title">{active.title || "Untitled project"}</h2>
            </div>
            {!isNew && active.slug ? (
              <a className="pt-btn pt-btn--ghost pt-btn--sm" href={`/projects/${active.slug}`}>
                Open page
              </a>
            ) : null}
          </div>
          <ProjectEditor
            row={active}
            uploading={busyId === (isNew ? "up-new" : `up-${active.id}`)}
            onChange={patchActive}
            onUpload={async (file, field) => {
              const key = isNew ? "up-new" : `up-${active.id}`;
              setBusyId(key);
              await upload(file, (imageUrl) => {
                if (field === "imageUrl") patchActive({ imageUrl });
                else patchActive({ detail: { ...active.detail, [field]: imageUrl } });
              });
              setBusyId(null);
            }}
          />
          <div className="pt-project-actions">
            {isNew ? (
              <button className="pt-btn pt-btn--primary pt-btn--sm" type="button" disabled={busyId === "new" || !draft.title || !draft.slug} onClick={create}>
                {busyId === "new" ? "Adding…" : "Add project"}
              </button>
            ) : (
              <button className="pt-btn pt-btn--primary pt-btn--sm" type="button" disabled={!dirty || busyId === active.id} onClick={() => save(active)}>
                {busyId === active.id ? "Saving…" : dirty ? "Save changes" : "Saved"}
              </button>
            )}
            {!isNew ? (
              <button className="pt-btn pt-btn--ghost pt-btn--sm pt-project-remove" type="button" disabled={busyId === active.id} onClick={() => remove(active)}>
                Remove
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
