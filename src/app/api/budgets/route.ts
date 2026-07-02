import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateAlerts } from "@/lib/alerts";

const upsertSchema = z.object({
  categoryId: z.string().min(1),
  amount: z.number().positive().max(1_000_000),
  period: z.enum(["WEEKLY", "MONTHLY"]).default("MONTHLY"),
});

// Create or update the budget for a category.
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = upsertSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid budget" }, { status: 400 });
  }

  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, userId },
  });
  if (!category) return NextResponse.json({ error: "Unknown category" }, { status: 400 });

  const budget = await prisma.budget.upsert({
    where: { userId_categoryId: { userId, categoryId: parsed.data.categoryId } },
    update: { amount: parsed.data.amount, period: parsed.data.period },
    create: {
      userId,
      categoryId: parsed.data.categoryId,
      amount: parsed.data.amount,
      period: parsed.data.period,
    },
  });

  await evaluateAlerts(userId).catch(() => {});
  return NextResponse.json({ budget }, { status: 201 });
}
