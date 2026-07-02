import { describe, it, expect } from "vitest";
import { computeGoalProgress } from "@/lib/goals";

const jan1 = new Date("2026-01-01");
const jun30 = new Date("2026-06-30");

describe("computeGoalProgress — SAVE", () => {
  it("tracks balance growth from the starting snapshot", () => {
    const p = computeGoalProgress({
      type: "SAVE",
      targetAmount: 2000,
      startAmount: 1000,
      currentBalance: 1500,
      periodSpend: null,
      createdAt: jan1,
      deadline: null,
      now: new Date("2026-03-01"),
    });
    expect(p.current).toBe(500);
    expect(p.pct).toBe(25);
    expect(p.status).toBe("on_track");
  });

  it("is achieved when the target is reached", () => {
    const p = computeGoalProgress({
      type: "SAVE",
      targetAmount: 2000,
      startAmount: 0,
      currentBalance: 2100,
      periodSpend: null,
      createdAt: jan1,
      deadline: jun30,
      now: new Date("2026-04-01"),
    });
    expect(p.status).toBe("achieved");
    expect(p.pct).toBe(100);
  });

  it("flags at_risk when far behind the deadline pace", () => {
    // Halfway through the timeline but only 10% saved
    const p = computeGoalProgress({
      type: "SAVE",
      targetAmount: 1000,
      startAmount: 0,
      currentBalance: 100,
      periodSpend: null,
      createdAt: jan1,
      deadline: jun30,
      now: new Date("2026-04-01"),
    });
    expect(p.status).toBe("at_risk");
  });

  it("never reports negative progress when balance dips", () => {
    const p = computeGoalProgress({
      type: "SAVE",
      targetAmount: 1000,
      startAmount: 500,
      currentBalance: 300,
      periodSpend: null,
      createdAt: jan1,
      deadline: null,
      now: new Date("2026-02-01"),
    });
    expect(p.current).toBe(0);
  });
});

describe("computeGoalProgress — SPEND_LIMIT", () => {
  it("is exceeded once spend passes the limit", () => {
    const p = computeGoalProgress({
      type: "SPEND_LIMIT",
      targetAmount: 300,
      startAmount: null,
      currentBalance: null,
      periodSpend: 340,
      createdAt: jan1,
      deadline: null,
      now: new Date("2026-06-20"),
    });
    expect(p.status).toBe("exceeded");
    expect(p.current).toBe(340);
  });

  it("is at_risk when spending outpaces the month", () => {
    // 90% of the budget spent halfway through the month
    const p = computeGoalProgress({
      type: "SPEND_LIMIT",
      targetAmount: 300,
      startAmount: null,
      currentBalance: null,
      periodSpend: 270,
      createdAt: jan1,
      deadline: null,
      now: new Date("2026-06-15"),
    });
    expect(p.status).toBe("at_risk");
  });

  it("is on_track with proportional spending", () => {
    const p = computeGoalProgress({
      type: "SPEND_LIMIT",
      targetAmount: 300,
      startAmount: null,
      currentBalance: null,
      periodSpend: 120,
      createdAt: jan1,
      deadline: null,
      now: new Date("2026-06-15"),
    });
    expect(p.status).toBe("on_track");
  });
});

describe("computeGoalProgress — DEBT_PAYOFF", () => {
  it("measures paydown from the starting balance", () => {
    const p = computeGoalProgress({
      type: "DEBT_PAYOFF",
      targetAmount: 1500,
      startAmount: 1500,
      currentBalance: 900,
      periodSpend: null,
      createdAt: jan1,
      deadline: null,
      now: new Date("2026-03-01"),
    });
    expect(p.current).toBe(600);
    expect(p.pct).toBe(40);
  });

  it("is achieved when the balance is fully paid down", () => {
    const p = computeGoalProgress({
      type: "DEBT_PAYOFF",
      targetAmount: 1500,
      startAmount: 1500,
      currentBalance: 0,
      periodSpend: null,
      createdAt: jan1,
      deadline: null,
      now: new Date("2026-05-01"),
    });
    expect(p.status).toBe("achieved");
  });
});
