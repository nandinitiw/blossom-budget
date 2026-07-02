import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingWizard } from "@/components/OnboardingWizard";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const userId = (await getSessionUserId())!;
  const categories = await prisma.category.findMany({
    where: { userId, name: { notIn: ["Income", "Other"] } },
    orderBy: { name: "asc" },
  });

  return (
    <OnboardingWizard
      categories={categories.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
    />
  );
}
