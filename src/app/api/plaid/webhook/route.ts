import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncPlaidItem } from "@/lib/sync";
import { verifyPlaidWebhook } from "@/lib/plaid-webhook";
import { plaidConfigured } from "@/lib/plaid";

// Plaid webhook receiver. Requests are authenticated by verifying the
// Plaid-Verification JWT against the raw body (see lib/plaid-webhook.ts), so
// only genuine Plaid webhooks are acted on. We still never trust the payload
// beyond "re-sync this item" — the sync re-fetches everything from Plaid's API
// with our stored token.
export async function POST(req: Request) {
  // Read the raw body first — signature verification hashes the exact bytes.
  const rawBody = await req.text();

  // Only enforce verification when Plaid is configured (skips local/dev noise);
  // in production, an unsigned or invalid webhook is rejected.
  if (plaidConfigured()) {
    const ok = await verifyPlaidWebhook(req.headers.get("plaid-verification"), rawBody);
    if (!ok) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }
  }

  let body: { item_id?: string; webhook_type?: string; webhook_code?: string } | null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (!body?.item_id) return NextResponse.json({ ok: true });

  const item = await prisma.plaidItem.findUnique({
    where: { itemId: body.item_id },
  });
  if (!item) return NextResponse.json({ ok: true });

  switch (body.webhook_type) {
    case "TRANSACTIONS": {
      // SYNC_UPDATES_AVAILABLE (and legacy DEFAULT_UPDATE etc.). Skip the
      // balance refresh here — it's billed separately per call, and the
      // daily cron (or a manual "Sync now") keeps balances fresh within a day.
      await syncPlaidItem(item, { refreshBalance: false });
      const { evaluateAlerts } = await import("@/lib/alerts");
      await evaluateAlerts(item.userId).catch((e) => console.error("[alerts]", e));
      break;
    }
    case "ITEM":
      if (body.webhook_code === "PENDING_EXPIRATION" || body.webhook_code === "ERROR") {
        await prisma.plaidItem.update({
          where: { id: item.id },
          data: { status: "LOGIN_REQUIRED" },
        });
      }
      break;
  }

  return NextResponse.json({ ok: true });
}
