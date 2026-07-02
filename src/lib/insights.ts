import { prisma } from "@/lib/prisma";
import { monthRange, prevMonthRange, periodElapsed } from "@/lib/dates";
import { spendingByCategory, totalSpend } from "@/lib/spending";
import { money } from "@/lib/format";

// Personalized insights computed from the user's own transaction history —
// no generic advice. Pure comparisons of their actual numbers.

export async function generateInsights(userId: string): Promise<string[]> {
  const insights: string[] = [];
  const now = new Date();
  const thisM = monthRange(now);
  const lastM = prevMonthRange(now);
  const elapsed = periodElapsed(thisM, now);

  const [curCats, prevCats, curTotal, prevTotal] = await Promise.all([
    spendingByCategory(userId, thisM),
    spendingByCategory(userId, lastM),
    totalSpend(userId, thisM),
    totalSpend(userId, lastM),
  ]);

  if (curTotal === 0 && prevTotal === 0) return insights;

  // 1. Biggest category mover vs the same point is hard without daily data;
  //    compare against last month prorated by elapsed fraction of this month.
  const prevByName = new Map(prevCats.map((c) => [c.name, c.amount]));
  let bestMove: { name: string; deltaPct: number; up: boolean } | null = null;
  for (const c of curCats) {
    const prev = (prevByName.get(c.name) ?? 0) * elapsed;
    if (prev < 25 && c.amount < 25) continue; // ignore noise
    if (prev === 0) continue;
    const deltaPct = Math.round(((c.amount - prev) / prev) * 100);
    if (Math.abs(deltaPct) >= 20 && Math.abs(c.amount - prev) >= 25) {
      if (!bestMove || Math.abs(deltaPct) > Math.abs(bestMove.deltaPct)) {
        bestMove = { name: c.name, deltaPct: Math.abs(deltaPct), up: deltaPct > 0 };
      }
    }
  }
  if (bestMove) {
    insights.push(
      bestMove.up
        ? `Your ${bestMove.name} spending is ${bestMove.deltaPct}% higher than this time last month.`
        : `Nice — ${bestMove.name} spending is ${bestMove.deltaPct}% lower than this time last month.`
    );
  }

  // 2. Month pacing projection
  if (elapsed > 0.2 && prevTotal > 0 && curTotal > 0) {
    const projected = curTotal / elapsed;
    const diffPct = Math.round(((projected - prevTotal) / prevTotal) * 100);
    if (diffPct >= 15) {
      insights.push(
        `At this pace you'll spend about ${money(projected, { whole: true })} this month — ${diffPct}% more than last month's ${money(prevTotal, { whole: true })}.`
      );
    } else if (diffPct <= -15) {
      insights.push(
        `You're on track to spend about ${money(projected, { whole: true })} this month, ${Math.abs(diffPct)}% less than last month.`
      );
    }
  }

  // 3. Goal pacing (savings goals with a deadline)
  const goals = await prisma.goal.findMany({
    where: { userId, archived: false, type: "SAVE", deadline: { not: null } },
  });
  for (const goal of goals.slice(0, 2)) {
    if (!goal.accountId || !goal.deadline) continue;
    const account = await prisma.account.findFirst({
      where: { id: goal.accountId, userId },
    });
    if (!account) continue;
    const saved = Number(account.currentBalance) - Number(goal.startAmount ?? 0);
    const target = Number(goal.targetAmount);
    if (saved <= 0 || target <= 0) continue;
    const totalDays =
      (goal.deadline.getTime() - goal.createdAt.getTime()) / 86_400_000;
    const elapsedDays = (now.getTime() - goal.createdAt.getTime()) / 86_400_000;
    if (totalDays <= 0 || elapsedDays <= 3) continue;
    const projectedDays = elapsedDays * (target / saved);
    const deltaDays = Math.round(totalDays - projectedDays);
    if (deltaDays >= 7) {
      insights.push(
        `You're on track to hit "${goal.name}" about ${Math.round(deltaDays / 7)} week${deltaDays >= 14 ? "s" : ""} early. 🎉`
      );
    } else if (deltaDays <= -7) {
      insights.push(
        `"${goal.name}" is falling behind — at the current pace you'd finish about ${Math.round(-deltaDays / 7)} week${deltaDays <= -14 ? "s" : ""} late.`
      );
    }
  }

  return insights.slice(0, 3);
}
