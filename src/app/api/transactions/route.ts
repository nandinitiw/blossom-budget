import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildTransactionWhere } from "@/lib/txquery";

const PAGE_SIZE = 50;

// Transaction list with combinable search + filters:
// q (merchant/name/note/amount), accountId, categoryId, tagId,
// from, to, min, max, page.
export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const p = new URL(req.url).searchParams;
  const page = Math.max(1, parseInt(p.get("page") ?? "1", 10) || 1);
  const where = buildTransactionWhere(userId, p);

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
