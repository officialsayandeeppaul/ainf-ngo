const TZ = "Asia/Kolkata";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function part(date: Date, options: Intl.DateTimeFormatOptions, type: Intl.DateTimeFormatPartTypes) {
  return (
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...options }).formatToParts(date).find((entry) => entry.type === type)
      ?.value ?? ""
  );
}

/** Stable India-time stamps so SSR HTML matches the browser. */
export function formatDay(date: Date): string {
  const day = part(date, { day: "2-digit" }, "day");
  const month = Number(part(date, { month: "numeric" }, "month"));
  const year = part(date, { year: "numeric" }, "year");
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function formatClock(date: Date): string {
  const hour = part(date, { hour: "2-digit", minute: "2-digit", hour12: false }, "hour");
  const minute = part(date, { hour: "2-digit", minute: "2-digit", hour12: false }, "minute");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function formatDayTime(date: Date): string {
  return `${formatDay(date)}, ${formatClock(date)}`;
}
