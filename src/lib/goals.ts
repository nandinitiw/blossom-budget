import { prisma } from "@/lib/prisma";
import { monthRange, periodElapsed } from "@/lib/dates";
import type { Goal, GoalType } from "@prisma/client";

export type GoalStatus = "on_track" | "at_risk" | "exceeded" | "achieved";

export type GoalProgress = {
  current: number; // progress toward target (saved / spent / paid off)
  target: number;
  pct: number;
  status: GoalStatus;
};

/**
 * Pure progress/status computation, testable without a DB.
 * - SAVE: current = balance delta since goal creation; at risk when pacing
 *   against the deadline falls behind.
 * - SPEND_LIMIT: current = spend this period; exceeded past target, at risk
 *   when spend is outpacing the elapsed fraction of the period.
 * - DEBT_PAYOFF: current = amount paid off since creation (start − balance).
 */
export function computeGoalProgress(input: {
  type: GoalType;
  targetAmount: number;
  startAmount: number | null;
  currentBalance: number | null; // linked account balance (SAVE / DEBT_PAYOFF)
  periodSpend: number | null; // category spend this period (SPEND_LIMIT)
  createdAt: Date;
  deadline: Date | null;
  now?: Date;
}): GoalProgress {
  const now = input.now ?? new Date();
  const target = input.targetAmount;

  if (input.type === "SPEND_LIMIT") {
    const spent = input.periodSpend ?? 0;
    const pct = target > 0 ? Math.round((spent / target) * 100) : 0;
    let status: GoalStatus = "on_track";
    if (spent >= target && target > 0) status = "exceeded";
    else {
      const elapsed = periodElapsed(monthRange(now), now);
      if (elapsed > 0.15 && spent / target > elapsed + 0.1) status = "at_risk";
    }
    return { current: spent, target, pct: Math.min(999, pct), status };
  }

  // SAVE / DEBT_PAYOFF
  const start = input.startAmount ?? 0;
  const balance = input.currentBalance ?? start;
  const current =
    input.type === "SAVE"
      ? Math.max(0, balance - start)
      : Math.max(0, start - balance);
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  let status: GoalStatus = "on_track";
  if (current >= target && target > 0) status = "achieved";
  else if (input.deadline) {
    const total = input.deadline.getTime() - input.createdAt.getTime();
    const elapsed = now.getTime() - input.createdAt.getTime();
    if (total > 0 && elapsed / total > 0.15) {
      const expected = (elapsed / total) * target;
      if (current < expected * 0.75) status = "at_risk";
    }
    if (now > input.deadline && current < target) status = "at_risk";
  }
  return { current, target, pct, status };
}

export type GoalWithProgress = Goal & {
  progress: GoalProgress;
  categoryName?: string | null;
  accountName?: string | null;
};

export async function getGoalsWithProgress(
  userId: string
): Promise<GoalWithProgress[]> {
  const goals = await prisma.goal.findMany({
    where: { userId, archived: false },
    include: { category: true },
    orderBy: { createdAt: "asc" },
  });
  const range = monthRange();

  const results: GoalWithProgress[] = [];
  for (const goal of goals) {
    let currentBalance: number | null = null;
    let accountName: string | null = null;
    let periodSpend: number | null = null;

    if (goal.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: goal.accountId, userId },
      });
      currentBalance = account ? Number(account.currentBalance) : null;
      accountName = account?.name ?? null;
    }
    if (goal.type === "SPEND_LIMIT" && goal.categoryId) {
      const agg = await prisma.transaction.aggregate({
        where: {
          userId,
          categoryId: goal.categoryId,
          date: { gte: range.start, lte: range.end },
          amount: { gt: 0 },
        },
        _sum: { amount: true },
      });
      periodSpend = Number(agg._sum.amount ?? 0);
    }

    results.push({
      ...goal,
      progress: computeGoalProgress({
        type: goal.type,
        targetAmount: Number(goal.targetAmount),
        startAmount: goal.startAmount ? Number(goal.startAmount) : null,
        currentBalance,
        periodSpend,
        createdAt: goal.createdAt,
        deadline: goal.deadline,
      }),
      categoryName: goal.category?.name,
      accountName,
    });
  }
  return results;
}
