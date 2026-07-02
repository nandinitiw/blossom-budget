import { prisma } from "@/lib/prisma";
import { monthRange, weekRange, type DateRange } from "@/lib/dates";
import type { BudgetPeriod } from "@prisma/client";

export type BudgetStatus = "under" | "warning" | "exceeded";

/** Pure: classify budget usage. Warning kicks in at 80%. */
export function computeBudgetStatus(
  spent: number,
  limit: number
): { pct: number; status: BudgetStatus } {
  if (limit <= 0) return { pct: 0, status: "under" };
  const ratio = spent / limit;
  const pct = Math.round(ratio * 100);
  if (ratio >= 1) return { pct, status: "exceeded" };
  if (ratio >= 0.8) return { pct, status: "warning" };
  return { pct, status: "under" };
}

export function budgetRange(period: BudgetPeriod, now: Date = new Date()): DateRange {
  return period === "WEEKLY" ? weekRange(now) : monthRange(now);
}

export type BudgetWithProgress = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  amount: number;
  period: BudgetPeriod;
  spent: number;
  pct: number;
  status: BudgetStatus;
};

export async function getBudgetsWithProgress(
  userId: string,
  now: Date = new Date()
): Promise<BudgetWithProgress[]> {
  const budgets = await prisma.budget.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { category: { name: "asc" } },
  });
  if (budgets.length === 0) return [];

  const results: BudgetWithProgress[] = [];
  for (const b of budgets) {
    const range = budgetRange(b.period, now);
    const agg = await prisma.transaction.aggregate({
      where: {
        userId,
        categoryId: b.categoryId,
        date: { gte: range.start, lte: range.end },
        amount: { gt: 0 },
      },
      _sum: { amount: true },
    });
    const spent = Number(agg._sum.amount ?? 0);
    const limit = Number(b.amount);
    const { pct, status } = computeBudgetStatus(spent, limit);
    results.push({
      id: b.id,
      categoryId: b.categoryId,
      categoryName: b.category.name,
      categoryColor: b.category.color,
      categoryIcon: b.category.icon,
      amount: limit,
      period: b.period,
      spent,
      pct,
      status,
    });
  }
  return results;
}
