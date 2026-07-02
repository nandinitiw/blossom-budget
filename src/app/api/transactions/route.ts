import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

// Transaction list with combinable search + filters:
// q (merchant/name/note/amount), accountId, categoryId, tagId,
// from, to, min, max, page.
export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const p = new URL(req.url).searchParams;
  const q = p.get("q")?.trim();
  const page = Math.max(1, parseInt(p.get("page") ?? "1", 10) || 1);

  const where: Prisma.TransactionWhereInput = { userId };

  if (p.get("accountId")) where.accountId = p.get("accountId")!;
  if (p.get("categoryId")) where.categoryId = p.get("categoryId")!;
  if (p.get("tagId")) where.tags = { some: { tagId: p.get("tagId")! } };

  const from = p.get("from"), to = p.get("to");
  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const min = p.get("min"), max = p.get("max");
  if (min || max) {
    where.amount = {
      ...(min ? { gte: parseFloat(min) } : {}),
      ...(max ? { lte: parseFloat(max) } : {}),
    };
  }

  if (q) {
    const asNumber = parseFloat(q.replace(/[$,]/g, ""));
    const or: Prisma.TransactionWhereInput[] = [
      { name: { contains: q, mode: "insensitive" } },
      { merchantName: { contains: q, mode: "insensitive" } },
      { note: { contains: q, mode: "insensitive" } },
    ];
    if (!Number.isNaN(asNumber)) {
      or.push({ amount: { equals: asNumber } }, { amount: { equals: -asNumber } });
    }
    where.OR = or;
  }

  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        category: { select: { id: true, name: true, color: true } },
        account: { select: { id: true, name: true, mask: true } },
        tags: { include: { tag: true } },
      },
    }),
  ]);

  return NextResponse.json({
    transactions,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
