import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#7F77DD"),
  icon: z.string().max(8).default("🏷️"),
});

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const existing = await prisma.category.findUnique({
    where: { userId_name: { userId, name: parsed.data.name } },
  });
  if (existing) {
    return NextResponse.json({ error: "That category already exists." }, { status: 409 });
  }

  const category = await prisma.category.create({
    data: { userId, ...parsed.data },
  });
  return NextResponse.json({ category }, { status: 201 });
}
