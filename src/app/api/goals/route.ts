import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateAlerts } from "@/lib/alerts";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["SAVE", "SPEND_LIMIT", "DEBT_PAYOFF"]),
  targetAmount: z.number().positive().max(10_000_000),
  categoryId: z.string().optional(), // SPEND_LIMIT
  accountId: z.string().optional(), // SAVE / DEBT_PAYOFF
  deadline: z.string().optional(), // ISO date
});

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid goal" }, { status: 400 });
  }
  const d = parsed.data;

  if (d.type === "SPEND_LIMIT" && !d.categoryId) {
    return NextResponse.json(
      { error: "Spending-limit goals need a category." },
      { status: 400 }
    );
  }
  if ((d.type === "SAVE" || d.type === "DEBT_PAYOFF") && !d.accountId) {
    return NextResponse.json(
      { error: "Savings and debt goals need a linked account to track." },
      { status: 400 }
    );
  }

  // Validate ownership of linked records; snapshot the starting balance
  let startAmount: number | null = null;
  if (d.accountId) {
    const account = await prisma.account.findFirst({
      where: { id: d.accountId, userId },
    });
    if (!account) return NextResponse.json({ error: "Unknown account" }, { status: 400 });
    startAmount = Number(account.currentBalance);
  }
  if (d.categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: d.categoryId, userId } });
    if (!cat) return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }

  const goal = await prisma.goal.create({
    data: {
      userId,
      name: d.name,
      type: d.type,
      targetAmount: d.targetAmount,
      startAmount,
      categoryId: d.categoryId,
      accountId: d.accountId,
      deadline: d.deadline ? new Date(d.deadline) : null,
    },
  });

  await evaluateAlerts(userId).catch(() => {});
  return NextResponse.json({ goal }, { status: 201 });
}
