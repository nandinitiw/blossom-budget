import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subMonths,
  subWeeks,
  format,
  getISOWeek,
  getISOWeekYear,
} from "date-fns";

export type DateRange = { start: Date; end: Date };

export function monthRange(d: Date = new Date()): DateRange {
  return { start: startOfMonth(d), end: endOfMonth(d) };
}

export function prevMonthRange(d: Date = new Date()): DateRange {
  return monthRange(subMonths(d, 1));
}

/** Weeks start on Monday. */
export function weekRange(d: Date = new Date()): DateRange {
  return {
    start: startOfWeek(d, { weekStartsOn: 1 }),
    end: endOfWeek(d, { weekStartsOn: 1 }),
  };
}

export function prevWeekRange(d: Date = new Date()): DateRange {
  return weekRange(subWeeks(d, 1));
}

/** Idempotency keys for EmailLog: "2026-06" (monthly), "2026-W26" (weekly). */
export function monthKey(d: Date = new Date()): string {
  return format(d, "yyyy-MM");
}

export function weekKey(d: Date = new Date()): string {
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
}

/** Fraction of the current period elapsed, 0..1 — used for pacing insights. */
export function periodElapsed(range: DateRange, now: Date = new Date()): number {
  const total = range.end.getTime() - range.start.getTime();
  if (total <= 0) return 1;
  const done = now.getTime() - range.start.getTime();
  return Math.min(1, Math.max(0, done / total));
}
