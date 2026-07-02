import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildTransactionWhere } from "@/lib/txquery";
import { format } from "date-fns";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// CSV export honoring the same filters as the transactions view.
export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const p = new URL(req.url).searchParams;
  const where = buildTransactionWhere(userId, p);

  const txs = await prisma.transaction.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 50_000,
    include: {
      category: { select: { name: true } },
      account: { select: { name: true, mask: true } },
      tags: { include: { tag: { select: { name: true } } } },
    },
  });

  const header = "Date,Merchant,Raw Name,Amount,Category,Account,Tags,Note,Pending";
  const rows = txs.map((t) =>
    [
      format(t.date, "yyyy-MM-dd"),
      csvEscape(t.merchantName ?? t.name),
      csvEscape(t.name),
      // Plaid: positive = outflow. Flip so the CSV reads naturally
      // (negative = spent, positive = received).
      (-Number(t.amount)).toFixed(2),
      csvEscape(t.category?.name ?? "Uncategorized"),
      csvEscape(`${t.account.name}${t.account.mask ? ` ..${t.account.mask}` : ""}`),
      csvEscape(t.tags.map((x) => x.tag.name).join("; ")),
      csvEscape(t.note ?? ""),
      t.pending ? "yes" : "no",
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="blossom-transactions-${format(new Date(), "yyyy-MM-dd")}.csv"`,
    },
  });
}
