import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { plaidClient } from "@/lib/plaid";
import { decrypt } from "@/lib/crypto";

// Unlink a bank connection. Calls Plaid /item/remove so the Item stops
// counting against the 10-Item Trial cap, then cascades local deletion
// (accounts + transactions go with it via Prisma relations).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const item = await prisma.plaidItem.findFirst({ where: { id, userId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await plaidClient.itemRemove({ access_token: decrypt(item.accessTokenEnc) });
  } catch (err) {
    // Still delete locally even if Plaid removal fails (e.g. already removed)
    console.warn("[plaid] itemRemove failed, deleting locally anyway", err);
  }

  await prisma.plaidItem.delete({ where: { id: item.id } });
  return NextResponse.json({ ok: true });
}
