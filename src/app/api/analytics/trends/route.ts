import { NextResponse } from "next/server";
import { subMonths, subWeeks, format, startOfMonth, startOfWeek } from "date-fns";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Spending trend series for charts.
// Query params: granularity=monthly|weekly, categoryId, accountId, from, to.
// Each period reports per-category spend (for the stacked bars) plus the
// period totals: spend (money out), earned (money in), and net.
export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const granularity = url.searchParams.get("granularity") === "weekly" ? "weekly" : "monthly";
  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  const accountId = url.searchParams.get("accountId") ?? undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const now = new Date();
  const start = from
    ? new Date(from)
    : granularity === "weekly"
      ? startOfWeek(subWeeks(now, 11), { weekStartsOn: 1 })
      : startOfMonth(subMonths(now, 5));
  const end = to ? new Date(to) : now;

  // Pull everything in range (both money-in and money-out) so we can report
  // earned and net alongside spend. Optional category/account filters still apply.
  const txs = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: start, lte: end },
      ...(categoryId ? { categoryId } : {}),
      ...(accountId ? { accountId } : {}),
    },
    select: { date: true, amount: true, categoryId: true },
  });

  const categories = await prisma.category.findMany({
    where: { userId },
    select: { id: true, name: true, color: true },
  });
  const catById = new Map(categories.map((c) => [c.id, c]));

  // bucket key: "Jun 2026" (monthly) or ISO week start "Jun 8" (weekly)
  const bucketOf = (d: Date) =>
    granularity === "weekly"
      ? format(startOfWeek(d, { weekStartsOn: 1 }), "MMM d")
      : format(d, "MMM yyyy");

  type Bucket = { spend: number; earned: number; cats: Record<string, number> };
  const buckets = new Map<string, Bucket>();
  // Pre-create buckets so empty periods still render
  const cursor = new Date(start);
  while (cursor <= end) {
    buckets.set(bucketOf(cursor), { spend: 0, earned: 0, cats: {} });
    if (granularity === "weekly") cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const tx of txs) {
    const bucket = buckets.get(bucketOf(tx.date));
    if (!bucket) continue;
    const amount = Number(tx.amount);
    const catName = tx.categoryId
      ? (catById.get(tx.categoryId)?.name ?? "Uncategorized")
      : "Uncategorized";

    // Plaid convention: negative amount = money in.
    if (amount < 0) {
      bucket.earned += -amount;
    } else if (catName !== "Income") {
      bucket.spend += amount;
      bucket.cats[catName] = (bucket.cats[catName] ?? 0) + amount;
    }
  }

  const series = Array.from(buckets.entries()).map(([label, b]) => ({
    label,
    spend: Math.round(b.spend * 100) / 100,
    earned: Math.round(b.earned * 100) / 100,
    net: Math.round((b.earned - b.spend) * 100) / 100,
    total: Math.round(b.spend * 100) / 100, // back-compat: total == spend
    ...b.cats,
  }));

  const categoryMeta = categories
    .filter((c) => c.name !== "Income")
    .map((c) => ({ name: c.name, color: c.color }));

  return NextResponse.json({ series, categories: categoryMeta });
}
