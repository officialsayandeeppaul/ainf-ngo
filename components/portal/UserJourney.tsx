"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/portal/ConfirmDialog";
import { PortalDateField } from "@/components/portal/PortalDateField";
import { formatDayTime } from "@/lib/format-date";
import type { JourneyEvent, JourneyKind } from "@/lib/user-journey";

export function MembershipAdminControls({
  userId,
  live,
  recurring,
}: {
  userId: string;
  live: boolean;
  recurring: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);

  async function act(immediate: boolean) {
    setBusy(true);
    setError(null);
    const result = await fetch(`/api/admin/users/${userId}/membership`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ immediate }),
    });
    const payload = await result.json().catch(() => ({}));
    setBusy(false);
    if (!result.ok) {
      setError(payload.message ?? "Could not update membership.");
      return;
    }
    setEndOpen(false);
    setStopOpen(false);
    router.refresh();
  }

  if (!live) return null;

  return (
    <div className="pt-btn-row">
      {recurring ? (
        <button type="button" className="pt-btn pt-btn--secondary" disabled={busy} onClick={() => setStopOpen(true)}>
          Stop auto-renew
        </button>
      ) : null}
      <button type="button" className="pt-btn pt-btn--danger-soft" disabled={busy} onClick={() => setEndOpen(true)}>
        End now
      </button>
      {error ? <p className="pt-alert pt-alert--error">{error}</p> : null}
      <ConfirmDialog
        open={stopOpen}
        title="Stop automatic renewal for this member?"
        body="The badge stays until the current end date. No further charges are taken after that."
        confirmLabel="Yes, stop auto-renew"
        tone="secondary"
        busy={busy}
        onCancel={() => setStopOpen(false)}
        onConfirm={() => void act(false)}
      />
      <ConfirmDialog
        open={endOpen}
        title="End this membership now?"
        body="The badge is removed immediately. Unused days are not refunded."
        confirmLabel="Yes, end membership"
        tone="danger"
        busy={busy}
        onCancel={() => setEndOpen(false)}
        onConfirm={() => void act(true)}
      />
    </div>
  );
}

const KIND_LABEL: Record<JourneyKind | "all", string> = {
  all: "All",
  account: "Account",
  identity: "Identity",
  payment: "Payments",
  membership: "Membership",
  access: "Access",
  admin: "Admin",
};

const PAGE_SIZE = 20;

function dayStart(value: string): number | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function dayEnd(value: string): number | null {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function UserJourney({
  events,
  filterable = false,
  initialFrom = "",
  initialTo = "",
}: {
  events: JourneyEvent[];
  filterable?: boolean;
  initialFrom?: string;
  initialTo?: string;
}) {
  const [kind, setKind] = useState<JourneyKind | "all">("all");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setFrom(initialFrom);
    setTo(initialTo);
  }, [initialFrom, initialTo]);

  const filtered = useMemo(() => {
    const fromMs = dayStart(from);
    const toMs = dayEnd(to);
    return events
      .filter((event) => {
        if (kind !== "all" && event.kind !== kind) return false;
        const at = new Date(event.at).getTime();
        if (fromMs != null && at < fromMs) return false;
        if (toMs != null && at > toMs) return false;
        const hay = `${event.title} ${event.detail}`.toLowerCase();
        return !query.trim() || hay.includes(query.trim().toLowerCase());
      })
      .slice()
      .sort((a, b) => b.at.localeCompare(a.at) || a.title.localeCompare(b.title));
  }, [events, kind, query, from, to]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [kind, query, from, to, events]);

  if (events.length === 0) {
    return <p className="pt-empty">No journey events yet.</p>;
  }

  return (
    <div>
      {filterable ? (
        <div className="pt-crm-lifehead">
          <div className="pt-crm-filters">
            {(Object.keys(KIND_LABEL) as Array<JourneyKind | "all">).map((key) => (
              <button
                key={key}
                type="button"
                className={`pt-crm-chip${kind === key ? " is-on" : ""}`}
                onClick={() => setKind(key)}
              >
                {KIND_LABEL[key]}
              </button>
            ))}
          </div>
          <div className="pt-crm-lifehead__tools">
            <input
              className="pt-input pt-crm-lifehead__search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this lifecycle"
              aria-label="Search this lifecycle"
            />
            <label className="pt-label" style={{ margin: 0 }}>
              Start date
              <PortalDateField
                value={from}
                placeholder="Start date"
                onChange={setFrom}
              />
            </label>
            <label className="pt-label" style={{ margin: 0 }}>
              End date
              <PortalDateField value={to} placeholder="End date" onChange={setTo} />
            </label>
          </div>
        </div>
      ) : null}
      {filtered.length === 0 ? (
        <p className="pt-empty">No events match these filters.</p>
      ) : (
        <>
          <ol className="pt-journey">
            {slice.map((event, index) => (
              <li
                className={`pt-journey__item pt-journey__item--${event.tone}`}
                key={`${event.at}-${event.title}-${index}`}
              >
                <time className="pt-journey__when" dateTime={event.at}>
                  {formatDayTime(new Date(event.at))}
                </time>
                <strong className="pt-journey__title">
                  {event.title}
                  {filterable ? (
                    <span className="pt-crm-chip pt-crm-chip--quiet">{KIND_LABEL[event.kind]}</span>
                  ) : null}
                </strong>
                <span className="pt-journey__detail">{event.detail}</span>
              </li>
            ))}
          </ol>
          <div className="pt-pager" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="pt-btn pt-btn--secondary pt-btn--sm"
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span className="pt-pager__meta">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length}
            </span>
            <button
              type="button"
              className="pt-btn pt-btn--secondary pt-btn--sm"
              disabled={safePage >= pages}
              onClick={() => setPage((current) => Math.min(pages, current + 1))}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
