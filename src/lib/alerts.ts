import { prisma } from "@/lib/prisma";
import { getBudgetsWithProgress } from "@/lib/budgets";
import { getGoalsWithProgress } from "@/lib/goals";
import { monthKey, weekKey } from "@/lib/dates";
import { money } from "@/lib/format";

async function upsertAlert(
  userId: string,
  type:
    | "BUDGET_WARNING"
    | "BUDGET_EXCEEDED"
    | "GOAL_AT_RISK"
    | "GOAL_ACHIEVED"
    | "RECURRING_PRICE_CHANGE",
  dedupeKey: string,
  message: string
) {
  await prisma.alert.upsert({
    where: { userId_dedupeKey: { userId, dedupeKey } },
    update: {}, // don't resurface dismissed alerts for the same key
    create: { userId, type, dedupeKey, message },
  });
}

/**
 * Evaluate budget & goal thresholds and create in-app alerts.
 * Dedupe keys include the period so alerts re-fire each new week/month,
 * but never twice within one.
 */
export async function evaluateAlerts(userId: string): Promise<void> {
  const now = new Date();
  const [budgets, goals] = await Promise.all([
    getBudgetsWithProgress(userId, now),
    getGoalsWithProgress(userId),
  ]);

  for (const b of budgets) {
    const period = b.period === "WEEKLY" ? weekKey(now) : monthKey(now);
    if (b.status === "exceeded") {
      await upsertAlert(
        userId,
        "BUDGET_EXCEEDED",
        `budget:${b.id}:${period}:100`,
        `You've gone over your ${b.categoryName} budget — ${money(b.spent)} of ${money(b.amount)} (${b.pct}%).`
      );
    } else if (b.status === "warning") {
      await upsertAlert(
        userId,
        "BUDGET_WARNING",
        `budget:${b.id}:${period}:80`,
        `Heads up: you've used ${b.pct}% of your ${b.categoryName} budget (${money(b.spent)} of ${money(b.amount)}).`
      );
    }
  }

  // Recurring price increases (e.g. a subscription hike)
  const { detectRecurring } = await import("@/lib/recurring");
  const { subMonths } = await import("date-fns");
  const txs = await prisma.transaction.findMany({
    where: { userId, date: { gte: subMonths(now, 13) }, amount: { gt: 0 } },
    orderBy: { date: "asc" },
  });
  const recurring = detectRecurring(
    txs.map((t) => ({
      id: t.id,
      date: t.date,
      amount: Number(t.amount),
      name: t.name,
      merchantName: t.merchantName,
      logoUrl: t.logoUrl,
    })),
    now
  );
  for (const r of recurring.filter((x) => x.priceChanged)) {
    await upsertAlert(
      userId,
      "RECURRING_PRICE_CHANGE",
      `recurring:${r.merchantKey}:${r.lastAmount.toFixed(2)}`,
      `${r.displayName} charged ${money(r.lastAmount)} — it was ${money(r.previousAmount)} last time.`
    );
  }

  for (const g of goals) {
    const period = monthKey(now);
    if (g.progress.status === "achieved") {
      await upsertAlert(
        userId,
        "GOAL_ACHIEVED",
        `goal:${g.id}:achieved`,
        `🎉 Goal reached: "${g.name}" — ${money(g.progress.current)} of ${money(g.progress.target)}.`
      );
    } else if (g.progress.status === "exceeded") {
      await upsertAlert(
        userId,
        "GOAL_AT_RISK",
        `goal:${g.id}:${period}:exceeded`,
        `"${g.name}" is over its limit — ${money(g.progress.current)} against ${money(g.progress.target)}.`
      );
    } else if (g.progress.status === "at_risk") {
      await upsertAlert(
        userId,
        "GOAL_AT_RISK",
        `goal:${g.id}:${period}:risk`,
        `"${g.name}" is at risk — you're at ${g.progress.pct}% with the clock running.`
      );
    }
  }
}
