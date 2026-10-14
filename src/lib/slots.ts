// Pure scheduling logic (no database access) so it can be unit-tested.

import { addDays, localDateString, localInstant, localMinutesOfDay } from "./time";

export interface Interval {
  start: Date;
  end: Date;
}

export interface OpeningHours {
  /** minutes since local midnight */
  openMinutes: number;
  closeMinutes: number;
}

/** Half-open interval overlap: back-to-back intervals do NOT overlap. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** True when the whole interval fits inside one day's opening hours (local time). */
export function withinOpeningHours(interval: Interval, hours: OpeningHours): boolean {
  const sameDay = localDateString(interval.start) === localDateString(new Date(interval.end.getTime() - 1));
  if (!sameDay) return false;
  const startMin = localMinutesOfDay(interval.start);
  const endMin = startMin + Math.round((interval.end.getTime() - interval.start.getTime()) / 60_000);
  return startMin >= hours.openMinutes && endMin <= hours.closeMinutes;
}

/**
 * Finds the earliest start >= `from` where a booking of `durationMinutes` fits
 * inside opening hours without touching any of the `busy` intervals.
 * Searches up to `maxDays` days ahead. Returns null if nothing is found.
 */
export function findNextFreeSlot(
  from: Date,
  durationMinutes: number,
  busy: Interval[],
  hours: OpeningHours,
  maxDays = 14,
): Interval | null {
  const durationMs = durationMinutes * 60_000;
  if (durationMinutes > hours.closeMinutes - hours.openMinutes) return null;

  const sorted = [...busy].sort((a, b) => a.start.getTime() - b.start.getTime());
  let day = localDateString(from);
  let candidate = from;

  for (let i = 0; i < maxDays * (sorted.length + 3); i++) {
    const dayOpen = localInstant(day, hours.openMinutes);
    const dayClose = localInstant(day, hours.closeMinutes);

    if (candidate < dayOpen) candidate = dayOpen;

    const proposed: Interval = { start: candidate, end: new Date(candidate.getTime() + durationMs) };

    // Does not fit before closing -> try the next day from opening time.
    if (proposed.end > dayClose) {
      day = addDays(day, 1);
      if (day > addDays(localDateString(from), maxDays)) return null;
      candidate = localInstant(day, hours.openMinutes);
      continue;
    }

    const clash = sorted.find((b) => overlaps(proposed, b));
    if (!clash) return proposed;

    // Jump to the end of the clashing reservation and re-check.
    candidate = clash.end > candidate ? clash.end : new Date(candidate.getTime() + 60_000);
    day = localDateString(candidate);
  }
  return null;
}

/** Free gaps (within opening hours) on one local day, given that day's busy intervals. */
export function freeGapsForDay(dateStr: string, busy: Interval[], hours: OpeningHours): Interval[] {
  const open = localInstant(dateStr, hours.openMinutes);
  const close = localInstant(dateStr, hours.closeMinutes);
  const sorted = [...busy]
    .filter((b) => b.end > open && b.start < close)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const gaps: Interval[] = [];
  let cursor = open;
  for (const b of sorted) {
    if (b.start > cursor) gaps.push({ start: cursor, end: b.start });
    if (b.end > cursor) cursor = b.end;
  }
  if (cursor < close) gaps.push({ start: cursor, end: close });
  return gaps;
}
