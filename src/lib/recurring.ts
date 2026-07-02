import { normalizeMerchantKey } from "@/lib/merchant";

// Recurring charge detection: group transactions by normalized merchant,
// then look for a regular cadence with similar amounts.

export type RecurringInput = {
  id: string;
  date: Date;
  amount: number; // positive = outflow
  name: string;
  merchantName: string | null;
  logoUrl: string | null;
  categoryName?: string | null;
};

export type Frequency = "weekly" | "biweekly" | "monthly" | "yearly";

export type RecurringCharge = {
  merchantKey: string;
  displayName: string;
  logoUrl: string | null;
  categoryName: string | null;
  frequency: Frequency;
  occurrences: number;
  averageAmount: number;
  lastAmount: number;
  previousAmount: number;
  priceChanged: boolean; // latest charge differs meaningfully from the prior one
  lastDate: Date;
  nextExpectedDate: Date;
  monthlyCost: number; // normalized to a monthly figure
};

const FREQUENCY_WINDOWS: { freq: Frequency; min: number; max: number; days: number }[] = [
  { freq: "weekly", min: 5, max: 9, days: 7 },
  { freq: "biweekly", min: 12, max: 16, days: 14 },
  { freq: "monthly", min: 26, max: 35, days: 30 },
  { freq: "yearly", min: 350, max: 380, days: 365 },
];

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Amounts are "similar" within 20% of the median or $3, whichever is looser. */
function amountsSimilar(amounts: number[]): boolean {
  const med = median(amounts);
  const tolerance = Math.max(3, med * 0.2);
  return amounts.every((a) => Math.abs(a - med) <= tolerance);
}

/** A price change is a >2% and >$0.50 difference between the last two charges. */
export function isPriceChange(previous: number, latest: number): boolean {
  const diff = Math.abs(latest - previous);
  return diff > 0.5 && diff / previous > 0.02;
}

export function detectRecurring(
  transactions: RecurringInput[],
  now: Date = new Date()
): RecurringCharge[] {
  const spend = transactions.filter((t) => t.amount > 0);
  const byMerchant = new Map<string, RecurringInput[]>();
  for (const tx of spend) {
    const key = normalizeMerchantKey(tx.merchantName ?? tx.name);
    if (!key) continue;
    const list = byMerchant.get(key) ?? [];
    list.push(tx);
    byMerchant.set(key, list);
  }

  const results: RecurringCharge[] = [];

  for (const [key, txs] of byMerchant) {
    if (txs.length < 2) continue;
    const sorted = [...txs].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Collapse same-day duplicates (split charges)
    const collapsed: RecurringInput[] = [];
    for (const tx of sorted) {
      const last = collapsed[collapsed.length - 1];
      if (last && tx.date.toDateString() === last.date.toDateString()) continue;
      collapsed.push(tx);
    }
    if (collapsed.length < 2) continue;

    const intervals: number[] = [];
    for (let i = 1; i < collapsed.length; i++) {
      intervals.push(
        (collapsed[i].date.getTime() - collapsed[i - 1].date.getTime()) / 86_400_000
      );
    }
    const med = median(intervals);
    const window = FREQUENCY_WINDOWS.find((w) => med >= w.min && med <= w.max);
    if (!window) continue;

    // Yearly needs 2+ occurrences; everything else 3+
    const minOccurrences = window.freq === "yearly" ? 2 : 3;
    if (collapsed.length < minOccurrences) continue;

    // Most intervals must fall in the window (tolerate one skip)
    const inWindow = intervals.filter((i) => i >= window.min && i <= window.max);
    if (inWindow.length < intervals.length - 1) continue;

    const amounts = collapsed.map((t) => t.amount);
    if (!amountsSimilar(amounts)) continue;

    // Still active? Last charge should be within ~1.7 cycles
    const last = collapsed[collapsed.length - 1];
    const daysSince = (now.getTime() - last.date.getTime()) / 86_400_000;
    if (daysSince > window.days * 1.7) continue;

    const lastAmount = amounts[amounts.length - 1];
    const previousAmount = amounts[amounts.length - 2];
    const averageAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;

    results.push({
      merchantKey: key,
      displayName: last.merchantName ?? last.name,
      logoUrl: last.logoUrl,
      categoryName: last.categoryName ?? null,
      frequency: window.freq,
      occurrences: collapsed.length,
      averageAmount: Math.round(averageAmount * 100) / 100,
      lastAmount,
      previousAmount,
      priceChanged: isPriceChange(previousAmount, lastAmount),
      lastDate: last.date,
      nextExpectedDate: new Date(last.date.getTime() + window.days * 86_400_000),
      monthlyCost:
        Math.round(((averageAmount * 30.44) / window.days) * 100) / 100,
    });
  }

  return results.sort((a, b) => b.monthlyCost - a.monthlyCost);
}
