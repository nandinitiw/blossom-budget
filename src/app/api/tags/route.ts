import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tags = await prisma.tag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ tags });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Tag name required (max 40 chars)" }, { status: 400 });
  }

  const tag = await prisma.tag.upsert({
    where: { userId_name: { userId, name: parsed.data.name } },
    update: {},
    create: {
      userId,
      name: parsed.data.name,
      color: parsed.data.color ?? "#D4537E",
    },
  });
  return NextResponse.json({ tag }, { status: 201 });
}
