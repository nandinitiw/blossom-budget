import { describe, it, expect } from "vitest";
import { monthKey, weekKey, periodElapsed, monthRange, weekRange } from "@/lib/dates";

describe("period keys (EmailLog idempotency)", () => {
  // Local-time constructors avoid UTC-midnight parsing shifting the day
  it("monthKey formats as yyyy-MM", () => {
    expect(monthKey(new Date(2026, 5, 15))).toBe("2026-06");
  });

  it("weekKey uses ISO weeks with zero padding", () => {
    expect(weekKey(new Date(2026, 0, 7))).toMatch(/^2026-W\d{2}$/);
  });

  it("weekKey is stable across days of the same week", () => {
    expect(weekKey(new Date(2026, 5, 15))).toBe(weekKey(new Date(2026, 5, 19))); // Mon vs Fri
  });
});

describe("ranges", () => {
  it("monthRange spans the whole month", () => {
    const r = monthRange(new Date(2026, 5, 15));
    expect(r.start.getDate()).toBe(1);
    expect(r.end.getDate()).toBe(30);
  });

  it("weekRange starts on Monday", () => {
    const r = weekRange(new Date(2026, 5, 17)); // a Wednesday
    expect(r.start.getDay()).toBe(1);
  });
});

describe("periodElapsed", () => {
  it("returns ~0.5 mid-period", () => {
    const range = {
      start: new Date("2026-06-01T00:00:00"),
      end: new Date("2026-06-30T23:59:59"),
    };
    const v = periodElapsed(range, new Date("2026-06-16T00:00:00"));
    expect(v).toBeGreaterThan(0.45);
    expect(v).toBeLessThan(0.55);
  });

  it("clamps to [0, 1]", () => {
    const range = { start: new Date("2026-06-01"), end: new Date("2026-06-30") };
    expect(periodElapsed(range, new Date("2026-05-01"))).toBe(0);
    expect(periodElapsed(range, new Date("2026-08-01"))).toBe(1);
  });
});
