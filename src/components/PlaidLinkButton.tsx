"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";

// sessionStorage key so the link token survives a full-page OAuth redirect
// (the bank's login page, then back to /accounts) — Link must be reopened
// with the exact same token, not a freshly created one.
const LINK_TOKEN_STORAGE_KEY = "blossom_plaid_link_token";

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

  const isOAuthReturn =
    typeof window !== "undefined" && window.location.search.includes("oauth_state_id=");

  const onSuccess = useCallback(
    async (publicToken: string, metadata: { institution?: { institution_id?: string; name?: string } | null }) => {
      sessionStorage.removeItem(LINK_TOKEN_STORAGE_KEY);
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
      if (isOAuthReturn) router.replace(window.location.pathname);
      router.refresh();
    },
    [itemId, router, isOAuthReturn]
  );

  // Returning from a bank's OAuth login: reload the token we stashed before
  // redirecting away, so Link can resume where it left off.
  useEffect(() => {
    if (isOAuthReturn) {
      const stored = sessionStorage.getItem(LINK_TOKEN_STORAGE_KEY);
      if (stored) setLinkToken(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Surface the specific Plaid error when Link exits abnormally (otherwise the
  // user just sees Plaid's generic "internal error" with no actionable detail).
  const onExit = useCallback(
    (err: { error_code?: string; error_message?: string; display_message?: string } | null) => {
      sessionStorage.removeItem(LINK_TOKEN_STORAGE_KEY);
      if (err) {
        console.error("[plaid-link] exit error", err);
        const detail = err.display_message || err.error_message || err.error_code;
        setError(
          detail
            ? `Bank connection error${err.error_code ? ` (${err.error_code})` : ""}: ${detail}`
            : "The bank connection didn't complete. Please try again."
        );
      }
    },
    []
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit,
    ...(isOAuthReturn ? { receivedRedirectUri: window.location.href } : {}),
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
    sessionStorage.setItem(LINK_TOKEN_STORAGE_KEY, data.linkToken);
    setLinkToken(data.linkToken);
  }

  // Once the token arrives and Link is ready, open it (this also fires
  // automatically on OAuth return, resuming without another click)
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
