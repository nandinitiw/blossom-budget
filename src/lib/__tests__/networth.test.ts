import { describe, it, expect } from "vitest";
import { computeNetWorth } from "@/lib/networth";

describe("computeNetWorth", () => {
  it("adds depository accounts as assets and credit as liabilities", () => {
    const nw = computeNetWorth(
      [
        { type: "depository", currentBalance: 5000 },
        { type: "depository", currentBalance: 12000 },
        { type: "credit", currentBalance: 1500 },
      ],
      []
    );
    expect(nw.assets).toBe(17000);
    expect(nw.liabilities).toBe(1500);
    expect(nw.netWorth).toBe(15500);
  });

  it("includes manual assets and liabilities", () => {
    const nw = computeNetWorth(
      [{ type: "depository", currentBalance: 1000 }],
      [
        { type: "ASSET", balance: 25000 }, // brokerage
        { type: "LIABILITY", balance: 8000 }, // car loan
      ]
    );
    expect(nw.assets).toBe(26000);
    expect(nw.liabilities).toBe(8000);
    expect(nw.netWorth).toBe(18000);
  });

  it("treats loans as liabilities and investments as assets", () => {
    const nw = computeNetWorth(
      [
        { type: "investment", currentBalance: 30000 },
        { type: "loan", currentBalance: 20000 },
      ],
      []
    );
    expect(nw.netWorth).toBe(10000);
  });

  it("handles a negative net worth", () => {
    const nw = computeNetWorth(
      [
        { type: "depository", currentBalance: 500 },
        { type: "credit", currentBalance: 4000 },
      ],
      []
    );
    expect(nw.netWorth).toBe(-3500);
  });

  it("rounds to cents", () => {
    const nw = computeNetWorth(
      [{ type: "depository", currentBalance: 10.111 }],
      [{ type: "ASSET", balance: 0.115 }]
    );
    expect(nw.assets).toBe(10.23);
  });
});
