"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    await fetch("/api/plaid/sync", { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={sync}
      disabled={busy}
      className="rounded-lg bg-lavender-light hover:bg-lavender/20 text-lavender-dark font-semibold px-4 py-2.5 transition-colors disabled:opacity-60"
    >
      {busy ? "Syncing…" : "↻ Sync now"}
    </button>
  );
}

export function UnlinkItemButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function unlink() {
    if (
      !confirm(
        "Unlink this bank? Its accounts and transactions will be removed from Blossom Budget."
      )
    )
      return;
    setBusy(true);
    await fetch(`/api/plaid/items/${itemId}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={unlink}
      disabled={busy}
      className="text-xs text-muted hover:text-negative transition-colors"
    >
      {busy ? "Removing…" : "Unlink"}
    </button>
  );
}
