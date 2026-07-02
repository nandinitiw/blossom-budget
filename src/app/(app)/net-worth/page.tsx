import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNetWorth, snapshotNetWorth } from "@/lib/networth";
import { NetWorthClient } from "@/components/NetWorthClient";

export const metadata = { title: "Net Worth" };

export default async function NetWorthPage() {
  const userId = (await getSessionUserId())!;

  // Keep today's snapshot fresh whenever the page is viewed
  await snapshotNetWorth(userId).catch(() => {});

  const [breakdown, snapshots, accounts, manualEntries] = await Promise.all([
    getNetWorth(userId),
    prisma.netWorthSnapshot.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      take: 366,
    }),
    prisma.account.findMany({ where: { userId, hidden: false }, orderBy: { name: "asc" } }),
    prisma.manualEntry.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <NetWorthClient
      breakdown={breakdown}
      snapshots={snapshots.map((s) => ({
        date: s.date.toISOString(),
        netWorth: Number(s.netWorth),
        assets: Number(s.assets),
        liabilities: Number(s.liabilities),
      }))}
      accounts={accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        mask: a.mask,
        balance: Number(a.currentBalance),
      }))}
      manualEntries={manualEntries.map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type,
        balance: Number(m.balance),
      }))}
    />
  );
}
