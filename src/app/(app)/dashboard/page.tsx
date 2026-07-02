import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { monthRange, prevMonthRange } from "@/lib/dates";
import {
  totalSpend,
  spendingByCategory,
  balanceSummary,
} from "@/lib/spending";
import { generateInsights } from "@/lib/insights";
import { money, signedMoney, shortDate } from "@/lib/format";
import { CategoryDonut } from "@/components/charts/CategoryDonut";
import { TrendsSection } from "@/components/charts/TrendsSection";
import { AlertsBanner } from "@/components/AlertsBanner";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const userId = (await getSessionUserId())!;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user && !user.onboardingCompleted) {
    const hasData = await prisma.plaidItem.count({ where: { userId } });
    if (!hasData) redirect("/onboarding");
  }

  const thisMonth = monthRange();
  const lastMonth = prevMonthRange();

  const [
    balances,
    spendThisMonth,
    spendLastMonth,
    topCategories,
    recent,
    categories,
    accounts,
    alerts,
    insights,
  ] = await Promise.all([
    balanceSummary(userId),
    totalSpend(userId, thisMonth),
    totalSpend(userId, lastMonth),
    spendingByCategory(userId, thisMonth),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 8,
      include: { category: true, account: true },
    }),
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.account.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.alert.findMany({
      where: { userId, readAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    generateInsights(userId),
  ]);

  const momDelta = spendLastMonth > 0
    ? Math.round(((spendThisMonth - spendLastMonth) / spendLastMonth) * 100)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Hi{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 🌸
        </h1>
        <Link
          href="/accounts"
          className="text-sm font-medium text-lavender-dark hover:underline"
        >
          Manage accounts →
        </Link>
      </div>

      <AlertsBanner
        alerts={alerts.map((a) => ({
          id: a.id,
          type: a.type,
          message: a.message,
        }))}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-lavender-light p-5">
          <p className="text-sm text-muted mb-1">Total balance</p>
          <p className="text-2xl font-bold">{money(balances.cash)}</p>
          {balances.creditDebt > 0 && (
            <p className="text-xs text-muted mt-1">
              minus {money(balances.creditDebt)} on credit ={" "}
              <span className="font-medium text-ink">{money(balances.net)}</span> net
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-white border border-lavender-light p-5">
          <p className="text-sm text-muted mb-1">Spent this month</p>
          <p className="text-2xl font-bold text-blossom">{money(spendThisMonth)}</p>
          {momDelta !== null && (
            <p className="text-xs text-muted mt-1">
              <span
                className={`font-semibold ${momDelta > 0 ? "text-negative" : "text-positive"}`}
              >
                {momDelta > 0 ? "▲" : "▼"} {Math.abs(momDelta)}%
              </span>{" "}
              vs last month ({money(spendLastMonth)})
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-lavender-light border border-lavender-light p-5">
          <p className="text-sm text-lavender-dark mb-1">Top category</p>
          {topCategories[0] ? (
            <>
              <p className="text-2xl font-bold text-lavender-dark">
                {topCategories[0].name}
              </p>
              <p className="text-xs text-lavender-dark/80 mt-1">
                {money(topCategories[0].amount)} this month
              </p>
            </>
          ) : (
            <p className="text-sm text-lavender-dark/80">No spending yet</p>
          )}
        </div>
      </div>

      {/* Personalized insights */}
      {insights.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-lavender-light to-blossom-light/50 p-5">
          <h2 className="font-semibold mb-2 text-lavender-dark">✨ Your insights</h2>
          <ul className="space-y-1.5">
            {insights.map((line, i) => (
              <li key={i} className="text-sm leading-relaxed">
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Donut + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-lavender-light p-5">
          <h2 className="font-semibold mb-3">This month by category</h2>
          <CategoryDonut
            data={topCategories.slice(0, 8).map((c) => ({
              name: c.name,
              amount: Math.round(c.amount * 100) / 100,
              color: c.color,
            }))}
          />
          <ul className="mt-3 space-y-1.5">
            {topCategories.slice(0, 5).map((c) => (
              <li key={c.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.name}
                </span>
                <span className="font-medium">{money(c.amount)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-white border border-lavender-light p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent transactions</h2>
            <Link
              href="/transactions"
              className="text-sm text-lavender-dark hover:underline"
            >
              View all →
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted mb-3">
                Nothing here yet — connect a bank to pull in your transactions.
              </p>
              <Link
                href="/accounts"
                className="inline-block rounded-lg bg-blossom hover:bg-blossom-dark text-white text-sm font-semibold px-4 py-2 transition-colors"
              >
                Connect a bank
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-lavender-light/70">
              {recent.map((tx) => (
                <li key={tx.id} className="flex items-center gap-3 py-2.5">
                  {tx.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tx.logoUrl}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover bg-lavender-light"
                    />
                  ) : (
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: tx.category?.color ?? "#8B8494" }}
                    >
                      {(tx.merchantName ?? tx.name).charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {tx.merchantName ?? tx.name}
                    </p>
                    <p className="text-xs text-muted">
                      {shortDate(tx.date)} · {tx.category?.name ?? "Uncategorized"}
                      {tx.pending && " · pending"}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      Number(tx.amount) > 0 ? "" : "text-positive"
                    }`}
                  >
                    {signedMoney(tx.amount.toString())}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <TrendsSection
        categories={categories
          .filter((c) => c.name !== "Income")
          .map((c) => ({ id: c.id, name: c.name, color: c.color }))}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      />
    </div>
  );
}
