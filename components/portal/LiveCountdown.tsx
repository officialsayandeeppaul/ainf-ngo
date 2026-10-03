"use client";

import { useEffect, useState } from "react";

function pad(value: number) {
  return String(Math.max(0, value)).padStart(2, "0");
}

export type CountdownParts = {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
};

export function getCountdownParts(endsAtIso: string, now = Date.now()): CountdownParts {
  const totalMs = new Date(endsAtIso).getTime() - now;
  if (totalMs <= 0) {
    return { totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  }
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { totalMs, days, hours, minutes, seconds, done: false };
}

/** Live HH-style countdown units for a support campaign end time. */
export function LiveCountdown({
  endsAt,
  compact = false,
  className,
}: {
  endsAt: string;
  compact?: boolean;
  className?: string;
}) {
  // null until mount — avoids SSR vs client second mismatch hydration errors
  const [parts, setParts] = useState<CountdownParts | null>(null);

  useEffect(() => {
    setParts(getCountdownParts(endsAt));
    const id = window.setInterval(() => setParts(getCountdownParts(endsAt)), 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  const shellClass = `pt-countdown${compact ? " pt-countdown--compact" : ""}${className ? ` ${className}` : ""}`;

  if (!parts) {
    return (
      <div className={`${shellClass} pt-countdown--pending`} role="timer" aria-hidden="true">
        {(compact ? ["Days", "Hours", "Mins", "Secs"] : ["Days", "Hours", "Mins", "Secs"]).map((label) => (
          <div className="pt-countdown__unit" key={label}>
            <span className="pt-countdown__value">--</span>
            <span className="pt-countdown__label">{label}</span>
          </div>
        ))}
      </div>
    );
  }

  if (parts.done) {
    return <span className={className ?? "pt-countdown pt-countdown--done"}>Ended</span>;
  }

  const units = [
    parts.days > 0 ? { key: "d", label: "Days", value: parts.days } : null,
    { key: "h", label: "Hours", value: parts.hours },
    { key: "m", label: "Mins", value: parts.minutes },
    { key: "s", label: "Secs", value: parts.seconds },
  ].filter(Boolean) as Array<{ key: string; label: string; value: number }>;

  return (
    <div
      className={shellClass}
      role="timer"
      aria-live="polite"
      aria-label={`Time remaining ${parts.days} days ${parts.hours} hours ${parts.minutes} minutes`}
    >
      {units.map((unit) => (
        <div className="pt-countdown__unit" key={unit.key}>
          <span className="pt-countdown__value">{compact ? pad(unit.value) : unit.value}</span>
          <span className="pt-countdown__label">{unit.label}</span>
        </div>
      ))}
    </div>
  );
}
