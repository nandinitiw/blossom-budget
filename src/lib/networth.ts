import { prisma } from "@/lib/prisma";

export type NetWorthBreakdown = {
  assets: number;
  liabilities: number;
  netWorth: number;
};

/** Pure aggregation: Plaid accounts + manual entries → net worth. */
export function computeNetWorth(
  accounts: { type: string; currentBalance: number }[],
  manualEntries: { type: "ASSET" | "LIABILITY"; balance: number }[]
): NetWorthBreakdown {
  let assets = 0,
    liabilities = 0;
  for (const a of accounts) {
    if (a.type === "credit" || a.type === "loan") liabilities += a.currentBalance;
    else assets += a.currentBalance;
  }
  for (const m of manualEntries) {
    if (m.type === "ASSET") assets += m.balance;
    else liabilities += m.balance;
  }
  return {
    assets: Math.round(assets * 100) / 100,
    liabilities: Math.round(liabilities * 100) / 100,
    netWorth: Math.round((assets - liabilities) * 100) / 100,
  };
}

export async function getNetWorth(userId: string): Promise<NetWorthBreakdown> {
  const [accounts, manual] = await Promise.all([
    prisma.account.findMany({
      where: { userId, hidden: false },
      select: { type: true, currentBalance: true },
    }),
    prisma.manualEntry.findMany({
      where: { userId },
      select: { type: true, balance: true },
    }),
  ]);
  return computeNetWorth(
    accounts.map((a) => ({ type: a.type, currentBalance: Number(a.currentBalance) })),
    manual.map((m) => ({ type: m.type, balance: Number(m.balance) }))
  );
}

/** Upsert today's snapshot (idempotent — one row per user per day). */
export async function snapshotNetWorth(userId: string): Promise<void> {
  const nw = await getNetWorth(userId);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  await prisma.netWorthSnapshot.upsert({
    where: { userId_date: { userId, date: today } },
    update: { assets: nw.assets, liabilities: nw.liabilities, netWorth: nw.netWorth },
    create: {
      userId,
      date: today,
      assets: nw.assets,
      liabilities: nw.liabilities,
      netWorth: nw.netWorth,
    },
  });
}
