import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { prisma } from "@/lib/prisma";

// All Plaid calls happen server-side only — this module must never be
// imported from a client component.

const configuration = new Configuration({
  basePath:
    PlaidEnvironments[process.env.PLAID_ENV ?? "sandbox"] ??
    PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID ?? "",
      "PLAID-SECRET": process.env.PLAID_SECRET ?? "",
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

export function plaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

// ---- Plaid Trial plan safeguard -------------------------------------------
// The free Trial plan allows 10 Production Items. Warn well before the cap so
// a connection attempt never burns the last slots unknowingly.

export const PLAID_TRIAL_ITEM_LIMIT = 10;
export const PLAID_ITEM_WARN_THRESHOLD = 7;

export async function getItemUsage(): Promise<{
  count: number;
  limit: number;
  nearCap: boolean;
  atCap: boolean;
}> {
  // Count across ALL users — the trial cap is per Plaid client, not per user
  const count = await prisma.plaidItem.count();
  const usage = {
    count,
    limit: PLAID_TRIAL_ITEM_LIMIT,
    nearCap: count >= PLAID_ITEM_WARN_THRESHOLD,
    atCap: count >= PLAID_TRIAL_ITEM_LIMIT,
  };
  if (process.env.PLAID_ENV === "production" && usage.nearCap) {
    console.warn(
      `[plaid] Item usage ${count}/${PLAID_TRIAL_ITEM_LIMIT} — approaching the free Trial plan cap`
    );
  }
  return usage;
}
