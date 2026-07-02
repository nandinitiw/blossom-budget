import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { snapshotNetWorth } from "@/lib/networth";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["ASSET", "LIABILITY"]),
  balance: z.number().min(0).max(100_000_000),
});

// Manually-tracked assets/liabilities (investment accounts, loans, etc.)
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid entry" }, { status: 400 });
  }

  const entry = await prisma.manualEntry.create({
    data: { userId, ...parsed.data },
  });
  await snapshotNetWorth(userId).catch(() => {});
  return NextResponse.json({ entry }, { status: 201 });
}
