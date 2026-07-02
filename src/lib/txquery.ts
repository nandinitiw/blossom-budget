import type { Prisma } from "@prisma/client";

/**
 * Shared filter builder for transaction list + CSV export so both honor
 * identical query params: q, accountId, categoryId, tagId, from, to, min, max.
 */
export function buildTransactionWhere(
  userId: string,
  p: URLSearchParams
): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };

  if (p.get("accountId")) where.accountId = p.get("accountId")!;
  if (p.get("categoryId")) where.categoryId = p.get("categoryId")!;
  if (p.get("tagId")) where.tags = { some: { tagId: p.get("tagId")! } };

  const from = p.get("from"),
    to = p.get("to");
  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const min = p.get("min"),
    max = p.get("max");
  if (min || max) {
    where.amount = {
      ...(min ? { gte: parseFloat(min) } : {}),
      ...(max ? { lte: parseFloat(max) } : {}),
    };
  }

  const q = p.get("q")?.trim();
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

  return where;
}
