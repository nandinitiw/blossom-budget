import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().trim().min(1).max(140),
  price: z.number().min(0).max(10_000_000),
  // Only allow http(s) links — a link is rendered as an anchor, so this keeps
  // javascript:/data: URIs out of the UI.
  url: z
    .string()
    .trim()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), "Link must start with http:// or https://")
    .max(2000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Give the item a name and a price." },
      { status: 400 }
    );
  }

  const item = await prisma.wishlistItem.create({
    data: { userId, ...parsed.data },
  });
  return NextResponse.json({ item }, { status: 201 });
}
