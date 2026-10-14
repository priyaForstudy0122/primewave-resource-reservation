import { describe, expect, it } from "vitest";
import { findNextFreeSlot, freeGapsForDay, overlaps, withinOpeningHours } from "./slots";
import { localInstant } from "./time";

// Local zone is UTC+05:30 (see .env.example); helper builds local wall-clock instants.
const D = "2026-10-15";
const at = (h: number, m = 0, day = D) => localInstant(day, h * 60 + m);
const hours = { openMinutes: 8 * 60, closeMinutes: 18 * 60 };

describe("overlaps", () => {
  it("detects partial overlap", () => {
    expect(overlaps({ start: at(9), end: at(11) }, { start: at(10), end: at(12) })).toBe(true);
  });
  it("allows back-to-back bookings", () => {
    expect(overlaps({ start: at(9), end: at(10) }, { start: at(10), end: at(11) })).toBe(false);
  });
  it("detects containment", () => {
    expect(overlaps({ start: at(9), end: at(17) }, { start: at(12), end: at(13) })).toBe(true);
  });
});

describe("withinOpeningHours", () => {
  it("accepts a booking inside the window", () => {
    expect(withinOpeningHours({ start: at(9), end: at(10) }, hours)).toBe(true);
  });
  it("accepts a booking that ends exactly at closing time", () => {
    expect(withinOpeningHours({ start: at(17), end: at(18) }, hours)).toBe(true);
  });
  it("rejects a booking before opening", () => {
    expect(withinOpeningHours({ start: at(7), end: at(9) }, hours)).toBe(false);
  });
  it("rejects a booking that runs past closing", () => {
    expect(withinOpeningHours({ start: at(17), end: at(19) }, hours)).toBe(false);
  });
  it("rejects a booking spanning midnight", () => {
    expect(withinOpeningHours({ start: at(17), end: at(9, 0, "2026-10-16") }, hours)).toBe(false);
  });
});

describe("findNextFreeSlot", () => {
  it("returns the requested time when nothing blocks it", () => {
    const slot = findNextFreeSlot(at(9), 60, [], hours);
    expect(slot?.start).toEqual(at(9));
  });

  it("moves to the end of the clashing reservation", () => {
    const slot = findNextFreeSlot(at(9), 60, [{ start: at(9), end: at(10, 30) }], hours);
    expect(slot?.start).toEqual(at(10, 30));
    expect(slot?.end).toEqual(at(11, 30));
  });

  it("skips over several consecutive reservations", () => {
    const busy = [
      { start: at(9), end: at(10) },
      { start: at(10), end: at(12) },
      { start: at(12, 30), end: at(14) },
    ];
    const slot = findNextFreeSlot(at(9), 60, busy, hours);
    // 12:00-12:30 is only 30 min, so a 60 min booking must wait until 14:00.
    expect(slot?.start).toEqual(at(14));
  });

  it("rolls over to the next morning when today is full", () => {
    const slot = findNextFreeSlot(at(9), 60, [{ start: at(8), end: at(18) }], hours);
    expect(slot?.start).toEqual(at(8, 0, "2026-10-16"));
  });

  it("starts at opening time when asked for a time before opening", () => {
    const slot = findNextFreeSlot(at(6), 60, [], hours);
    expect(slot?.start).toEqual(at(8));
  });

  it("returns null when the duration can never fit", () => {
    expect(findNextFreeSlot(at(9), 11 * 60, [], hours)).toBeNull();
  });
});

describe("freeGapsForDay", () => {
  it("returns the whole day when empty", () => {
    const gaps = freeGapsForDay(D, [], hours);
    expect(gaps).toEqual([{ start: at(8), end: at(18) }]);
  });

  it("returns the gaps between reservations", () => {
    const gaps = freeGapsForDay(D, [{ start: at(9), end: at(10) }, { start: at(13), end: at(14) }], hours);
    expect(gaps).toEqual([
      { start: at(8), end: at(9) },
      { start: at(10), end: at(13) },
      { start: at(14), end: at(18) },
    ]);
  });
});
