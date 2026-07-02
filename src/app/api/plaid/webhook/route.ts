import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncPlaidItem } from "@/lib/sync";

// Plaid webhook receiver. We only act on item_ids we already know, and we
// never trust webhook payload data beyond "go re-sync this item" — the sync
// itself re-fetches everything from Plaid's API with our stored token.
// For production hardening you can additionally verify the Plaid-Verification
// JWT header (https://plaid.com/docs/api/webhooks/webhook-verification/).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.item_id) return NextResponse.json({ ok: true });

  const item = await prisma.plaidItem.findUnique({
    where: { itemId: body.item_id },
  });
  if (!item) return NextResponse.json({ ok: true });

  switch (body.webhook_type) {
    case "TRANSACTIONS": {
      // SYNC_UPDATES_AVAILABLE (and legacy DEFAULT_UPDATE etc.)
      await syncPlaidItem(item);
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
