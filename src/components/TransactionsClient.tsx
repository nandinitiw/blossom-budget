"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signedMoney, fullDate } from "@/lib/format";

type Category = { id: string; name: string; color: string };
type Account = { id: string; name: string; mask: string | null };
type Tag = { id: string; name: string; color: string };

type Tx = {
  id: string;
  date: string;
  amount: string;
  name: string;
  merchantName: string | null;
  logoUrl: string | null;
  note: string | null;
  pending: boolean;
  category: Category | null;
  account: { id: string; name: string; mask: string | null };
  tags: { tag: Tag }[];
};

export function TransactionsClient({
  categories,
  accounts,
  initialTags,
}: {
  categories: Category[];
  accounts: Account[];
  initialTags: Tag[];
}) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tagId, setTagId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildParams = useCallback(
    (p: number) => {
      const params = new URLSearchParams({ page: String(p) });
      if (q) params.set("q", q);
      if (accountId) params.set("accountId", accountId);
      if (categoryId) params.set("categoryId", categoryId);
      if (tagId) params.set("tagId", tagId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (min) params.set("min", min);
      if (max) params.set("max", max);
      return params;
    },
    [q, accountId, categoryId, tagId, from, to, min, max]
  );

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      const res = await fetch(`/api/transactions?${buildParams(p)}`);
      if (res.ok) {
        const data = await res.json();
        setTxs(data.transactions);
        setTotal(data.total);
        setPage(data.page);
        setPageCount(data.pageCount);
      }
      setLoading(false);
    },
    [buildParams]
  );

  // Debounced reload on filter change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(1), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [load]);

  async function patchTx(id: string, body: Record<string, unknown>) {
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load(page);
  }

  async function toggleTag(tx: Tx, tagIdToToggle: string) {
    const current = tx.tags.map((t) => t.tag.id);
    const next = current.includes(tagIdToToggle)
      ? current.filter((t) => t !== tagIdToToggle)
      : [...current, tagIdToToggle];
    await patchTx(tx.id, { tagIds: next });
  }

  async function createTag(name: string): Promise<void> {
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const { tag } = await res.json();
      setTags((prev) =>
        prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]
      );
    }
  }

  const inputCls =
    "rounded-lg border border-lavender-light bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lavender/50";
  const exportHref = `/api/export/transactions?${buildParams(1)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <a
          href={exportHref}
          className="rounded-lg bg-lavender-light hover:bg-lavender/20 text-lavender-dark text-sm font-semibold px-3 py-2 transition-colors"
        >
          ⬇ Export CSV
        </a>
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-white border border-lavender-light p-4 space-y-3">
        <input
          type="search"
          placeholder="Search merchant, note, or amount…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={`${inputCls} w-full`}
        />
        <div className="flex flex-wrap gap-2">
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls} aria-label="Account">
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.mask ? ` ··${a.mask}` : ""}
              </option>
            ))}
          </select>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={tagId} onChange={(e) => setTagId(e.target.value)} className={inputCls} aria-label="Tag">
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} aria-label="From date" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} aria-label="To date" />
          <input type="number" placeholder="Min $" value={min} onChange={(e) => setMin(e.target.value)} className={`${inputCls} w-24`} aria-label="Minimum amount" />
          <input type="number" placeholder="Max $" value={max} onChange={(e) => setMax(e.target.value)} className={`${inputCls} w-24`} aria-label="Maximum amount" />
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl bg-white border border-lavender-light overflow-hidden">
        {loading ? (
          <p className="text-sm text-muted text-center py-12">Loading…</p>
        ) : txs.length === 0 ? (
          <p className="text-sm text-muted text-center py-12">
            No transactions match. Adjust your filters, or connect a bank on the
            Accounts page.
          </p>
        ) : (
          <ul className="divide-y divide-lavender-light/70">
            {txs.map((tx) => (
              <li key={tx.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {tx.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tx.logoUrl} alt="" className="w-9 h-9 rounded-full object-cover bg-lavender-light shrink-0" />
                  ) : (
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ backgroundColor: tx.category?.color ?? "#8B8494" }}
                    >
                      {(tx.merchantName ?? tx.name).charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {tx.merchantName ?? tx.name}
                      {tx.pending && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide bg-lavender-light text-lavender-dark rounded-full px-1.5 py-0.5">
                          pending
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {fullDate(tx.date)} · {tx.account.name}
                      {tx.note && ` · 📝 ${tx.note}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={tx.category?.id ?? ""}
                      onChange={(e) => patchTx(tx.id, { categoryId: e.target.value || null })}
                      className="rounded-lg border border-lavender-light bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-lavender/50 max-w-32"
                      aria-label="Category"
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <span
                      className={`font-semibold text-sm w-24 text-right ${
                        parseFloat(tx.amount) > 0 ? "" : "text-positive"
                      }`}
                    >
                      {signedMoney(tx.amount)}
                    </span>
                    <details className="relative">
                      <summary className="list-none cursor-pointer text-muted hover:text-ink px-1" aria-label="More options">
                        ⋯
                      </summary>
                      <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl bg-white border border-lavender-light shadow-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-muted uppercase tracking-wide">Tags</p>
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map((t) => {
                            const active = tx.tags.some((x) => x.tag.id === t.id);
                            return (
                              <button
                                key={t.id}
                                onClick={() => toggleTag(tx, t.id)}
                                className={`text-xs rounded-full px-2 py-0.5 border transition-colors ${
                                  active
                                    ? "bg-blossom text-white border-blossom"
                                    : "border-lavender-light text-muted hover:border-blossom"
                                }`}
                              >
                                {t.name}
                              </button>
                            );
                          })}
                        </div>
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const input = e.currentTarget.elements.namedItem("newtag") as HTMLInputElement;
                            if (input.value.trim()) {
                              await createTag(input.value.trim());
                              input.value = "";
                            }
                          }}
                        >
                          <input
                            name="newtag"
                            placeholder="New tag…"
                            className="w-full rounded-lg border border-lavender-light px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-lavender/50"
                          />
                        </form>
                        <p className="text-xs font-semibold text-muted uppercase tracking-wide pt-1">Note</p>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const input = e.currentTarget.elements.namedItem("note") as HTMLInputElement;
                            patchTx(tx.id, { note: input.value || null });
                          }}
                        >
                          <input
                            name="note"
                            defaultValue={tx.note ?? ""}
                            placeholder="Add a note, press Enter"
                            className="w-full rounded-lg border border-lavender-light px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-lavender/50"
                          />
                        </form>
                      </div>
                    </details>
                  </div>
                </div>
                {tx.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5 ml-12">
                    {tx.tags.map(({ tag }) => (
                      <span
                        key={tag.id}
                        className="text-[11px] rounded-full px-2 py-0.5 font-medium"
                        style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {total} transaction{total === 1 ? "" : "s"}
          {total > 0 && ` · page ${page} of ${pageCount}`}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1 || loading}
            onClick={() => load(page - 1)}
            className="rounded-lg border border-lavender-light px-3 py-1.5 disabled:opacity-40 hover:bg-lavender-light/60 transition-colors"
          >
            ← Prev
          </button>
          <button
            disabled={page >= pageCount || loading}
            onClick={() => load(page + 1)}
            className="rounded-lg border border-lavender-light px-3 py-1.5 disabled:opacity-40 hover:bg-lavender-light/60 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
