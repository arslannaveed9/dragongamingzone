/**
 * Two bookings conflict when their half-open intervals overlap.
 * [6:00, 8:00) and [8:00, 10:00) do not conflict.
 * [6:00, 8:00) and [7:00, 9:00) do.
 */
export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export function findConflictingInterval<T extends { startAt: Date; endAt: Date }>(
  startAt: Date,
  endAt: Date,
  existing: T[],
): T | null {
  return existing.find((item) => intervalsOverlap(startAt, endAt, item.startAt, item.endAt)) ?? null;
}
