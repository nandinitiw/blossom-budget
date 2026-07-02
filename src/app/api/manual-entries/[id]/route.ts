import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { snapshotNetWorth } from "@/lib/networth";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  balance: z.number().min(0).max(100_000_000).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  }

  const { count } = await prisma.manualEntry.updateMany({
    where: { id, userId },
    data: parsed.data,
  });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await snapshotNetWorth(userId).catch(() => {});
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { count } = await prisma.manualEntry.deleteMany({ where: { id, userId } });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await snapshotNetWorth(userId).catch(() => {});
  return NextResponse.json({ ok: true });
}
