import { prisma } from "@/lib/prisma";
import type { DateRange } from "@/lib/dates";

// Spending = positive amounts (Plaid: positive = outflow), excluding the
// Income category so refunds/paychecks don't pollute spend figures.

export type CategorySpend = {
  categoryId: string | null;
  name: string;
  color: string;
  icon: string;
  amount: number;
};

export async function totalSpend(userId: string, range: DateRange): Promise<number> {
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: range.start, lte: range.end },
      amount: { gt: 0 },
      category: { isNot: { name: "Income" } },
    },
    select: { amount: true },
  });
  return rows.reduce((s, r) => s + Number(r.amount), 0);
}

export async function spendingByCategory(
  userId: string,
  range: DateRange
): Promise<CategorySpend[]> {
  const grouped = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId,
      date: { gte: range.start, lte: range.end },
      amount: { gt: 0 },
    },
    _sum: { amount: true },
  });
  const categories = await prisma.category.findMany({ where: { userId } });
  const byId = new Map(categories.map((c) => [c.id, c]));

  return grouped
    .map((g) => {
      const cat = g.categoryId ? byId.get(g.categoryId) : undefined;
      return {
        categoryId: g.categoryId,
        name: cat?.name ?? "Uncategorized",
        color: cat?.color ?? "#8B8494",
        icon: cat?.icon ?? "tag",
        amount: Number(g._sum.amount ?? 0),
      };
    })
    .filter((c) => c.name !== "Income")
    .sort((a, b) => b.amount - a.amount);
}

export type BalanceSummary = {
  cash: number; // depository + investment
  creditDebt: number; // credit card balances (owed)
  net: number;
};

export async function balanceSummary(userId: string): Promise<BalanceSummary> {
  const accounts = await prisma.account.findMany({
    where: { userId, hidden: false },
    select: { type: true, currentBalance: true },
  });
  let cash = 0,
    creditDebt = 0;
  for (const a of accounts) {
    const bal = Number(a.currentBalance);
    if (a.type === "credit" || a.type === "loan") creditDebt += bal;
    else cash += bal;
  }
  return { cash, creditDebt, net: cash - creditDebt };
}

/** Spend for a single category within a range (budget progress). */
export async function categorySpend(
  userId: string,
  categoryId: string,
  range: DateRange
): Promise<number> {
  const agg = await prisma.transaction.aggregate({
    where: {
      userId,
      categoryId,
      date: { gte: range.start, lte: range.end },
      amount: { gt: 0 },
    },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
}
