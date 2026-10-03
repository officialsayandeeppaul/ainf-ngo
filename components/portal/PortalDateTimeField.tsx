"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Local wall time `YYYY-MM-DDTHH:mm` (same shape as `<input type="datetime-local">`). */
function parseLocal(value: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function toDateIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(value: string): string {
  const date = parseLocal(value);
  if (!date) return "";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type Box = { top: number; left: number; width: number };

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINS = ["00", "15", "30", "45"];

/** AINF-styled date + time picker (portal calendar, not the browser chrome). */
export function PortalDateTimeField({
  id,
  name,
  value,
  defaultValue = "",
  disabled = false,
  placeholder = "Pick date & time",
  ariaLabel,
  className,
  onChange,
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  onChange?: (value: string) => void;
}) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const [internal, setInternal] = useState(value ?? defaultValue);
  const selected = value ?? internal;
  const selectedDate = parseLocal(selected);
  const [view, setView] = useState(() => selectedDate ?? new Date());
  const [hour, setHour] = useState(() =>
    selectedDate ? String(selectedDate.getHours()).padStart(2, "0") : "18"
  );
  const [minute, setMinute] = useState(() => {
    if (!selectedDate) return "00";
    const raw = selectedDate.getMinutes();
    const snapped = MINS.reduce((best, item) =>
      Math.abs(Number(item) - raw) < Math.abs(Number(best) - raw) ? item : best
    );
    return snapped;
  });
  const [draftDay, setDraftDay] = useState<Date | null>(selectedDate);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (value != null) setInternal(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const base = selectedDate ?? new Date();
    setView(base);
    setDraftDay(base);
    setHour(String(base.getHours()).padStart(2, "0"));
    const raw = base.getMinutes();
    setMinute(
      MINS.reduce((best, item) =>
        Math.abs(Number(item) - raw) < Math.abs(Number(best) - raw) ? item : best
      )
    );
  }, [open, selectedDate]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function place() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(340, Math.max(300, rect.width));
      const gap = 8;
      const estimated = 520;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const openUp = spaceBelow < estimated && rect.top > spaceBelow;
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      setBox({
        top: openUp ? Math.max(8, rect.top - estimated - gap) : rect.bottom + gap,
        left,
        width,
      });
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cells = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = 0; i < startPad; i += 1) {
      out.push({ date: new Date(year, month, i - startPad + 1), inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      out.push({ date: new Date(year, month, day), inMonth: true });
    }
    while (out.length % 7 !== 0) {
      const last = out[out.length - 1].date;
      out.push({
        date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
        inMonth: false,
      });
    }
    return out;
  }, [view]);

  function commit(day: Date, nextHour = hour, nextMinute = minute) {
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(nextHour), Number(nextMinute), 0, 0);
    const local = toLocal(next);
    setInternal(local);
    setOpen(false);
    onChange?.(local);
  }

  function clear() {
    setInternal("");
    setDraftDay(null);
    setOpen(false);
    onChange?.("");
  }

  const label = selected ? formatDisplay(selected) : placeholder;
  const today = new Date();

  const panel =
    mounted && open && box
      ? createPortal(
          <div
            ref={panelRef}
            className="pt-date__panel pt-date__panel--time"
            id={panelId}
            role="dialog"
            aria-label={ariaLabel ?? "Choose date and time"}
            style={{ top: box.top, left: box.left, width: box.width }}
          >
            <div className="pt-date__head">
              <button
                type="button"
                className="pt-date__nav"
                aria-label="Previous month"
                onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              >
                ‹
              </button>
              <p className="pt-date__month">
                {MONTHS[view.getMonth()]} {view.getFullYear()}
              </p>
              <button
                type="button"
                className="pt-date__nav"
                aria-label="Next month"
                onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              >
                ›
              </button>
            </div>
            <div className="pt-date__week" aria-hidden="true">
              {WEEKDAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="pt-date__grid">
              {cells.map(({ date, inMonth }) => {
                const iso = toDateIso(date);
                const active = draftDay ? sameDay(date, draftDay) : false;
                const isToday = sameDay(date, today);
                return (
                  <button
                    key={iso + String(inMonth)}
                    type="button"
                    className={`pt-date__day${!inMonth ? " is-muted" : ""}${active ? " is-active" : ""}${isToday ? " is-today" : ""}`}
                    onClick={() => setDraftDay(date)}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="pt-date__time" role="group" aria-label="Time">
              <div className="pt-date__time-block">
                <p className="pt-date__time-label">Hour</p>
                <div className="pt-date__time-grid pt-date__time-grid--hours">
                  {HOURS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`pt-date__time-chip${hour === item ? " is-active" : ""}`}
                      onClick={() => setHour(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pt-date__time-block">
                <p className="pt-date__time-label">Minute</p>
                <div className="pt-date__time-grid pt-date__time-grid--mins">
                  {MINS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`pt-date__time-chip${minute === item ? " is-active" : ""}`}
                      onClick={() => setMinute(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="pt-date__foot">
              <button type="button" className="pt-date__link" onClick={clear}>
                Clear
              </button>
              <button
                type="button"
                className="pt-date__link"
                onClick={() => {
                  const base = new Date();
                  setDraftDay(base);
                  setHour(String(base.getHours()).padStart(2, "0"));
                  setMinute("00");
                }}
              >
                Now
              </button>
              <button
                type="button"
                className="pt-btn pt-btn--primary pt-btn--sm"
                disabled={!draftDay}
                onClick={() => draftDay && commit(draftDay)}
              >
                Set
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={`pt-date${className ? ` ${className}` : ""}`}>
      {name ? <input type="hidden" name={name} value={selected} /> : null}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`pt-date__trigger${open ? " is-open" : ""}${selected ? "" : " is-empty"}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="pt-date__label">{label}</span>
        <span className="pt-date__icon" aria-hidden="true" />
      </button>
      {panel}
    </div>
  );
}
