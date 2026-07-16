import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGoalsWithProgress } from "@/lib/goals";
import { GoalsClient } from "@/components/GoalsClient";
import { WishlistSection } from "@/components/WishlistSection";

export const metadata = { title: "Goals" };

export default async function GoalsPage() {
  const userId = (await getSessionUserId())!;
  const [goals, categories, accounts, wishlist] = await Promise.all([
    getGoalsWithProgress(userId),
    prisma.category.findMany({
      where: { userId, name: { not: "Income" } },
      orderBy: { name: "asc" },
    }),
    prisma.account.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: [{ purchasedAt: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <GoalsClient
        goals={goals.map((g) => ({
          id: g.id,
          name: g.name,
          type: g.type,
          deadline: g.deadline?.toISOString() ?? null,
          categoryName: g.categoryName ?? null,
          accountName: g.accountName ?? null,
          progress: g.progress,
        }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          mask: a.mask,
        }))}
      />

      <WishlistSection
        items={wishlist.map((w) => ({
          id: w.id,
          name: w.name,
          price: Number(w.price),
          url: w.url,
          purchased: w.purchasedAt !== null,
        }))}
      />
    </div>
  );
}
