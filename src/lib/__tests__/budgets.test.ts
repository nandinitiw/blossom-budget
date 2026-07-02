import { describe, it, expect } from "vitest";
import { computeBudgetStatus } from "@/lib/budgets";

describe("computeBudgetStatus", () => {
  it("is under below 80%", () => {
    expect(computeBudgetStatus(79, 100)).toEqual({ pct: 79, status: "under" });
    expect(computeBudgetStatus(0, 100)).toEqual({ pct: 0, status: "under" });
  });

  it("warns at exactly 80%", () => {
    expect(computeBudgetStatus(80, 100)).toEqual({ pct: 80, status: "warning" });
  });

  it("warns between 80% and 100%", () => {
    expect(computeBudgetStatus(99.5, 100).status).toBe("warning");
  });

  it("exceeds at exactly 100%", () => {
    expect(computeBudgetStatus(100, 100)).toEqual({ pct: 100, status: "exceeded" });
  });

  it("reports over-100 percentages when blown through", () => {
    expect(computeBudgetStatus(250, 100)).toEqual({ pct: 250, status: "exceeded" });
  });

  it("treats a zero/invalid limit as under", () => {
    expect(computeBudgetStatus(50, 0)).toEqual({ pct: 0, status: "under" });
  });
});
