"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";

export type WishlistRow = {
  id: string;
  name: string;
  price: number;
  url: string | null;
  purchased: boolean;
};

/** Strip the scheme/www for a compact link label (e.g. "amazon.com"). */
function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

export function WishlistSection({ items }: { items: WishlistRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = items.filter((i) => !i.purchased);
  const purchased = items.filter((i) => i.purchased);
  const openTotal = open.reduce((s, i) => s + i.price, 0);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        price: parseFloat(price),
        ...(url.trim() ? { url: url.trim() } : {}),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not add that item.");
      return;
    }
    setName("");
    setPrice("");
    setUrl("");
    setAdding(false);
    router.refresh();
  }

  async function togglePurchased(item: WishlistRow) {
    await fetch(`/api/wishlist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purchased: !item.purchased }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this item from your wishlist?")) return;
    await fetch(`/api/wishlist/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const inputCls =
    "rounded-lg border border-lavender-light bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lavender/50";

  function Row({ item }: { item: WishlistRow }) {
    return (
      <li className="flex items-center gap-3 py-2.5">
        <input
          type="checkbox"
          checked={item.purchased}
          onChange={() => togglePurchased(item)}
          className="accent-[#D4537E] w-4 h-4 shrink-0"
          aria-label={item.purchased ? `Mark ${item.name} as not bought` : `Mark ${item.name} as bought`}
        />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${item.purchased ? "line-through text-muted" : ""}`}>
            {item.name}
          </p>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-xs text-lavender-dark hover:underline"
            >
              {hostLabel(item.url)} ↗
            </a>
          )}
        </div>
        <span className={`text-sm font-semibold shrink-0 ${item.purchased ? "text-muted" : ""}`}>
          {money(item.price)}
        </span>
        <button
          onClick={() => remove(item.id)}
          className="text-xs text-muted hover:text-negative transition-colors shrink-0"
          aria-label={`Remove ${item.name}`}
        >
          ✕
        </button>
      </li>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-lavender-light p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="font-semibold">✨ Wishlist</h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-sm font-medium text-lavender-dark hover:underline"
        >
          {adding ? "Cancel" : "＋ Add item"}
        </button>
      </div>
      <p className="text-xs text-muted mb-4">
        Things you&apos;re saving up for — keep the price and link handy.
        {open.length > 0 && (
          <>
            {" "}
            <span className="font-medium text-ink">
              {open.length} item{open.length === 1 ? "" : "s"} · {money(openTotal)} total
            </span>
          </>
        )}
      </p>

      {adding && (
        <form onSubmit={add} className="flex flex-wrap items-end gap-2 mb-4">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-muted mb-1">Item</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standing desk"
              className={`${inputCls} w-full`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Price ($)</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={`${inputCls} w-24`}
            />
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-muted mb-1">
              Link <span className="font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className={`${inputCls} w-full`}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-blossom hover:bg-blossom-dark text-white text-sm font-semibold px-4 py-2 transition-colors disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add"}
          </button>
          {error && <p className="text-sm text-negative w-full">{error}</p>}
        </form>
      )}

      {items.length === 0 && !adding ? (
        <p className="text-sm text-muted py-4 text-center">
          Nothing on your wishlist yet — add something you&apos;re eyeing.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-lavender-light/70">
            {open.map((item) => (
              <Row key={item.id} item={item} />
            ))}
          </ul>
          {purchased.length > 0 && (
            <div className="mt-3 pt-3 border-t border-lavender-light">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">
                Bought
              </p>
              <ul className="divide-y divide-lavender-light/70">
                {purchased.map((item) => (
                  <Row key={item.id} item={item} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
