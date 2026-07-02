import { describe, it, expect } from "vitest";
import { detectRecurring, isPriceChange, type RecurringInput } from "@/lib/recurring";

const now = new Date("2026-06-15");

function tx(date: string, amount: number, name: string, id = ""): RecurringInput {
  return {
    id: id || `${name}-${date}`,
    date: new Date(date),
    amount,
    name,
    merchantName: name,
    logoUrl: null,
  };
}

describe("detectRecurring", () => {
  it("finds a monthly subscription", () => {
    const result = detectRecurring(
      [
        tx("2026-03-05", 15.99, "Netflix"),
        tx("2026-04-05", 15.99, "Netflix"),
        tx("2026-05-05", 15.99, "Netflix"),
        tx("2026-06-05", 15.99, "Netflix"),
      ],
      now
    );
    expect(result).toHaveLength(1);
    expect(result[0].frequency).toBe("monthly");
    expect(result[0].monthlyCost).toBeCloseTo(16.22, 0); // ~15.99 normalized by 30.44/30
    expect(result[0].priceChanged).toBe(false);
  });

  it("flags a subscription price increase", () => {
    const result = detectRecurring(
      [
        tx("2026-03-10", 9.99, "Spotify"),
        tx("2026-04-10", 9.99, "Spotify"),
        tx("2026-05-10", 9.99, "Spotify"),
        tx("2026-06-10", 11.99, "Spotify"),
      ],
      now
    );
    expect(result).toHaveLength(1);
    expect(result[0].priceChanged).toBe(true);
    expect(result[0].lastAmount).toBe(11.99);
    expect(result[0].previousAmount).toBe(9.99);
  });

  it("detects weekly cadence", () => {
    const result = detectRecurring(
      [
        tx("2026-05-18", 12.5, "F45 Training"),
        tx("2026-05-25", 12.5, "F45 Training"),
        tx("2026-06-01", 12.5, "F45 Training"),
        tx("2026-06-08", 12.5, "F45 Training"),
      ],
      now
    );
    expect(result).toHaveLength(1);
    expect(result[0].frequency).toBe("weekly");
  });

  it("ignores merchants with irregular timing", () => {
    const result = detectRecurring(
      [
        tx("2026-01-03", 42.1, "Corner Cafe"),
        tx("2026-02-20", 12.75, "Corner Cafe"),
        tx("2026-03-02", 33.4, "Corner Cafe"),
        tx("2026-05-28", 8.9, "Corner Cafe"),
      ],
      now
    );
    expect(result).toHaveLength(0);
  });

  it("ignores merchants with wildly varying amounts", () => {
    const result = detectRecurring(
      [
        tx("2026-03-01", 20, "Grocer"),
        tx("2026-04-01", 95, "Grocer"),
        tx("2026-05-01", 260, "Grocer"),
        tx("2026-06-01", 40, "Grocer"),
      ],
      now
    );
    expect(result).toHaveLength(0);
  });

  it("drops recurring charges that have gone inactive", () => {
    const result = detectRecurring(
      [
        tx("2025-09-01", 15.99, "Old Sub"),
        tx("2025-10-01", 15.99, "Old Sub"),
        tx("2025-11-01", 15.99, "Old Sub"),
      ],
      now // last charge >1.7 cycles ago
    );
    expect(result).toHaveLength(0);
  });

  it("groups descriptor variants of the same merchant", () => {
    const result = detectRecurring(
      [
        tx("2026-03-12", 7.99, "SQ *RALPHS YOGA #12"),
        tx("2026-04-12", 7.99, "SQ *RALPHS YOGA #12"),
        tx("2026-05-12", 7.99, "Ralphs Yoga"),
        tx("2026-06-12", 7.99, "Ralphs Yoga"),
      ],
      now
    );
    expect(result).toHaveLength(1);
    expect(result[0].occurrences).toBe(4);
  });

  it("computes the next expected date one cycle after the last charge", () => {
    const result = detectRecurring(
      [
        tx("2026-03-05", 15.99, "Netflix"),
        tx("2026-04-05", 15.99, "Netflix"),
        tx("2026-05-05", 15.99, "Netflix"),
        tx("2026-06-05", 15.99, "Netflix"),
      ],
      now
    );
    expect(result[0].nextExpectedDate.toISOString().slice(0, 10)).toBe("2026-07-05");
  });
});

describe("isPriceChange", () => {
  it("requires both >2% and >$0.50 movement", () => {
    expect(isPriceChange(9.99, 11.99)).toBe(true);
    expect(isPriceChange(9.99, 10.09)).toBe(false); // only 1%
    expect(isPriceChange(10.0, 10.4)).toBe(false); // 4% but under $0.50
    expect(isPriceChange(100, 103)).toBe(true);
  });
});
