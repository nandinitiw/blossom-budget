import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { syncUser } from "@/lib/sync";
import { rateLimit } from "@/lib/rate-limit";

// Manual "refresh now" for the signed-in user's connections.
export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`plaid-sync:${userId}`, { limit: 6, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Sync was run recently — try again in a few minutes." },
      { status: 429 }
    );
  }

  const results = await syncUser(userId);
  return NextResponse.json({ ok: true, results });
}
