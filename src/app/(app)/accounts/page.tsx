import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getItemUsage } from "@/lib/plaid";
import { money } from "@/lib/format";
import { PlaidLinkButton } from "@/components/PlaidLinkButton";
import { UnlinkItemButton, SyncNowButton } from "@/components/AccountActions";

export const metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const userId = (await getSessionUserId())!;
  const [items, usage] = await Promise.all([
    prisma.plaidItem.findMany({
      where: { userId },
      include: { accounts: { orderBy: { name: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    getItemUsage(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <div className="flex items-center gap-2">
          {items.length > 0 && <SyncNowButton />}
          <PlaidLinkButton>＋ Connect a bank</PlaidLinkButton>
        </div>
      </div>

      {usage.nearCap && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            usage.atCap
              ? "bg-blossom-light text-blossom-dark"
              : "bg-lavender-light text-lavender-dark"
          }`}
        >
          {usage.atCap
            ? `You've reached the Plaid free Trial limit (${usage.count}/${usage.limit} bank connections). Unlink one to add another.`
            : `Heads up: ${usage.count} of ${usage.limit} Plaid Trial bank connections used.`}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-lavender bg-lavender-light/50 p-10 text-center">
          <p className="text-3xl mb-3">🏦</p>
          <h2 className="font-semibold mb-1">No banks connected yet</h2>
          <p className="text-sm text-muted mb-4 max-w-sm mx-auto">
            Connect your checking, savings, or credit card accounts and Blossom
            will pull in your balances and the last 90 days of transactions.
          </p>
          <div className="flex justify-center">
            <PlaidLinkButton>Connect your first bank</PlaidLinkButton>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl bg-white border border-lavender-light overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-lavender-light/60">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {item.institutionName ?? "Bank"}
                  </span>
                  {item.status === "LOGIN_REQUIRED" && (
                    <span className="text-xs font-semibold bg-blossom-light text-blossom-dark rounded-full px-2 py-0.5">
                      Needs re-connection
                    </span>
                  )}
                  {item.status === "ERROR" && (
                    <span className="text-xs font-semibold bg-blossom-light text-blossom-dark rounded-full px-2 py-0.5">
                      Sync error
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {item.status === "LOGIN_REQUIRED" && (
                    <PlaidLinkButton itemId={item.id} variant="subtle">
                      Re-connect
                    </PlaidLinkButton>
                  )}
                  <span className="text-xs text-muted">
                    {item.lastSyncedAt
                      ? `Synced ${item.lastSyncedAt.toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}`
                      : "Not synced yet"}
                  </span>
                  <UnlinkItemButton itemId={item.id} />
                </div>
              </div>
              <ul className="divide-y divide-lavender-light/70">
                {item.accounts.map((acct) => (
                  <li
                    key={acct.id}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div>
                      <p className="font-medium">
                        {acct.name}
                        {acct.mask && (
                          <span className="text-muted font-normal"> ··{acct.mask}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted capitalize">
                        {acct.subtype ?? acct.type}
                      </p>
                    </div>
                    <p
                      className={`font-semibold ${
                        acct.type === "credit" ? "text-blossom-dark" : ""
                      }`}
                    >
                      {money(acct.currentBalance.toString())}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
