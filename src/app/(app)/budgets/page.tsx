import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBudgetsWithProgress } from "@/lib/budgets";
import { BudgetsClient } from "@/components/BudgetsClient";

export const metadata = { title: "Budgets" };

export default async function BudgetsPage() {
  const userId = (await getSessionUserId())!;
  const [budgets, categories, user] = await Promise.all([
    getBudgetsWithProgress(userId),
    prisma.category.findMany({
      where: { userId, name: { not: "Income" } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  return (
    <BudgetsClient
      budgets={budgets}
      categories={categories.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
      defaultPeriod={user?.budgetPeriod ?? "MONTHLY"}
    />
  );
}
