import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  targetAmount: z.number().positive().max(10_000_000).optional(),
  deadline: z.string().nullable().optional(),
  archived: z.boolean().optional(),
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
  const d = parsed.data;

  const { count } = await prisma.goal.updateMany({
    where: { id, userId },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.targetAmount !== undefined ? { targetAmount: d.targetAmount } : {}),
      ...(d.deadline !== undefined
        ? { deadline: d.deadline ? new Date(d.deadline) : null }
        : {}),
      ...(d.archived !== undefined ? { archived: d.archived } : {}),
    },
  });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { count } = await prisma.goal.deleteMany({ where: { id, userId } });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
