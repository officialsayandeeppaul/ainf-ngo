"use client";

import { useCallback, useState } from "react";
import { shortId } from "@/lib/audit-display";

async function writeClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Compact mono id with one-click copy — matches portal pills / dossier meta. */
export function CopyId({
  value,
  label = "Copy id",
  display,
}: {
  value: string;
  label?: string;
  display?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const shown = display ?? shortId(value);

  const onCopy = useCallback(async () => {
    const ok = await writeClipboard(value);
    setState(ok ? "copied" : "failed");
    window.setTimeout(() => setState("idle"), 1600);
  }, [value]);

  return (
    <button
      type="button"
      className={`pt-copy-id${state === "copied" ? " is-copied" : ""}${state === "failed" ? " is-failed" : ""}`}
      onClick={onCopy}
      title={`${label}: ${value}`}
      aria-label={`${label}: ${value}`}
    >
      <span className="pt-copy-id__value">{shown}</span>
      <span className="pt-copy-id__action">
        {state === "copied" ? "Copied" : state === "failed" ? "Retry" : "Copy"}
      </span>
    </button>
  );
}
