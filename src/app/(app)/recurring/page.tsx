import { subMonths } from "date-fns";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectRecurring } from "@/lib/recurring";
import { money, fullDate } from "@/lib/format";

export const metadata = { title: "Recurring" };

const FREQ_LABEL = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  yearly: "Yearly",
};

export default async function RecurringPage() {
  const userId = (await getSessionUserId())!;

  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: subMonths(new Date(), 13) }, amount: { gt: 0 } },
    include: { category: { select: { name: true } } },
    orderBy: { date: "asc" },
  });

  const recurring = detectRecurring(
    transactions.map((t) => ({
      id: t.id,
      date: t.date,
      amount: Number(t.amount),
      name: t.name,
      merchantName: t.merchantName,
      logoUrl: t.logoUrl,
      categoryName: t.category?.name,
    }))
  );

  const monthlyTotal = recurring.reduce((s, r) => s + r.monthlyCost, 0);
  const priceChanges = recurring.filter((r) => r.priceChanged);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Subscriptions & recurring</h1>

      {recurring.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:max-w-md">
          <div className="rounded-2xl bg-lavender-light p-4">
            <p className="text-xs text-lavender-dark mb-1">Monthly cost</p>
            <p className="text-xl font-bold text-lavender-dark">
              {money(monthlyTotal)}
            </p>
          </div>
          <div className="rounded-2xl bg-white border border-lavender-light p-4">
            <p className="text-xs text-muted mb-1">Active recurring</p>
            <p className="text-xl font-bold">{recurring.length}</p>
          </div>
        </div>
      )}

      {priceChanges.length > 0 && (
        <div className="rounded-xl bg-blossom-light px-4 py-3 text-sm font-medium text-blossom-dark">
          ⚠️ Price change detected:{" "}
          {priceChanges
            .map(
              (r) =>
                `${r.displayName} went from ${money(r.previousAmount)} to ${money(r.lastAmount)}`
            )
            .join("; ")}
        </div>
      )}

      {recurring.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-lavender bg-lavender-light/50 p-10 text-center">
          <p className="text-3xl mb-3">🔁</p>
          <h2 className="font-semibold mb-1">No recurring charges found yet</h2>
          <p className="text-sm text-muted max-w-md mx-auto">
            Blossom looks for charges from the same merchant with similar
            amounts on a regular schedule. It needs about 3 occurrences (2 for
            yearly), so newly connected accounts may take a couple of billing
            cycles to show patterns.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-lavender-light overflow-hidden">
          <ul className="divide-y divide-lavender-light/70">
            {recurring.map((r) => (
              <li key={r.merchantKey} className="flex items-center gap-3 px-4 py-3">
                {r.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.logoUrl}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover bg-lavender-light shrink-0"
                  />
                ) : (
                  <span className="w-9 h-9 rounded-full bg-lavender-light text-lavender-dark flex items-center justify-center text-sm font-bold shrink-0">
                    {r.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {r.displayName}
                    {r.priceChanged && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide bg-blossom-light text-blossom-dark rounded-full px-1.5 py-0.5">
                        price ↑
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {FREQ_LABEL[r.frequency]}
                    {r.categoryName && ` · ${r.categoryName}`} · next ~
                    {fullDate(r.nextExpectedDate)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm">{money(r.lastAmount)}</p>
                  <p className="text-xs text-muted">{money(r.monthlyCost)}/mo</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
