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

function parseIso(value: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(value: string): string {
  const date = parseIso(value);
  if (!date) return "";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type Box = { top: number; left: number; width: number };

export function PortalDateField({
  id,
  name,
  value,
  defaultValue = "",
  disabled = false,
  placeholder = "Pick a date",
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
  const selectedDate = parseIso(selected);
  const [view, setView] = useState(() => selectedDate ?? new Date());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (value != null) setInternal(value);
  }, [value]);

  useEffect(() => {
    if (open) setView(selectedDate ?? new Date());
  }, [open, selectedDate]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function place() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, Math.max(280, rect.width));
      const gap = 8;
      const estimated = 340;
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

  function pick(next: string) {
    setInternal(next);
    setOpen(false);
    onChange?.(next);
  }

  const label = selected ? formatDisplay(selected) : placeholder;
  const today = new Date();

  const panel =
    mounted && open && box
      ? createPortal(
          <div
            ref={panelRef}
            className="pt-date__panel"
            id={panelId}
            role="dialog"
            aria-label={ariaLabel ?? "Choose a date"}
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
                const iso = toIso(date);
                const active = selectedDate ? sameDay(date, selectedDate) : false;
                const isToday = sameDay(date, today);
                return (
                  <button
                    key={iso + String(inMonth)}
                    type="button"
                    className={`pt-date__day${!inMonth ? " is-muted" : ""}${active ? " is-active" : ""}${isToday ? " is-today" : ""}`}
                    onClick={() => pick(iso)}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="pt-date__foot">
              <button type="button" className="pt-date__link" onClick={() => pick("")}>
                Clear
              </button>
              <button type="button" className="pt-date__link" onClick={() => pick(toIso(today))}>
                Today
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
