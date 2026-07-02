import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getItemUsage } from "@/lib/plaid";
import { SettingsClient } from "@/components/SettingsClient";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const userId = (await getSessionUserId())!;
  const [user, categories, usage] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    getItemUsage(),
  ]);

  return (
    <SettingsClient
      user={{
        name: user?.name ?? "",
        email: user?.email ?? "",
        emailWeekly: user?.emailWeekly ?? false,
        emailMonthly: user?.emailMonthly ?? false,
        budgetPeriod: user?.budgetPeriod ?? "MONTHLY",
        financialPriority: user?.financialPriority ?? "awareness",
      }}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        icon: c.icon,
        isDefault: c.isDefault,
      }))}
      plaidUsage={usage}
    />
  );
}
