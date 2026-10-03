"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type PortalSelectOption = {
  value: string;
  label: string;
  hint?: string;
};

type DrawerBox = {
  top: number;
  left: number;
  width: number;
  minWidth: number;
  maxHeight: number;
};

export function PortalSelect({
  options,
  value,
  defaultValue = "",
  name,
  id,
  disabled = false,
  size = "md",
  searchable,
  searchPlaceholder = "Search…",
  remoteSearchUrl,
  ariaLabel,
  className,
  onChange,
}: {
  options: PortalSelectOption[];
  value?: string;
  defaultValue?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  size?: "md" | "sm";
  /** Force a search field. Defaults to on when there are more than 8 options or remote search is set. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** When set, typing searches this endpoint (`?q=`) and keeps results capped server-side. */
  remoteSearchUrl?: string;
  ariaLabel?: string;
  className?: string;
  onChange?: (value: string) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [box, setBox] = useState<DrawerBox | null>(null);
  const [query, setQuery] = useState("");
  const [remoteOptions, setRemoteOptions] = useState<PortalSelectOption[] | null>(null);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [internal, setInternal] = useState(value ?? defaultValue);
  const selected = value ?? internal;
  const baseOptions = options;
  const current =
    baseOptions.find((option) => option.value === selected) ??
    remoteOptions?.find((option) => option.value === selected) ??
    baseOptions[0];
  const canSearch = searchable ?? (Boolean(remoteSearchUrl) || baseOptions.length > 8);

  const filtered = useMemo(() => {
    if (remoteSearchUrl) {
      const remote = remoteOptions ?? [];
      const seen = new Set<string>();
      const merged: PortalSelectOption[] = [];
      for (const option of [...baseOptions.filter((item) => !item.value), ...remote, ...baseOptions]) {
        if (seen.has(option.value)) continue;
        seen.add(option.value);
        merged.push(option);
      }
      return merged;
    }
    const needle = query.trim().toLowerCase();
    if (!needle) return baseOptions;
    return baseOptions.filter((option) => {
      const hay = `${option.label} ${option.hint ?? ""} ${option.value}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [baseOptions, query, remoteOptions, remoteSearchUrl]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (value != null) setInternal(value);
  }, [value]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setRemoteOptions(null);
      setRemoteBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!remoteSearchUrl || !open) return;
    const needle = query.trim();
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setRemoteBusy(true);
      const url = new URL(remoteSearchUrl, window.location.origin);
      if (needle) url.searchParams.set("q", needle);
      url.searchParams.set("limit", "10");
      void fetch(url.toString(), { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("search_failed");
          const payload = (await response.json()) as { options?: PortalSelectOption[] };
          setRemoteOptions(Array.isArray(payload.options) ? payload.options : []);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setRemoteOptions([]);
        })
        .finally(() => setRemoteBusy(false));
    }, needle ? 220 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, open, remoteSearchUrl]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function place() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const gap = 8;
      const width = size === "sm" ? Math.max(rect.width, 180) : Math.max(rect.width, 220);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
      const spaceAbove = rect.top - gap - 8;
      const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(160, Math.min(320, openUp ? spaceAbove : spaceBelow));
      setBox({
        top: openUp ? Math.max(8, rect.top - maxHeight - gap) : rect.bottom + gap,
        left,
        width,
        minWidth: rect.width,
        maxHeight,
      });
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, size, filtered.length, canSearch, remoteBusy]);

  useEffect(() => {
    if (!open) return;
    if (canSearch) {
      searchRef.current?.focus({ preventScroll: true });
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || drawerRef.current?.contains(target)) return;
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
  }, [open, canSearch]);

  function pick(next: string) {
    setInternal(next);
    setOpen(false);
    onChange?.(next);
  }

  const drawer =
    mounted && open && box
      ? createPortal(
          <div
            ref={drawerRef}
            className={`pt-menu__drawer${size === "sm" ? " pt-menu__drawer--sm" : ""}`}
            style={{
              position: "fixed",
              top: box.top,
              left: box.left,
              width: box.width,
              minWidth: box.minWidth,
              maxHeight: box.maxHeight,
              right: "auto",
            }}
          >
            {canSearch ? (
              <div className="pt-menu__search">
                <input
                  ref={searchRef}
                  className="pt-input pt-menu__search-input"
                  type="search"
                  value={query}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const first = filtered.find((option) => option.value) ?? filtered[0];
                      if (first) pick(first.value);
                    }
                  }}
                />
              </div>
            ) : null}
            <ul className="pt-menu__list" id={listId} role="listbox" aria-label={ariaLabel}>
              {remoteBusy && filtered.length <= 1 ? (
                <li className="pt-menu__empty" role="presentation">
                  Searching…
                </li>
              ) : filtered.length === 0 ? (
                <li className="pt-menu__empty" role="presentation">
                  No matches
                </li>
              ) : (
                filtered.map((option) => {
                  const active = option.value === selected;
                  return (
                    <li key={`${option.value || "empty"}-${option.label}`} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`pt-menu__option${active ? " is-active" : ""}`}
                        onClick={() => pick(option.value)}
                      >
                        <span className="pt-menu__option-label">{option.label}</span>
                        {option.hint ? <span className="pt-menu__option-hint">{option.hint}</span> : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={`pt-menu${size === "sm" ? " pt-menu--sm" : ""}${className ? ` ${className}` : ""}`}
    >
      {name ? <input type="hidden" name={name} value={selected} /> : null}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`pt-menu__trigger${open ? " is-open" : ""}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
      >
        <span className="pt-menu__label">{current?.label ?? "Select"}</span>
        <span className="pt-menu__chevron" aria-hidden="true" />
      </button>
      {drawer}
    </div>
  );
}
