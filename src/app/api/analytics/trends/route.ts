import { NextResponse } from "next/server";
import { subMonths, subWeeks, format, startOfMonth, startOfWeek } from "date-fns";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Spending trend series for charts.
// Query params: granularity=monthly|weekly, months|weeks lookback,
// categoryId, accountId, from, to — all combinable.
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

  const txs = await prisma.transaction.findMany({
    where: {
      userId,
      amount: { gt: 0 },
      date: { gte: start, lte: end },
      ...(categoryId ? { categoryId } : {}),
      ...(accountId ? { accountId } : {}),
      category: { isNot: { name: "Income" } },
    },
    select: { date: true, amount: true, categoryId: true },
  });

  const categories = await prisma.category.findMany({
    where: { userId },
    select: { id: true, name: true, color: true },
  });
  const catById = new Map(categories.map((c) => [c.id, c]));

  // bucket key: "2026-06" or ISO week start date
  const bucketOf = (d: Date) =>
    granularity === "weekly"
      ? format(startOfWeek(d, { weekStartsOn: 1 }), "MMM d")
      : format(d, "MMM yyyy");

  const buckets = new Map<string, Record<string, number>>();
  // Pre-create buckets so empty periods still render
  const cursor = new Date(start);
  while (cursor <= end) {
    buckets.set(bucketOf(cursor), {});
    if (granularity === "weekly") cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const tx of txs) {
    const key = bucketOf(tx.date);
    const bucket = buckets.get(key) ?? {};
    const catName = tx.categoryId
      ? (catById.get(tx.categoryId)?.name ?? "Uncategorized")
      : "Uncategorized";
    bucket[catName] = (bucket[catName] ?? 0) + Number(tx.amount);
    buckets.set(key, bucket);
  }

  const series = Array.from(buckets.entries()).map(([label, cats]) => ({
    label,
    total: Object.values(cats).reduce((s, v) => s + v, 0),
    ...cats,
  }));

  const categoryMeta = categories
    .filter((c) => c.name !== "Income")
    .map((c) => ({ name: c.name, color: c.color }));

  return NextResponse.json({ series, categories: categoryMeta });
}
