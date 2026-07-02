import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { snapshotNetWorth } from "@/lib/networth";

export const maxDuration = 120;

// Daily net worth snapshot for every user with any account or manual entry.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [{ accounts: { some: {} } }, { manualEntries: { some: {} } }],
    },
    select: { id: true },
  });

  for (const user of users) {
    await snapshotNetWorth(user.id).catch((e) =>
      console.error(`[snapshot] user ${user.id}`, e)
    );
  }

  return NextResponse.json({ ok: true, users: users.length });
}
