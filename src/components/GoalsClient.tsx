"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money, fullDate } from "@/lib/format";
import type { GoalProgress } from "@/lib/goals";

type GoalRow = {
  id: string;
  name: string;
  type: "SAVE" | "SPEND_LIMIT" | "DEBT_PAYOFF";
  deadline: string | null;
  categoryName: string | null;
  accountName: string | null;
  progress: GoalProgress;
};

const TYPE_LABEL = {
  SAVE: "Savings",
  SPEND_LIMIT: "Spending limit",
  DEBT_PAYOFF: "Debt payoff",
};

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  on_track: { label: "On track", cls: "bg-lavender-light text-lavender-dark" },
  at_risk: { label: "At risk", cls: "bg-blossom-light text-blossom-dark" },
  exceeded: { label: "Over limit", cls: "bg-blossom-light text-negative" },
  achieved: { label: "Achieved 🎉", cls: "bg-lavender-light text-positive" },
};

export function GoalsClient({
  goals,
  categories,
  accounts,
}: {
  goals: GoalRow[];
  categories: { id: string; name: string }[];
  accounts: { id: string; name: string; type: string; mask: string | null }[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<GoalRow["type"]>("SAVE");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);

  const summary = {
    on_track: goals.filter((g) => ["on_track", "achieved"].includes(g.progress.status)).length,
    at_risk: goals.filter((g) => g.progress.status === "at_risk").length,
    exceeded: goals.filter((g) => g.progress.status === "exceeded").length,
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        type,
        targetAmount: parseFloat(target),
        categoryId: type === "SPEND_LIMIT" ? categoryId : undefined,
        accountId: type !== "SPEND_LIMIT" ? accountId : undefined,
        deadline: deadline || undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create goal.");
      return;
    }
    setAdding(false);
    setName("");
    setTarget("");
    setDeadline("");
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this goal?")) return;
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const inputCls =
    "rounded-lg border border-lavender-light bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lavender/50";

  const goalAccounts =
    type === "DEBT_PAYOFF"
      ? accounts.filter((a) => a.type === "credit" || a.type === "loan")
      : accounts.filter((a) => a.type !== "credit");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Goals</h1>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-lg bg-blossom hover:bg-blossom-dark text-white text-sm font-semibold px-4 py-2 transition-colors"
        >
          {adding ? "Cancel" : "＋ New goal"}
        </button>
      </div>

      {goals.length > 0 && (
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-lavender-light text-lavender-dark px-3 py-1 font-medium">
            {summary.on_track} on track
          </span>
          {summary.at_risk > 0 && (
            <span className="rounded-full bg-blossom-light text-blossom-dark px-3 py-1 font-medium">
              {summary.at_risk} at risk
            </span>
          )}
          {summary.exceeded > 0 && (
            <span className="rounded-full bg-blossom-light text-negative px-3 py-1 font-medium">
              {summary.exceeded} over limit
            </span>
          )}
        </div>
      )}

      {adding && (
        <form
          onSubmit={save}
          className="rounded-2xl bg-white border border-lavender-light p-4 space-y-3"
        >
          <div className="flex flex-wrap gap-2">
            {(["SAVE", "SPEND_LIMIT", "DEBT_PAYOFF"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                  type === t
                    ? "bg-lavender text-white border-lavender"
                    : "border-lavender-light text-muted hover:border-lavender"
                }`}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-muted mb-1">Goal name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  type === "SAVE"
                    ? "Save $2,000 by December"
                    : type === "SPEND_LIMIT"
                      ? "Keep Dining under $300/month"
                      : "Pay off credit card"
                }
                className={`${inputCls} w-full`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                {type === "SPEND_LIMIT" ? "Monthly limit ($)" : "Target ($)"}
              </label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className={`${inputCls} w-28`}
              />
            </div>
            {type === "SPEND_LIMIT" ? (
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Category</label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Choose…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  {type === "SAVE" ? "Savings account" : "Card / loan"}
                </label>
                <select
                  required
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Choose…</option>
                  {goalAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.mask ? ` ··${a.mask}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {type !== "SPEND_LIMIT" && (
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  Deadline (optional)
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}
            <button
              type="submit"
              className="rounded-lg bg-blossom hover:bg-blossom-dark text-white text-sm font-semibold px-4 py-2 transition-colors"
            >
              Create goal
            </button>
          </div>
          {error && <p className="text-sm text-negative">{error}</p>}
          {goalAccounts.length === 0 && type !== "SPEND_LIMIT" && (
            <p className="text-xs text-muted">
              No {type === "DEBT_PAYOFF" ? "credit/loan" : "bank"} accounts found —
              connect one on the Accounts page first.
            </p>
          )}
        </form>
      )}

      {goals.length === 0 && !adding ? (
        <div className="rounded-2xl border border-dashed border-lavender bg-lavender-light/50 p-10 text-center">
          <p className="text-3xl mb-3">🌱</p>
          <h2 className="font-semibold mb-1">No goals yet</h2>
          <p className="text-sm text-muted max-w-sm mx-auto">
            Create a savings target, a category spending limit, or a debt payoff
            plan — progress updates automatically from your real balances and
            transactions.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((g) => {
            const chip = STATUS_CHIP[g.progress.status];
            return (
              <div
                key={g.id}
                className="rounded-2xl bg-white border border-lavender-light p-5"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <p className="font-semibold">{g.name}</p>
                    <p className="text-xs text-muted">
                      {TYPE_LABEL[g.type]}
                      {g.categoryName && ` · ${g.categoryName}`}
                      {g.accountName && ` · ${g.accountName}`}
                      {g.deadline && ` · by ${fullDate(g.deadline)}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-semibold rounded-full px-2.5 py-1 ${chip.cls}`}
                  >
                    {chip.label}
                  </span>
                </div>
                <div
                  className="h-3 rounded-full bg-lavender-light overflow-hidden mt-3"
                  role="progressbar"
                  aria-valuenow={Math.min(100, g.progress.pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`h-full rounded-full transition-all ${
                      g.progress.status === "exceeded"
                        ? "bg-negative"
                        : g.progress.status === "at_risk"
                          ? "bg-blossom/70"
                          : "bg-lavender"
                    }`}
                    style={{ width: `${Math.min(100, g.progress.pct)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span>
                    <span className="font-semibold">{money(g.progress.current)}</span>{" "}
                    <span className="text-muted">
                      of {money(g.progress.target)}
                      {g.type === "SPEND_LIMIT" && "/mo"}
                    </span>
                  </span>
                  <button
                    onClick={() => remove(g.id)}
                    className="text-xs text-muted hover:text-negative transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
