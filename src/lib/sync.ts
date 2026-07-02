import type { PlaidItem } from "@prisma/client";
import type { Transaction as PlaidTransaction } from "plaid";
import { prisma } from "@/lib/prisma";
import { plaidClient } from "@/lib/plaid";
import { decrypt } from "@/lib/crypto";
import { cleanMerchantName, normalizeMerchantKey } from "@/lib/merchant";
import { resolveCategoryName } from "@/lib/categories";

/**
 * Sync one Plaid Item: pull new/modified/removed transactions via the
 * /transactions/sync cursor API, refresh balances, and (re)categorize.
 * Returns counts, or marks the item LOGIN_REQUIRED when re-auth is needed.
 */
export async function syncPlaidItem(item: PlaidItem): Promise<{
  added: number;
  modified: number;
  removed: number;
  status: "ok" | "reauth_required" | "error";
}> {
  const accessToken = decrypt(item.accessTokenEnc);
  let cursor = item.transactionsCursor ?? undefined;
  let added = 0,
    modified = 0,
    removed = 0;

  try {
    // Refresh account list + balances first
    const accountsRes = await plaidClient.accountsGet({ access_token: accessToken });
    for (const acct of accountsRes.data.accounts) {
      await prisma.account.upsert({
        where: { plaidAccountId: acct.account_id },
        update: {
          currentBalance: acct.balances.current ?? 0,
          availableBalance: acct.balances.available,
          name: acct.name,
        },
        create: {
          userId: item.userId,
          plaidItemId: item.id,
          plaidAccountId: acct.account_id,
          name: acct.name,
          officialName: acct.official_name,
          mask: acct.mask,
          type: acct.type,
          subtype: acct.subtype ?? null,
          currentBalance: acct.balances.current ?? 0,
          availableBalance: acct.balances.available,
          currency: acct.balances.iso_currency_code ?? "USD",
        },
      });
    }

    // Preload the user's categories and merchant rules once
    const [categories, rules] = await Promise.all([
      prisma.category.findMany({ where: { userId: item.userId } }),
      prisma.merchantRule.findMany({ where: { userId: item.userId } }),
    ]);
    const categoryByName = new Map(categories.map((c) => [c.name, c.id]));
    const ruleByMerchant = new Map(rules.map((r) => [r.merchantKey, r.categoryId]));

    const accounts = await prisma.account.findMany({
      where: { plaidItemId: item.id },
      select: { id: true, plaidAccountId: true },
    });
    const accountIdByPlaidId = new Map(
      accounts.map((a) => [a.plaidAccountId!, a.id])
    );

    const categorize = (tx: PlaidTransaction): string | null => {
      const key = normalizeMerchantKey(tx.merchant_name ?? tx.name);
      const ruled = ruleByMerchant.get(key);
      if (ruled) return ruled;
      const name = resolveCategoryName(tx.personal_finance_category?.primary);
      return categoryByName.get(name) ?? categoryByName.get("Other") ?? null;
    };

    const toRow = (tx: PlaidTransaction) => ({
      userId: item.userId,
      accountId: accountIdByPlaidId.get(tx.account_id)!,
      date: new Date(tx.date),
      amount: tx.amount,
      name: tx.name,
      merchantName: tx.merchant_name ?? cleanMerchantName(tx.name),
      logoUrl: tx.logo_url ?? tx.personal_finance_category_icon_url ?? null,
      plaidCategory: tx.personal_finance_category?.primary ?? null,
      categoryId: categorize(tx),
      pending: tx.pending,
    });

    // Cursor loop — keep paging until has_more is false
    let hasMore = true;
    while (hasMore) {
      const res = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor,
        count: 500,
      });
      const data = res.data;

      for (const tx of data.added) {
        if (!accountIdByPlaidId.has(tx.account_id)) continue;
        await prisma.transaction.upsert({
          where: { plaidTransactionId: tx.transaction_id },
          update: toRow(tx),
          create: { ...toRow(tx), plaidTransactionId: tx.transaction_id },
        });
        added++;
      }
      for (const tx of data.modified) {
        if (!accountIdByPlaidId.has(tx.account_id)) continue;
        await prisma.transaction.upsert({
          where: { plaidTransactionId: tx.transaction_id },
          update: toRow(tx),
          create: { ...toRow(tx), plaidTransactionId: tx.transaction_id },
        });
        modified++;
      }
      if (data.removed.length > 0) {
        const { count } = await prisma.transaction.deleteMany({
          where: {
            plaidTransactionId: {
              in: data.removed
                .map((r) => r.transaction_id)
                .filter((id): id is string => Boolean(id)),
            },
          },
        });
        removed += count;
      }

      cursor = data.next_cursor;
      hasMore = data.has_more;
    }

    await prisma.plaidItem.update({
      where: { id: item.id },
      data: {
        transactionsCursor: cursor,
        lastSyncedAt: new Date(),
        status: "OK",
      },
    });

    return { added, modified, removed, status: "ok" };
  } catch (err: unknown) {
    const plaidError = (err as { response?: { data?: { error_code?: string } } })
      ?.response?.data;
    if (
      plaidError?.error_code === "ITEM_LOGIN_REQUIRED" ||
      plaidError?.error_code === "PENDING_EXPIRATION"
    ) {
      await prisma.plaidItem.update({
        where: { id: item.id },
        data: { status: "LOGIN_REQUIRED" },
      });
      await prisma.alert.upsert({
        where: {
          userId_dedupeKey: {
            userId: item.userId,
            dedupeKey: `plaid-reauth:${item.id}`,
          },
        },
        update: { readAt: null },
        create: {
          userId: item.userId,
          type: "PLAID_REAUTH",
          dedupeKey: `plaid-reauth:${item.id}`,
          message: `${item.institutionName ?? "A bank"} connection needs to be re-linked — your login may have changed.`,
        },
      });
      return { added, modified, removed, status: "reauth_required" };
    }

    console.error(`[sync] Item ${item.itemId} failed:`, plaidError ?? err);
    await prisma.plaidItem.update({
      where: { id: item.id },
      data: { status: "ERROR" },
    });
    return { added, modified, removed, status: "error" };
  }
}

/** Sync every Item for a user (used by manual refresh + after connect). */
export async function syncUser(userId: string) {
  const items = await prisma.plaidItem.findMany({ where: { userId } });
  const results = [];
  for (const item of items) {
    results.push(await syncPlaidItem(item));
  }
  return results;
}
