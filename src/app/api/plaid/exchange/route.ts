import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { plaidClient, getItemUsage } from "@/lib/plaid";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { syncPlaidItem } from "@/lib/sync";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  publicToken: z.string().min(1),
  institutionId: z.string().optional(),
  institutionName: z.string().optional(),
});

// Exchange a Link public_token for an access_token, store it encrypted,
// and run the initial transaction sync (Plaid backfills up to 90 days).
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`plaid-exchange:${clientIp(req)}`, { limit: 10, windowMs: 15 * 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing publicToken" }, { status: 400 });
  }

  try {
    const exchange = await plaidClient.itemPublicTokenExchange({
      public_token: parsed.data.publicToken,
    });

    const item = await prisma.plaidItem.upsert({
      where: { itemId: exchange.data.item_id },
      update: {
        accessTokenEnc: encrypt(exchange.data.access_token),
        status: "OK",
      },
      create: {
        userId,
        itemId: exchange.data.item_id,
        accessTokenEnc: encrypt(exchange.data.access_token),
        institutionId: parsed.data.institutionId,
        institutionName: parsed.data.institutionName,
      },
    });

    const result = await syncPlaidItem(item);
    const usage = await getItemUsage();

    return NextResponse.json({
      ok: true,
      synced: result,
      itemUsage: usage.nearCap ? usage : undefined,
    });
  } catch (err) {
    console.error("[plaid] token exchange failed", err);
    return NextResponse.json(
      { error: "Bank connection failed. Please try again." },
      { status: 502 }
    );
  }
}
