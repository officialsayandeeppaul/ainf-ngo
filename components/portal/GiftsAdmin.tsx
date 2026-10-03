"use client";

import { useState } from "react";

export type GiftMission = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  sortOrder: number;
  minPaise: number | null;
};

export type GiftLedgerRow = {
  id: string;
  when: string;
  name: string;
  email: string;
  target: string;
  amount: string;
  status: string;
  emailed: boolean;
};

function rupeesToPaise(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

function paiseField(paise: number | null): string {
  if (paise == null) return "";
  return String(paise / 100);
}

export function GiftsAdmin({
  initialSettings,
  initialMissions,
  initialRows,
  paidTotal,
}: {
  initialSettings: { minPaise: number; maxPaise: number; suggestedPaise: number[] };
  initialMissions: GiftMission[];
  initialRows: GiftLedgerRow[];
  paidTotal: string;
}) {
  const [minRupees, setMinRupees] = useState(String(initialSettings.minPaise / 100));
  const [maxRupees, setMaxRupees] = useState(String(initialSettings.maxPaise / 100));
  const [chips, setChips] = useState(initialSettings.suggestedPaise.map((value) => value / 100).join(", "));
  const [missions, setMissions] = useState(initialMissions);
  const [rows, setRows] = useState(initialRows);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ title: "", slug: "", min: "" });

  async function saveSettings() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const minPaise = rupeesToPaise(minRupees);
    const maxPaise = rupeesToPaise(maxRupees);
    const suggestedPaise = chips
      .split(",")
      .map((part) => rupeesToPaise(part))
      .filter((value): value is number => value != null);
    if (minPaise == null || maxPaise == null || suggestedPaise.length === 0) {
      setBusy(false);
      setError("Enter the minimum, maximum, and at least one suggested amount in rupees.");
      return;
    }
    const response = await fetch("/api/admin/donations/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ minPaise, maxPaise, suggestedPaise }),
    });
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    setBusy(false);
    if (!response.ok) {
      setError(body?.message || "Could not save gift settings.");
      return;
    }
    setNotice("Gift settings saved.");
  }

  async function saveMission(mission: GiftMission) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const response = await fetch(`/api/admin/donations/missions/${mission.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(mission),
    });
    const body = (await response.json().catch(() => null)) as { message?: string; mission?: GiftMission } | null;
    setBusy(false);
    if (!response.ok || !body?.mission) {
      setError(body?.message || "Could not save that mission.");
      return;
    }
    setMissions((current) => current.map((row) => (row.id === mission.id ? body.mission! : row)));
    setNotice(`${body.mission.title} saved.`);
  }

  async function addMission() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const response = await fetch("/api/admin/donations/missions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        slug: draft.slug,
        published: true,
        sortOrder: missions.length,
        minPaise: rupeesToPaise(draft.min),
      }),
    });
    const body = (await response.json().catch(() => null)) as { message?: string; mission?: GiftMission } | null;
    setBusy(false);
    if (!response.ok || !body?.mission) {
      setError(body?.message || "Could not add that mission.");
      return;
    }
    setMissions((current) => [...current, body.mission!]);
    setDraft({ title: "", slug: "", min: "" });
    setNotice(`${body.mission.title} added.`);
  }

  async function refund(id: string) {
    if (!window.confirm("Return this gift in full?")) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const response = await fetch(`/api/admin/donations/${id}/refund`, { method: "POST" });
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    setBusy(false);
    if (!response.ok) {
      setError(body?.message || "Could not return that gift.");
      return;
    }
    setRows((current) => current.map((row) => (row.id === id ? { ...row, status: "REFUNDED" } : row)));
    setNotice("Gift returned.");
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error ? <p className="pt-alert pt-alert--error">{error}</p> : null}
      {notice ? <p className="pt-hint">{notice}</p> : null}

      <section className="pt-card">
        <h2 className="pt-section-title">Amounts</h2>
        <p className="pt-hint">The global minimum applies to every gift. A mission or project can set a higher floor.</p>
        <div className="pt-grid pt-grid--2">
          <label className="pt-label">
            Minimum (₹)
            <input className="pt-input" value={minRupees} onChange={(event) => setMinRupees(event.target.value)} />
          </label>
          <label className="pt-label">
            Maximum (₹)
            <input className="pt-input" value={maxRupees} onChange={(event) => setMaxRupees(event.target.value)} />
          </label>
          <label className="pt-label">
            Suggested amounts (₹)
            <input className="pt-input" value={chips} onChange={(event) => setChips(event.target.value)} />
          </label>
        </div>
        <button className="pt-btn pt-btn--primary" type="button" disabled={busy} onClick={saveSettings}>
          Save amounts
        </button>
      </section>

      <section className="pt-card">
        <h2 className="pt-section-title">Missions</h2>
        <p className="pt-hint">Leave a mission minimum blank to use the global floor. Turn a mission off to hide it from the gift page.</p>
        {missions.map((mission) => (
          <div key={mission.id} className="pt-grid pt-grid--2" style={{ marginBottom: 12 }}>
            <label className="pt-label">
              Title
              <input
                className="pt-input"
                value={mission.title}
                onChange={(event) =>
                  setMissions((current) =>
                    current.map((row) => (row.id === mission.id ? { ...row, title: event.target.value } : row))
                  )
                }
              />
            </label>
            <label className="pt-label">
              Slug
              <input
                className="pt-input"
                value={mission.slug}
                onChange={(event) =>
                  setMissions((current) =>
                    current.map((row) => (row.id === mission.id ? { ...row, slug: event.target.value } : row))
                  )
                }
              />
            </label>
            <label className="pt-label">
              Minimum (₹)
              <input
                className="pt-input"
                placeholder="Global"
                value={paiseField(mission.minPaise)}
                onChange={(event) =>
                  setMissions((current) =>
                    current.map((row) =>
                      row.id === mission.id ? { ...row, minPaise: rupeesToPaise(event.target.value) } : row
                    )
                  )
                }
              />
            </label>
            <label className="pt-project-switch">
              <input
                type="checkbox"
                checked={mission.published}
                onChange={(event) =>
                  setMissions((current) =>
                    current.map((row) => (row.id === mission.id ? { ...row, published: event.target.checked } : row))
                  )
                }
              />
              <span>
                <strong>{mission.published ? "On the gift page" : "Hidden"}</strong>
              </span>
            </label>
            <button className="pt-btn" type="button" disabled={busy} onClick={() => saveMission(mission)}>
              Save
            </button>
          </div>
        ))}
        <div className="pt-grid pt-grid--2">
          <label className="pt-label">
            New mission
            <input className="pt-input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </label>
          <label className="pt-label">
            Slug
            <input className="pt-input" value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} />
          </label>
          <label className="pt-label">
            Minimum (₹)
            <input className="pt-input" value={draft.min} onChange={(event) => setDraft({ ...draft, min: event.target.value })} />
          </label>
        </div>
        <button className="pt-btn" type="button" disabled={busy} onClick={addMission}>
          Add mission
        </button>
      </section>

      <section className="pt-card">
        <h2 className="pt-section-title">Ledger</h2>
        <p className="pt-hint">Paid gifts still on the books: {paidTotal}. Returned gifts are not included. Project raised lines stay the figures you type.</p>
        <div className="pt-table-wrap">
          <table className="pt-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Giver</th>
                <th>For</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Email</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>No gifts yet.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.when}</td>
                    <td>
                      {row.name}
                      <br />
                      <span className="pt-hint">{row.email}</span>
                    </td>
                    <td>{row.target}</td>
                    <td>{row.amount}</td>
                    <td>{row.status === "REFUNDED" ? "Returned" : row.status === "PAID" ? "Received" : row.status}</td>
                    <td>{row.emailed ? "Sent" : "Not sent"}</td>
                    <td>
                      {row.status === "PAID" ? (
                        <button className="pt-btn" type="button" disabled={busy} onClick={() => refund(row.id)}>
                          Return
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
