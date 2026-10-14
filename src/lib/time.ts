// Time helpers.
//
// The organisation works in ONE local time zone (Sri Lanka, UTC+05:30, no DST).
// All instants are stored as UTC (TIMESTAMPTZ) in the database; "opening hours"
// are wall-clock times in the local zone. Because the offset is fixed we can do
// the conversion with plain arithmetic - no date library needed.

const OFFSET_MINUTES = Number(
  (typeof window === "undefined" ? process.env.APP_UTC_OFFSET_MINUTES : undefined) ??
    process.env.NEXT_PUBLIC_UTC_OFFSET_MINUTES ??
    330,
);

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

export const utcOffsetMinutes = OFFSET_MINUTES;

/** Shifts an instant so that getUTC*() methods return LOCAL wall-clock parts. */
function toLocalShifted(date: Date): Date {
  return new Date(date.getTime() + OFFSET_MINUTES * MS_PER_MINUTE);
}

/** Minutes since local midnight (0-1439) for an instant. */
export function localMinutesOfDay(date: Date): number {
  const d = toLocalShifted(date);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Local calendar date as YYYY-MM-DD. */
export function localDateString(date: Date): string {
  return toLocalShifted(date).toISOString().slice(0, 10);
}

/** UTC instant of local midnight for a YYYY-MM-DD string. */
export function localDayStart(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - OFFSET_MINUTES * MS_PER_MINUTE);
}

/** UTC instant for local date + minutes-since-midnight. */
export function localInstant(dateStr: string, minutesOfDay: number): Date {
  return new Date(localDayStart(dateStr).getTime() + minutesOfDay * MS_PER_MINUTE);
}

export function addDays(dateStr: string, days: number): string {
  return localDateString(new Date(localDayStart(dateStr).getTime() + days * MS_PER_DAY + 12 * 60 * MS_PER_MINUTE));
}

/** "08:00" or "08:00:00" -> 480 */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** 480 -> "08:00" */
export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Value of an <input type="datetime-local"> ("2026-10-15T09:30") is a wall-clock
 * time with no zone. Interpret it in the organisation's zone.
 */
export function parseLocalInput(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi) - OFFSET_MINUTES * MS_PER_MINUTE);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(date: Date | string): string {
  const d = toLocalShifted(new Date(date));
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatTime(date: Date | string): string {
  const d = toLocalShifted(new Date(date));
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Value suitable for <input type="datetime-local"> in the local zone. */
export function toLocalInputValue(date: Date): string {
  return toLocalShifted(date).toISOString().slice(0, 16);
}
