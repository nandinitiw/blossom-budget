"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

const TYPE_STYLE: Record<string, string> = {
  BUDGET_EXCEEDED: "bg-blossom-light text-blossom-dark",
  BUDGET_WARNING: "bg-blossom-light/60 text-blossom-dark",
  GOAL_AT_RISK: "bg-blossom-light/60 text-blossom-dark",
  GOAL_ACHIEVED: "bg-lavender-light text-lavender-dark",
  RECURRING_PRICE_CHANGE: "bg-lavender-light text-lavender-dark",
  PLAID_REAUTH: "bg-blossom-light text-blossom-dark",
};

export function AlertsBanner({
  alerts,
}: {
  alerts: { id: string; type: string; message: string }[];
}) {
  const router = useRouter();
  if (alerts.length === 0) return null;

  async function dismiss(id: string) {
    await fetch(`/api/alerts/${id}`, { method: "PATCH" });
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium ${
            TYPE_STYLE[a.type] ?? "bg-lavender-light text-lavender-dark"
          }`}
        >
          <p>
            {a.message}
            {a.type === "PLAID_REAUTH" && (
              <Link href="/accounts" className="underline ml-1">
                Fix it
              </Link>
            )}
          </p>
          <button
            onClick={() => dismiss(a.id)}
            aria-label="Dismiss alert"
            className="shrink-0 opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
