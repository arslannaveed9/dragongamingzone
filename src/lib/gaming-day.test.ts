import { describe, expect, it } from "vitest";
import {
  combineGamingDayAndTime,
  convertToGamingDayDate,
  DEFAULT_OPERATING_HOURS,
  getGamingDay,
  getGamingDayEnd,
  getGamingDayStart,
  getNextGamingDay,
  getPreviousGamingDay,
  isRangeWithinGamingDay,
  isWithinGamingHours,
  positionOnPublicTimeline,
  publicHoursTicks,
} from "@/lib/gaming-day";
import { intervalsOverlap } from "@/lib/conflicts";
import { latestAllowedEnd } from "@/lib/pricing";

const hours = DEFAULT_OPERATING_HOURS;

/** Asia/Karachi is UTC+5. */
function pkt(isoLocal: string) {
  return new Date(`${isoLocal}+05:00`);
}

describe("gaming day boundaries", () => {
  it("treats 9:00 as the start of that calendar gaming day", () => {
    const instant = pkt("2026-09-29T09:00:00");
    expect(getGamingDay(instant, hours)).toBe("2026-09-29");
    expect(isWithinGamingHours(instant, hours)).toBe(true);
    expect(convertToGamingDayDate(instant, hours)).toBe("2026-09-29");
  });

  it("keeps late night and after midnight on the same gaming day", () => {
    expect(getGamingDay(pkt("2026-09-29T23:59:00"), hours)).toBe("2026-09-29");
    expect(getGamingDay(pkt("2026-09-30T00:00:00"), hours)).toBe("2026-09-29");
    expect(getGamingDay(pkt("2026-09-30T01:00:00"), hours)).toBe("2026-09-29");
    expect(getGamingDay(pkt("2026-09-30T02:59:00"), hours)).toBe("2026-09-29");
    expect(isWithinGamingHours(pkt("2026-09-30T02:59:00"), hours)).toBe(true);
  });

  it("closes the day at 3:00 and stays closed until 9:00", () => {
    expect(isWithinGamingHours(pkt("2026-09-30T03:00:00"), hours)).toBe(false);
    expect(getGamingDay(pkt("2026-09-30T03:00:00"), hours)).toBe("2026-09-29");
    expect(isWithinGamingHours(pkt("2026-09-30T08:59:00"), hours)).toBe(false);
    expect(getGamingDay(pkt("2026-09-30T08:59:00"), hours)).toBe("2026-09-29");
    const open = pkt("2026-09-30T09:00:00");
    expect(getGamingDay(open, hours)).toBe("2026-09-30");
    expect(isWithinGamingHours(open, hours)).toBe(true);
  });

  it("maps a gaming day to 9:00 through 3:00 the next morning", () => {
    expect(getGamingDayStart("2026-09-29", hours).toISOString()).toBe("2026-09-29T04:00:00.000Z");
    expect(getGamingDayEnd("2026-09-29", hours).toISOString()).toBe("2026-09-29T22:00:00.000Z");
    expect(getPreviousGamingDay("2026-09-29")).toBe("2026-09-28");
    expect(getNextGamingDay("2026-09-29")).toBe("2026-09-30");
  });

  it("accepts an overnight session and one that runs past closing", () => {
    const start = combineGamingDayAndTime("2026-09-29", "23:00", hours);
    const end = combineGamingDayAndTime("2026-09-29", "01:00", hours);
    expect(getGamingDay(start, hours)).toBe("2026-09-29");
    expect(getGamingDay(end, hours)).toBe("2026-09-29");
    expect(isRangeWithinGamingDay(start, end, hours).ok).toBe(true);

    const tooLate = combineGamingDayAndTime("2026-09-29", "03:30", hours);
    const lateStart = combineGamingDayAndTime("2026-09-29", "02:00", hours);
    expect(isRangeWithinGamingDay(lateStart, tooLate, hours).ok).toBe(true);
  });
});

describe("booking conflicts", () => {
  const six = pkt("2026-09-29T18:00:00");
  const eight = pkt("2026-09-29T20:00:00");
  const ten = pkt("2026-09-29T22:00:00");
  const seven = pkt("2026-09-29T19:00:00");
  const nine = pkt("2026-09-29T21:00:00");

  it("rejects an overlap and allows a booking that starts when the previous one ends", () => {
    expect(intervalsOverlap(six, eight, seven, nine)).toBe(true);
    expect(intervalsOverlap(six, eight, eight, ten)).toBe(false);
  });

  it("stops the public timeline at midnight", () => {
    const ticks = publicHoursTicks(hours);
    expect(ticks[0]?.label).toBe("09:00");
    expect(ticks[ticks.length - 1]?.label).toBe("00:00");
    expect(ticks[ticks.length - 1]?.ratio).toBeCloseTo(1);
    expect(ticks.some((tick) => tick.label === "01:00" || tick.label === "03:00")).toBe(false);
    const beforeMidnight = positionOnPublicTimeline(pkt("2026-09-29T23:00:00"), "2026-09-29", hours);
    const afterMidnight = positionOnPublicTimeline(pkt("2026-09-30T01:00:00"), "2026-09-29", hours);
    expect(beforeMidnight).toBeGreaterThan(0);
    expect(beforeMidnight).toBeLessThan(1);
    expect(afterMidnight).toBeGreaterThan(1);
  });

  it("caps an extension at the next booking", () => {
    const dayEnd = getGamingDayEnd("2026-09-29", hours);
    const next = pkt("2026-09-29T18:30:00");
    expect(latestAllowedEnd(dayEnd, next).toISOString()).toBe(next.toISOString());
    expect(latestAllowedEnd(dayEnd, null).toISOString()).toBe(dayEnd.toISOString());
  });
});
