import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { getSessionUserId } from "@/lib/auth";
import { plaidClient, plaidConfigured, getItemUsage } from "@/lib/plaid";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// Creates a Plaid Link token. Pass { itemId } to open Link in update mode
// for an item that needs re-authentication.
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`plaid-link:${clientIp(req)}`, { limit: 20, windowMs: 15 * 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  if (!plaidConfigured()) {
    return NextResponse.json(
      { error: "Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to your environment." },
      { status: 503 }
    );
  }

  const { itemId } = await req.json().catch(() => ({}));

  try {
    if (itemId) {
      // Update mode: re-auth an existing item (must belong to this user)
      const item = await prisma.plaidItem.findFirst({ where: { id: itemId, userId } });
      if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
      const { decrypt } = await import("@/lib/crypto");
      const res = await plaidClient.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: "Blossom Budget",
        language: "en",
        country_codes: [CountryCode.Us],
        access_token: decrypt(item.accessTokenEnc),
      });
      return NextResponse.json({ linkToken: res.data.link_token, updateMode: true });
    }

    // New connection: enforce the Plaid Trial 10-Item safeguard
    const usage = await getItemUsage();
    if (usage.atCap) {
      return NextResponse.json(
        {
          error: `Plaid Item limit reached (${usage.count}/${usage.limit} on the free Trial plan). Remove an unused connection or upgrade your Plaid plan.`,
        },
        { status: 409 }
      );
    }

    const res = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Blossom Budget",
      products: [Products.Transactions],
      language: "en",
      country_codes: [CountryCode.Us],
      transactions: { days_requested: 90 },
      webhook: process.env.APP_URL
        ? `${process.env.APP_URL}/api/plaid/webhook`
        : undefined,
    });
    return NextResponse.json({
      linkToken: res.data.link_token,
      usage: usage.nearCap ? usage : undefined,
    });
  } catch (err) {
    console.error("[plaid] linkTokenCreate failed", err);
    return NextResponse.json(
      { error: "Could not start bank connection. Check your Plaid credentials." },
      { status: 502 }
    );
  }
}
