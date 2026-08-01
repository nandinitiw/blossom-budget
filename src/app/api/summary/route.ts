import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { monthRange } from "@/lib/dates";
import { getBudgetsWithProgress } from "@/lib/budgets";
import { totalSpend } from "@/lib/spending";

// Read-only current-month summary for external personal dashboards (mosaic).
// Protected by MOSAIC_TOKEN, following the same Bearer pattern as CRON_SECRET.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.MOSAIC_TOKEN || auth !== `Bearer ${process.env.MOSAIC_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) return NextResponse.json({ error: "No user yet" }, { status: 404 });

  const range = monthRange(new Date());
  const inMonth = { gte: range.start, lte: range.end };

  const [spent, incomeAgg, budgets] = await Promise.all([
    totalSpend(user.id, range),
    prisma.transaction.aggregate({
      where: { userId: user.id, date: inMonth, category: { is: { name: "Income" } } },
      _sum: { amount: true },
    }),
    getBudgetsWithProgress(user.id),
  ]);

  const income = Math.abs(Number(incomeAgg._sum.amount ?? 0));

  return NextResponse.json({
    income,
    spent,
    remaining: income - spent,
    categories: budgets.map((b) => ({
      name: b.categoryName,
      spent: b.spent,
      budget: b.amount,
      status: b.status,
    })),
  });
}
