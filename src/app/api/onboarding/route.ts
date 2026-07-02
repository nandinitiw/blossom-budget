import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  incomeFrequency: z.enum(["weekly", "biweekly", "semimonthly", "monthly", "irregular"]),
  financialPriority: z.enum(["saving", "debt_payoff", "awareness"]),
  budgetPeriod: z.enum(["WEEKLY", "MONTHLY"]),
  budgets: z
    .array(
      z.object({
        categoryId: z.string(),
        amount: z.number().positive().max(1_000_000),
      })
    )
    .max(30),
});

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid onboarding data" }, { status: 400 });
  }
  const d = parsed.data;

  // Only budgets for categories the user actually owns
  const owned = await prisma.category.findMany({
    where: { userId, id: { in: d.budgets.map((b) => b.categoryId) } },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((c) => c.id));

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        incomeFrequency: d.incomeFrequency,
        financialPriority: d.financialPriority,
        budgetPeriod: d.budgetPeriod,
        onboardingCompleted: true,
      },
    }),
    ...d.budgets
      .filter((b) => ownedIds.has(b.categoryId))
      .map((b) =>
        prisma.budget.upsert({
          where: { userId_categoryId: { userId, categoryId: b.categoryId } },
          update: { amount: b.amount, period: d.budgetPeriod },
          create: {
            userId,
            categoryId: b.categoryId,
            amount: b.amount,
            period: d.budgetPeriod,
          },
        })
      ),
  ]);

  return NextResponse.json({ ok: true });
}
