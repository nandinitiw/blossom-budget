import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncPlaidItem } from "@/lib/sync";
import { getItemUsage } from "@/lib/plaid";

export const maxDuration = 300;

// Scheduled sync of every healthy Plaid item (see vercel.json).
// Protected by CRON_SECRET: Vercel Cron sends it as a Bearer token.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.plaidItem.findMany({
    where: { status: { not: "LOGIN_REQUIRED" } },
  });

  let ok = 0,
    reauth = 0,
    errors = 0;
  for (const item of items) {
    const res = await syncPlaidItem(item);
    if (res.status === "ok") ok++;
    else if (res.status === "reauth_required") reauth++;
    else errors++;
  }

  await getItemUsage(); // logs a warning if nearing the Plaid Trial cap

  return NextResponse.json({ ok: true, synced: ok, reauth, errors });
}
