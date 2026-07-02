import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeMerchantKey } from "@/lib/merchant";

const schema = z.object({
  categoryId: z.string().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  rememberMerchant: z.boolean().optional().default(true),
});

// Update a transaction: recategorize (optionally remembering the merchant →
// category rule and applying it to that merchant's other transactions),
// edit the note, or set tags.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { categoryId, note, tagIds, rememberMerchant } = parsed.data;

  const tx = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (categoryId !== undefined && categoryId !== null) {
    const cat = await prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!cat) return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }

  await prisma.transaction.update({
    where: { id: tx.id },
    data: {
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(note !== undefined ? { note } : {}),
    },
  });

  if (tagIds) {
    // Replace tag set (tags must belong to the user)
    const owned = await prisma.tag.findMany({
      where: { userId, id: { in: tagIds } },
      select: { id: true },
    });
    await prisma.$transaction([
      prisma.transactionTag.deleteMany({ where: { transactionId: tx.id } }),
      prisma.transactionTag.createMany({
        data: owned.map((t) => ({ transactionId: tx.id, tagId: t.id })),
        skipDuplicates: true,
      }),
    ]);
  }

  // Learn the override: same merchant → same category, now and in future syncs
  if (categoryId && rememberMerchant) {
    const merchantKey = normalizeMerchantKey(tx.merchantName ?? tx.name);
    if (merchantKey) {
      await prisma.merchantRule.upsert({
        where: { userId_merchantKey: { userId, merchantKey } },
        update: { categoryId },
        create: { userId, merchantKey, categoryId },
      });
      // Apply to this merchant's other transactions too
      const siblings = await prisma.transaction.findMany({
        where: { userId, id: { not: tx.id } },
        select: { id: true, merchantName: true, name: true },
      });
      const matchIds = siblings
        .filter((s) => normalizeMerchantKey(s.merchantName ?? s.name) === merchantKey)
        .map((s) => s.id);
      if (matchIds.length > 0) {
        await prisma.transaction.updateMany({
          where: { id: { in: matchIds } },
          data: { categoryId },
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
