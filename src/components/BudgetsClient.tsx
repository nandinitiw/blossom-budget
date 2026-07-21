"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import type { BudgetWithProgress } from "@/lib/budgets";

const STATUS_BAR: Record<string, string> = {
  under: "bg-lavender",
  warning: "bg-blossom/70",
  exceeded: "bg-negative",
};

export function BudgetsClient({
  budgets,
  categories,
  defaultPeriod,
}: {
  budgets: BudgetWithProgress[];
  categories: { id: string; name: string; color: string }[];
  defaultPeriod: "WEEKLY" | "MONTHLY";
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<"WEEKLY" | "MONTHLY">(defaultPeriod);
  const [error, setError] = useState<string | null>(null);

  // Inline edit state (one budget at a time)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editPeriod, setEditPeriod] = useState<"WEEKLY" | "MONTHLY">("MONTHLY");

  function startEdit(b: BudgetWithProgress) {
    setEditingId(b.id);
    setEditAmount(String(b.amount));
    setEditPeriod(b.period);
  }

  const unbudgeted = categories.filter(
    (c) => !budgets.some((b) => b.categoryId === c.id)
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, amount: parseFloat(amount), period }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save budget.");
      return;
    }
    setAdding(false);
    setCategoryId("");
    setAmount("");
    router.refresh();
  }

  async function saveEdit(b: BudgetWithProgress) {
    const value = parseFloat(editAmount);
    if (!value || value <= 0) {
      setEditingId(null);
      return;
    }
    if (value !== b.amount || editPeriod !== b.period) {
      await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: b.categoryId, amount: value, period: editPeriod }),
      });
    }
    setEditingId(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this budget?")) return;
    await fetch(`/api/budgets/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const inputCls =
    "rounded-lg border border-lavender-light bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lavender/50";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Budgets</h1>
        {unbudgeted.length > 0 && (
          <button
            onClick={() => setAdding((v) => !v)}
            className="rounded-lg bg-blossom hover:bg-blossom-dark text-white text-sm font-semibold px-4 py-2 transition-colors"
          >
            {adding ? "Cancel" : "＋ Add budget"}
          </button>
        )}
      </div>

      {adding && (
        <form
          onSubmit={save}
          className="rounded-2xl bg-white border border-lavender-light p-4 flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Category</label>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputCls}
            >
              <option value="">Choose…</option>
              {unbudgeted.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Limit ($)</label>
            <input
              type="number"
              required
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputCls} w-28`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as "WEEKLY" | "MONTHLY")}
              className={inputCls}
            >
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-blossom hover:bg-blossom-dark text-white text-sm font-semibold px-4 py-2 transition-colors"
          >
            Save
          </button>
          {error && <p className="text-sm text-negative w-full">{error}</p>}
        </form>
      )}

      {budgets.length === 0 && !adding ? (
        <div className="rounded-2xl border border-dashed border-lavender bg-lavender-light/50 p-10 text-center">
          <p className="text-3xl mb-3">🎯</p>
          <h2 className="font-semibold mb-1">No budgets yet</h2>
          <p className="text-sm text-muted max-w-sm mx-auto">
            Set a monthly or weekly limit per category and Blossom will track
            your progress and warn you at 80%.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {budgets.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl bg-white border border-lavender-light p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 font-semibold">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: b.categoryColor }}
                  />
                  {b.categoryName}
                </span>
                <span className="text-xs text-muted capitalize">
                  {b.period.toLowerCase()}
                </span>
              </div>
              <div
                className="h-3 rounded-full bg-lavender-light overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.min(100, b.pct)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full transition-all ${STATUS_BAR[b.status]}`}
                  style={{ width: `${Math.min(100, b.pct)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-sm">
                <span>
                  <span
                    className={`font-semibold ${
                      b.status === "exceeded"
                        ? "text-negative"
                        : b.status === "warning"
                          ? "text-blossom-dark"
                          : ""
                    }`}
                  >
                    {money(b.spent)}
                  </span>{" "}
                  <span className="text-muted">of {money(b.amount)}</span>
                </span>
                <span
                  className={`text-xs font-semibold ${
                    b.status === "exceeded"
                      ? "text-negative"
                      : b.status === "warning"
                        ? "text-blossom-dark"
                        : "text-positive"
                  }`}
                >
                  {b.pct}%
                </span>
              </div>
              {editingId === b.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveEdit(b);
                  }}
                  className="flex flex-wrap items-end gap-2 mt-3"
                >
                  <div>
                    <label className="block text-[11px] font-medium text-muted mb-0.5">
                      Limit ($)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      autoFocus
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="rounded-lg border border-lavender-light px-2 py-1 text-xs w-24 focus:outline-none focus:ring-2 focus:ring-lavender/50"
                      aria-label={`${b.categoryName} limit`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-muted mb-0.5">
                      Period
                    </label>
                    <select
                      value={editPeriod}
                      onChange={(e) => setEditPeriod(e.target.value as "WEEKLY" | "MONTHLY")}
                      className="rounded-lg border border-lavender-light px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-lavender/50"
                      aria-label={`${b.categoryName} period`}
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="WEEKLY">Weekly</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-blossom hover:bg-blossom-dark text-white text-xs font-semibold px-3 py-1.5 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-xs text-muted hover:text-ink px-1 transition-colors"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between mt-3">
                  <button
                    onClick={() => startEdit(b)}
                    className="text-xs font-medium text-lavender-dark hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(b.id)}
                    className="text-xs text-muted hover:text-negative transition-colors"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
