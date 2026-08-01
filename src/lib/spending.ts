import { prisma } from "@/lib/prisma";
import type { DateRange } from "@/lib/dates";

// Spending is computed NET per category: money out (Plaid positive) minus money
// in (negative) within the same category. So a reimbursement categorized into
// the same category as the original purchase cancels it out. Each category's net
// is floored at 0 so an over-reimbursed category can't create phantom negative
// spending that offsets other categories. The Income category is excluded
// entirely (paychecks are income, not negative spending).

export type CategorySpend = {
  categoryId: string | null;
  name: string;
  color: string;
  icon: string;
  amount: number;
};

export async function totalSpend(userId: string, range: DateRange): Promise<number> {
  const grouped = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId,
      date: { gte: range.start, lte: range.end },
      category: { isNot: { name: "Income" } },
    },
    _sum: { amount: true },
  });
  return grouped.reduce(
    (s, g) => s + Math.max(0, Number(g._sum.amount ?? 0)),
    0
  );
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
        amount: Math.max(0, Number(g._sum.amount ?? 0)),
      };
    })
    // Drop Income and any category fully cancelled out by reimbursements
    .filter((c) => c.name !== "Income" && c.amount > 0)
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

/** Net spend for a single category within a range (out minus in), floored at 0. */
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
    },
    _sum: { amount: true },
  });
  return Math.max(0, Number(agg._sum.amount ?? 0));
}
