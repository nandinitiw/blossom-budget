import { prisma } from "@/lib/prisma";
import {
  monthRange,
  prevMonthRange,
  weekRange,
  prevWeekRange,
  monthKey,
  weekKey,
} from "@/lib/dates";
import { totalSpend, spendingByCategory, type CategorySpend } from "@/lib/spending";
import { getBudgetsWithProgress, type BudgetWithProgress } from "@/lib/budgets";
import { getGoalsWithProgress } from "@/lib/goals";
import { money } from "@/lib/format";
import { sendEmail } from "@/lib/email";
import { subWeeks, subMonths, format } from "date-fns";

export type ReportPeriod = "weekly" | "monthly";

type ReportData = {
  periodLabel: string;
  total: number;
  prevTotal: number;
  byCategory: (CategorySpend & { prevAmount: number })[];
  overBudgets: BudgetWithProgress[];
  goals: { name: string; pct: number; status: string; current: number; target: number }[];
};

export async function buildReportData(
  userId: string,
  period: ReportPeriod,
  now: Date = new Date()
): Promise<ReportData> {
  // Report covers the *completed* period (last week / last month)
  const range = period === "weekly" ? prevWeekRange(now) : prevMonthRange(now);
  const prevRange =
    period === "weekly" ? weekRange(subWeeks(now, 2)) : monthRange(subMonths(now, 2));

  const [total, prevTotal, byCat, prevByCat, budgets, goals] = await Promise.all([
    totalSpend(userId, range),
    totalSpend(userId, prevRange),
    spendingByCategory(userId, range),
    spendingByCategory(userId, prevRange),
    getBudgetsWithProgress(userId, range.start),
    getGoalsWithProgress(userId),
  ]);

  const prevMap = new Map(prevByCat.map((c) => [c.name, c.amount]));

  return {
    periodLabel:
      period === "weekly"
        ? `Week of ${format(range.start, "MMM d")}–${format(range.end, "MMM d, yyyy")}`
        : format(range.start, "MMMM yyyy"),
    total,
    prevTotal,
    byCategory: byCat.map((c) => ({ ...c, prevAmount: prevMap.get(c.name) ?? 0 })),
    overBudgets: budgets.filter((b) => b.status !== "under"),
    goals: goals.map((g) => ({
      name: g.name,
      pct: g.progress.pct,
      status: g.progress.status,
      current: g.progress.current,
      target: g.progress.target,
    })),
  };
}

export function renderReportHtml(data: ReportData): string {
  const deltaPct =
    data.prevTotal > 0
      ? Math.round(((data.total - data.prevTotal) / data.prevTotal) * 100)
      : null;

  const catRows = data.byCategory
    .slice(0, 10)
    .map((c) => {
      const arrow =
        c.prevAmount > 0
          ? c.amount > c.prevAmount * 1.05
            ? ` <span style="color:#C23B3B">▲</span>`
            : c.amount < c.prevAmount * 0.95
              ? ` <span style="color:#3D8A5F">▼</span>`
              : ""
          : "";
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #EEEDFE">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.color};margin-right:8px"></span>${c.name}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #EEEDFE;text-align:right;font-weight:600">${money(c.amount)}${arrow}</td>
        <td style="padding:8px 0;border-bottom:1px solid #EEEDFE;text-align:right;color:#6E6879;font-size:12px">${c.prevAmount > 0 ? `prev ${money(c.prevAmount)}` : "new"}</td>
      </tr>`;
    })
    .join("");

  const overRows =
    data.overBudgets.length > 0
      ? `<div style="background:#F4C0D1;border-radius:12px;padding:14px 16px;margin:20px 0">
          <p style="margin:0;font-weight:600;color:#B23A63">Budget alerts</p>
          ${data.overBudgets
            .map(
              (b) =>
                `<p style="margin:6px 0 0;color:#1F1B24;font-size:14px">${b.categoryName}: ${money(b.spent)} of ${money(b.amount)} (${b.pct}%)</p>`
            )
            .join("")}
        </div>`
      : "";

  const goalRows =
    data.goals.length > 0
      ? `<h3 style="color:#5F57BD;margin:24px 0 8px">Goals</h3>` +
        data.goals
          .map((g) => {
            const barPct = Math.min(100, g.pct);
            const barColor =
              g.status === "exceeded" ? "#C23B3B" : g.status === "at_risk" ? "#D4537E" : "#7F77DD";
            return `<div style="margin-bottom:12px">
              <p style="margin:0 0 4px;font-size:14px"><strong>${g.name}</strong> — ${money(g.current)} of ${money(g.target)}</p>
              <div style="background:#EEEDFE;border-radius:6px;height:8px;overflow:hidden">
                <div style="background:${barColor};height:8px;width:${barPct}%"></div>
              </div>
            </div>`;
          })
          .join("")
      : "";

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;color:#1F1B24;background:#FAF9FB">
    <p style="font-size:24px;margin:0">🌸</p>
    <h1 style="color:#D4537E;font-size:20px;margin:4px 0 2px">Your spending summary</h1>
    <p style="color:#6E6879;margin:0 0 20px;font-size:14px">${data.periodLabel}</p>

    <div style="background:#fff;border:1px solid #EEEDFE;border-radius:16px;padding:20px">
      <p style="margin:0;color:#6E6879;font-size:13px">Total spent</p>
      <p style="margin:2px 0 0;font-size:28px;font-weight:700;color:#D4537E">${money(data.total)}</p>
      ${
        deltaPct !== null
          ? `<p style="margin:6px 0 0;font-size:13px;color:#6E6879">${
              deltaPct > 0
                ? `<span style="color:#C23B3B;font-weight:600">▲ ${deltaPct}%</span>`
                : `<span style="color:#3D8A5F;font-weight:600">▼ ${Math.abs(deltaPct)}%</span>`
            } vs the period before (${money(data.prevTotal)})</p>`
          : ""
      }
    </div>

    ${overRows}

    <h3 style="color:#5F57BD;margin:24px 0 8px">By category</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${catRows}</table>

    ${goalRows}

    <p style="margin:28px 0 0;font-size:12px;color:#6E6879">
      You're receiving this because email reports are enabled in your
      <a href="${process.env.APP_URL ?? ""}/settings" style="color:#7F77DD">Blossom Budget settings</a>.
    </p>
  </div>`;
}

/**
 * Send due reports. Weekly reports go out on Mondays, monthly on the 1st —
 * the cron hits daily and this decides who is due. EmailLog's unique
 * (user, type, periodKey) makes re-runs no-ops.
 */
export async function sendScheduledEmails(now: Date = new Date()): Promise<{
  sent: number;
  skipped: number;
}> {
  const isMonday = now.getUTCDay() === 1;
  const isFirstOfMonth = now.getUTCDate() === 1;
  let sent = 0,
    skipped = 0;

  const users = await prisma.user.findMany({
    where: {
      OR: [
        ...(isMonday ? [{ emailWeekly: true }] : []),
        ...(isFirstOfMonth ? [{ emailMonthly: true }] : []),
      ],
    },
  });

  for (const user of users) {
    const jobs: { type: "WEEKLY_SUMMARY" | "MONTHLY_SUMMARY"; period: ReportPeriod; key: string }[] = [];
    if (isMonday && user.emailWeekly) {
      jobs.push({ type: "WEEKLY_SUMMARY", period: "weekly", key: weekKey(subWeeks(now, 1)) });
    }
    if (isFirstOfMonth && user.emailMonthly) {
      jobs.push({ type: "MONTHLY_SUMMARY", period: "monthly", key: monthKey(subMonths(now, 1)) });
    }

    for (const job of jobs) {
      const already = await prisma.emailLog.findUnique({
        where: {
          userId_type_periodKey: { userId: user.id, type: job.type, periodKey: job.key },
        },
      });
      if (already) {
        skipped++;
        continue;
      }

      const data = await buildReportData(user.id, job.period, now);
      const result = await sendEmail({
        to: user.email,
        subject:
          job.period === "weekly"
            ? `🌸 Your week in money — ${data.periodLabel}`
            : `🌸 Your ${data.periodLabel} money recap`,
        html: renderReportHtml(data),
      });

      if (result.ok) {
        await prisma.emailLog.create({
          data: { userId: user.id, type: job.type, periodKey: job.key },
        });
        sent++;
      } else {
        console.error(`[email] failed for ${user.email}: ${result.error}`);
      }
    }
  }

  return { sent, skipped };
}
