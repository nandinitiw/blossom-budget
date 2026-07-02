import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  emailWeekly: z.boolean().optional(),
  emailMonthly: z.boolean().optional(),
  budgetPeriod: z.enum(["WEEKLY", "MONTHLY"]).optional(),
  financialPriority: z.enum(["saving", "debt_payoff", "awareness"]).optional(),
});

export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: userId }, data: parsed.data });
  return NextResponse.json({ ok: true });
}
