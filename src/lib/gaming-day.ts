import { DateTime } from "luxon";

/**
 * Gaming-day clock.
 *
 * The operational day is not a calendar day. With the default configuration
 * a gaming day runs from 09:00 until 03:00 the next calendar morning in the
 * zone's timezone. 03:00–09:00 is a closed gap for the open/closed floor
 * status. Bookings are allowed in that gap and may run past closing.
 *
 * During the closed gap, `getGamingDay()` returns the gaming day that just
 * ended so reports and the floor still have a stable "current" label.
 * `isWithinGamingHours()` is false in that gap.
 *
 * All booking windows, reports, and timelines must use this module.
 */

export type OperatingHours = {
  gamingDayStart: string;
  gamingDayEnd: string;
  timezone: string;
};

export const DEFAULT_OPERATING_HOURS: OperatingHours = {
  gamingDayStart: "09:00",
  gamingDayEnd: "03:00",
  timezone: "Asia/Karachi",
};

export type GamingDayInfo = {
  /** YYYY-MM-DD. During the closed gap this is the gaming day that just ended. */
  gamingDay: string;
  withinHours: boolean;
  closedGap: boolean;
};

export function parseHm(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid time: ${value}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error(`Invalid time: ${value}`);
  return hour * 60 + minute;
}

export function isValidTimezone(timezone: string): boolean {
  return DateTime.now().setZone(timezone).isValid;
}

function localDateTime(instant: Date, timezone: string): DateTime {
  const local = DateTime.fromJSDate(instant, { zone: "utc" }).setZone(timezone);
  if (!local.isValid) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }
  return local;
}

function dateString(local: DateTime): string {
  return local.toFormat("yyyy-MM-dd");
}

export function getGamingDayInfo(instant: Date, hours: OperatingHours): GamingDayInfo {
  const local = localDateTime(instant, hours.timezone);
  const minutes = local.hour * 60 + local.minute + local.second / 60 + local.millisecond / 60000;
  const start = parseHm(hours.gamingDayStart);
  const end = parseHm(hours.gamingDayEnd);
  const crossesMidnight = end <= start;

  if (!crossesMidnight) {
    const within = minutes >= start && minutes < end;
    return { gamingDay: dateString(local), withinHours: within, closedGap: !within };
  }

  if (minutes >= start) {
    return { gamingDay: dateString(local), withinHours: true, closedGap: false };
  }
  if (minutes < end) {
    return {
      gamingDay: dateString(local.minus({ days: 1 })),
      withinHours: true,
      closedGap: false,
    };
  }
  return {
    gamingDay: dateString(local.minus({ days: 1 })),
    withinHours: false,
    closedGap: true,
  };
}

export function getGamingDay(instant: Date, hours: OperatingHours): string {
  return getGamingDayInfo(instant, hours).gamingDay;
}

export function isWithinGamingHours(instant: Date, hours: OperatingHours): boolean {
  return getGamingDayInfo(instant, hours).withinHours;
}

export function convertToGamingDayDate(instant: Date, hours: OperatingHours): string {
  return getGamingDay(instant, hours);
}

export function shiftGamingDay(gamingDay: string, days: number): string {
  const [year, month, day] = gamingDay.split("-").map(Number);
  return DateTime.fromObject({ year, month, day }, { zone: "utc" })
    .plus({ days })
    .toFormat("yyyy-MM-dd");
}

export function getPreviousGamingDay(gamingDay: string): string {
  return shiftGamingDay(gamingDay, -1);
}

export function getNextGamingDay(gamingDay: string): string {
  return shiftGamingDay(gamingDay, 1);
}

export function getGamingDayStart(gamingDay: string, hours: OperatingHours): Date {
  const [year, month, day] = gamingDay.split("-").map(Number);
  const [hour, minute] = hours.gamingDayStart.split(":").map(Number);
  const local = DateTime.fromObject(
    { year, month, day, hour, minute, second: 0, millisecond: 0 },
    { zone: hours.timezone },
  );
  if (!local.isValid) throw new Error("Invalid gaming day start.");
  return local.toUTC().toJSDate();
}

export function getGamingDayEnd(gamingDay: string, hours: OperatingHours): Date {
  const [year, month, day] = gamingDay.split("-").map(Number);
  const [hour, minute] = hours.gamingDayEnd.split(":").map(Number);
  let local = DateTime.fromObject(
    { year, month, day, hour, minute, second: 0, millisecond: 0 },
    { zone: hours.timezone },
  );
  if (parseHm(hours.gamingDayEnd) <= parseHm(hours.gamingDayStart)) {
    local = local.plus({ days: 1 });
  }
  if (!local.isValid) throw new Error("Invalid gaming day end.");
  return local.toUTC().toJSDate();
}

export function gamingDayLengthMinutes(hours: OperatingHours): number {
  const start = parseHm(hours.gamingDayStart);
  const end = parseHm(hours.gamingDayEnd);
  if (end <= start) return 24 * 60 - start + end;
  return end - start;
}

/**
 * Combine a gaming-day label with a clock time. Times before the day start
 * (for example 01:30 when the day starts at 09:00) fall on the next calendar
 * morning, still inside the same gaming day.
 */
export function combineGamingDayAndTime(
  gamingDay: string,
  timeHm: string,
  hours: OperatingHours,
): Date {
  const [year, month, day] = gamingDay.split("-").map(Number);
  const [hour, minute] = timeHm.split(":").map(Number);
  let local = DateTime.fromObject(
    { year, month, day, hour, minute, second: 0, millisecond: 0 },
    { zone: hours.timezone },
  );
  const crossesMidnight = parseHm(hours.gamingDayEnd) <= parseHm(hours.gamingDayStart);
  if (crossesMidnight && parseHm(timeHm) < parseHm(hours.gamingDayStart)) {
    local = local.plus({ days: 1 });
  }
  if (!local.isValid) throw new Error("Invalid booking time.");
  return local.toUTC().toJSDate();
}

export function isRangeWithinGamingDay(
  start: Date,
  end: Date,
  hours: OperatingHours,
): { ok: true; gamingDay: string } | { ok: false; gamingDay: string | null; reason: string } {
  if (end.getTime() <= start.getTime()) {
    return { ok: false, gamingDay: null, reason: "End time must be after start time." };
  }
  return { ok: true, gamingDay: getGamingDay(start, hours) };
}

/** 0 at gaming-day start, 1 at gaming-day end. Values outside the day are not clipped. */
export function positionOnGamingDay(instant: Date, gamingDay: string, hours: OperatingHours): number {
  const start = getGamingDayStart(gamingDay, hours).getTime();
  const end = getGamingDayEnd(gamingDay, hours).getTime();
  return (instant.getTime() - start) / (end - start);
}

export function weekdayIndex(gamingDay: string, timezone: string): number {
  const [year, month, day] = gamingDay.split("-").map(Number);
  const local = DateTime.fromObject({ year, month, day }, { zone: timezone });
  if (!local.isValid) throw new Error("Invalid gaming day.");
  return local.weekday % 7;
}

export function localMinutes(instant: Date, timezone: string): number {
  const local = localDateTime(instant, timezone);
  return local.hour * 60 + local.minute + local.second / 60;
}

/**
 * A window that crosses midnight (22:00–02:00) matches late evening or early morning.
 * Missing bounds mean the window is the whole day. End is exclusive.
 */
export function isMinutesInWindow(
  minutes: number,
  startHm: string | null | undefined,
  endHm: string | null | undefined,
): boolean {
  if (!startHm || !endHm) return true;
  const start = parseHm(startHm);
  const end = parseHm(endHm);
  if (start === end) return true;
  if (end > start) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

export function listGamingDays(from: string, to: string, limit = 400): string[] {
  if (from > to) return [];
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to && days.length < limit) {
    days.push(cursor);
    cursor = getNextGamingDay(cursor);
  }
  return days;
}

export function formatInstant(instant: Date, timezone: string, format: string): string {
  return localDateTime(instant, timezone).toFormat(format);
}

export function timeFormatToken(timeFormat: "12h" | "24h"): string {
  return timeFormat === "24h" ? "HH:mm" : "h:mm a";
}

export function formatClock(instant: Date, timezone: string, timeFormat: "12h" | "24h"): string {
  return formatInstant(instant, timezone, timeFormatToken(timeFormat));
}

export function formatGamingDayLabel(gamingDay: string, dateFormat: string, timezone: string): string {
  const [year, month, day] = gamingDay.split("-").map(Number);
  return DateTime.fromObject({ year, month, day }, { zone: timezone }).toFormat(dateFormat);
}

export function hoursTicks(hours: OperatingHours): { label: string; ratio: number }[] {
  const start = getGamingDayStart("2026-01-01", hours).getTime();
  const end = getGamingDayEnd("2026-01-01", hours).getTime();
  const ticks: { label: string; ratio: number }[] = [];
  const cursor = DateTime.fromMillis(start, { zone: "utc" }).setZone(hours.timezone);
  let current = cursor;
  const endLocal = DateTime.fromMillis(end, { zone: "utc" }).setZone(hours.timezone);
  while (current <= endLocal) {
    const ratio = (current.toUTC().toMillis() - start) / (end - start);
    ticks.push({ label: current.toFormat("HH:mm"), ratio });
    current = current.plus({ hours: 1 });
  }
  return ticks;
}

/** Share of the gaming day that has elapsed by midnight. 1 when the day ends at or before midnight. */
export function midnightCapRatio(hours: OperatingHours): number {
  const midnight = hoursTicks(hours).find((tick) => tick.label === "00:00");
  if (!midnight || midnight.ratio <= 0) return 1;
  return midnight.ratio;
}

/** Public homepage chart: same hours as the gaming day, cut off at 12:00 AM. */
export function publicHoursTicks(hours: OperatingHours): { label: string; ratio: number }[] {
  const ticks = hoursTicks(hours);
  const capped: { label: string; ratio: number }[] = [];
  for (const tick of ticks) {
    capped.push(tick);
    if (tick.label === "00:00") break;
  }
  const cap = capped[capped.length - 1]?.ratio || 1;
  return capped.map((tick) => ({ label: tick.label, ratio: cap > 0 ? tick.ratio / cap : tick.ratio }));
}

export function positionOnPublicTimeline(instant: Date, gamingDay: string, hours: OperatingHours): number {
  return positionOnGamingDay(instant, gamingDay, hours) / midnightCapRatio(hours);
}
