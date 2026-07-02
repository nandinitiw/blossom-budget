import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransactionsClient } from "@/components/TransactionsClient";

export const metadata = { title: "Transactions" };

export default async function TransactionsPage() {
  const userId = (await getSessionUserId())!;
  const [categories, accounts, tags] = await Promise.all([
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.account.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.tag.findMany({ where: { userId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <TransactionsClient
      categories={categories.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name, mask: a.mask }))}
      initialTags={tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
    />
  );
}
