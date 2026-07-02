import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PlaidItem } from "@prisma/client";

// ---- Mocks -----------------------------------------------------------------

const { prismaMock, plaidMock } = vi.hoisted(() => ({
  prismaMock: {
    account: { upsert: vi.fn(), findMany: vi.fn() },
    category: { findMany: vi.fn() },
    merchantRule: { findMany: vi.fn() },
    transaction: { upsert: vi.fn(), deleteMany: vi.fn() },
    plaidItem: { update: vi.fn() },
    alert: { upsert: vi.fn() },
  },
  plaidMock: {
    accountsGet: vi.fn(),
    transactionsSync: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/plaid", () => ({ plaidClient: plaidMock }));
vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn(() => "access-token-decrypted"),
  encrypt: vi.fn((s: string) => `enc:${s}`),
}));

import { syncPlaidItem } from "@/lib/sync";

const item = {
  id: "item-db-1",
  userId: "user-1",
  itemId: "plaid-item-1",
  accessTokenEnc: "iv.data.tag",
  institutionId: "ins_1",
  institutionName: "Test Bank",
  status: "OK",
  transactionsCursor: null,
  lastSyncedAt: null,
  createdAt: new Date(),
} as unknown as PlaidItem;

const plaidAccount = {
  account_id: "acct-plaid-1",
  name: "Checking",
  official_name: "Everyday Checking",
  mask: "1234",
  type: "depository",
  subtype: "checking",
  balances: { current: 2500.5, available: 2400, iso_currency_code: "USD" },
};

function plaidTx(overrides: Record<string, unknown> = {}) {
  return {
    transaction_id: "tx-1",
    account_id: "acct-plaid-1",
    date: "2026-06-10",
    amount: 12.5,
    name: "SQ *BLUE BOTTLE COFFEE #4471",
    merchant_name: null,
    logo_url: null,
    pending: false,
    personal_finance_category: { primary: "FOOD_AND_DRINK" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.category.findMany.mockResolvedValue([
    { id: "cat-dining", name: "Dining", userId: "user-1" },
    { id: "cat-other", name: "Other", userId: "user-1" },
  ]);
  prismaMock.merchantRule.findMany.mockResolvedValue([]);
  prismaMock.account.findMany.mockResolvedValue([
    { id: "acct-db-1", plaidAccountId: "acct-plaid-1" },
  ]);
  plaidMock.accountsGet.mockResolvedValue({ data: { accounts: [plaidAccount] } });
});

// ---- Tests ------------------------------------------------------------------

describe("syncPlaidItem (integration, mocked Plaid + DB)", () => {
  it("upserts accounts, categorizes added transactions, and advances the cursor", async () => {
    plaidMock.transactionsSync.mockResolvedValueOnce({
      data: {
        added: [plaidTx()],
        modified: [],
        removed: [],
        next_cursor: "cursor-1",
        has_more: false,
      },
    });

    const result = await syncPlaidItem(item);

    expect(result).toEqual({ added: 1, modified: 0, removed: 0, status: "ok" });

    // Account balances refreshed
    expect(prismaMock.account.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { plaidAccountId: "acct-plaid-1" } })
    );

    // Transaction categorized via Plaid mapping (FOOD_AND_DRINK → Dining)
    // and merchant name cleaned for display
    const txUpsert = prismaMock.transaction.upsert.mock.calls[0][0];
    expect(txUpsert.create.categoryId).toBe("cat-dining");
    expect(txUpsert.create.merchantName).toBe("Blue Bottle Coffee");

    // Cursor + status persisted
    expect(prismaMock.plaidItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ transactionsCursor: "cursor-1", status: "OK" }),
      })
    );
  });

  it("prefers a learned merchant rule over the Plaid category", async () => {
    prismaMock.merchantRule.findMany.mockResolvedValue([
      { merchantKey: "bluebottlecoffee", categoryId: "cat-other", userId: "user-1" },
    ]);
    plaidMock.transactionsSync.mockResolvedValueOnce({
      data: { added: [plaidTx()], modified: [], removed: [], next_cursor: "c", has_more: false },
    });

    await syncPlaidItem(item);

    const txUpsert = prismaMock.transaction.upsert.mock.calls[0][0];
    expect(txUpsert.create.categoryId).toBe("cat-other");
  });

  it("pages through the cursor loop until has_more is false", async () => {
    plaidMock.transactionsSync
      .mockResolvedValueOnce({
        data: { added: [plaidTx()], modified: [], removed: [], next_cursor: "c1", has_more: true },
      })
      .mockResolvedValueOnce({
        data: {
          added: [plaidTx({ transaction_id: "tx-2" })],
          modified: [],
          removed: [],
          next_cursor: "c2",
          has_more: false,
        },
      });

    const result = await syncPlaidItem(item);

    expect(result.added).toBe(2);
    expect(plaidMock.transactionsSync).toHaveBeenCalledTimes(2);
    expect(plaidMock.transactionsSync.mock.calls[1][0].cursor).toBe("c1");
  });

  it("deletes removed transactions", async () => {
    prismaMock.transaction.deleteMany.mockResolvedValue({ count: 1 });
    plaidMock.transactionsSync.mockResolvedValueOnce({
      data: {
        added: [],
        modified: [],
        removed: [{ transaction_id: "tx-gone" }],
        next_cursor: "c",
        has_more: false,
      },
    });

    const result = await syncPlaidItem(item);

    expect(result.removed).toBe(1);
    expect(prismaMock.transaction.deleteMany).toHaveBeenCalledWith({
      where: { plaidTransactionId: { in: ["tx-gone"] } },
    });
  });

  it("marks the item LOGIN_REQUIRED and raises an alert on ITEM_LOGIN_REQUIRED", async () => {
    plaidMock.transactionsSync.mockRejectedValueOnce({
      response: { data: { error_code: "ITEM_LOGIN_REQUIRED" } },
    });

    const result = await syncPlaidItem(item);

    expect(result.status).toBe("reauth_required");
    expect(prismaMock.plaidItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "LOGIN_REQUIRED" } })
    );
    expect(prismaMock.alert.upsert).toHaveBeenCalled();
  });

  it("marks the item ERROR on unexpected failures", async () => {
    plaidMock.transactionsSync.mockRejectedValueOnce(new Error("network down"));

    const result = await syncPlaidItem(item);

    expect(result.status).toBe("error");
    expect(prismaMock.plaidItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ERROR" } })
    );
  });

  it("skips transactions for unknown accounts", async () => {
    plaidMock.transactionsSync.mockResolvedValueOnce({
      data: {
        added: [plaidTx({ account_id: "acct-unknown" })],
        modified: [],
        removed: [],
        next_cursor: "c",
        has_more: false,
      },
    });

    const result = await syncPlaidItem(item);

    expect(result.added).toBe(0);
    expect(prismaMock.transaction.upsert).not.toHaveBeenCalled();
  });
});
