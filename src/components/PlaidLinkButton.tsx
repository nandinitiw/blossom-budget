"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";

// Two modes: connect a new bank (no itemId) or re-authenticate an existing
// item in Plaid update mode (itemId set).
export function PlaidLinkButton({
  itemId,
  variant = "primary",
  children,
}: {
  itemId?: string;
  variant?: "primary" | "subtle";
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSuccess = useCallback(
    async (publicToken: string, metadata: { institution?: { institution_id?: string; name?: string } | null }) => {
      if (itemId) {
        // Update mode: token unchanged, just clear the reauth flag by resyncing
        await fetch("/api/plaid/sync", { method: "POST" });
      } else {
        setBusy(true);
        const res = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicToken,
            institutionId: metadata.institution?.institution_id,
            institutionName: metadata.institution?.name,
          }),
        });
        setBusy(false);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Connection failed.");
          return;
        }
      }
      router.refresh();
    },
    [itemId, router]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  async function start() {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/plaid/create-link-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(itemId ? { itemId } : {}),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not start bank connection.");
      return;
    }
    const data = await res.json();
    setLinkToken(data.linkToken);
  }

  // Once the token arrives and Link is ready, open it
  useEffect(() => {
    if (linkToken && ready) {
      open();
      setLinkToken(null);
    }
  }, [linkToken, ready, open]);

  const cls =
    variant === "primary"
      ? "rounded-lg bg-blossom hover:bg-blossom-dark text-white font-semibold px-4 py-2.5 transition-colors disabled:opacity-60"
      : "rounded-lg bg-lavender-light hover:bg-lavender/20 text-lavender-dark font-semibold px-3 py-1.5 text-sm transition-colors disabled:opacity-60";

  return (
    <div>
      <button onClick={start} disabled={busy} className={cls}>
        {busy ? "Opening…" : children}
      </button>
      {error && <p className="text-sm text-negative mt-2">{error}</p>}
    </div>
  );
}
