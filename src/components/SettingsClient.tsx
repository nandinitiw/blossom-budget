"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type UserSettings = {
  name: string;
  email: string;
  emailWeekly: boolean;
  emailMonthly: boolean;
  budgetPeriod: "WEEKLY" | "MONTHLY";
  financialPriority: string;
};

type CategoryRow = {
  id: string;
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
};

export function SettingsClient({
  user,
  categories,
  plaidUsage,
}: {
  user: UserSettings;
  categories: CategoryRow[];
  plaidUsage: { count: number; limit: number; nearCap: boolean; atCap: boolean };
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [emailWeekly, setEmailWeekly] = useState(user.emailWeekly);
  const [emailMonthly, setEmailMonthly] = useState(user.emailMonthly);
  const [budgetPeriod, setBudgetPeriod] = useState(user.budgetPeriod);
  const [saved, setSaved] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [newCatColor, setNewCatColor] = useState("#7F77DD");
  const [catError, setCatError] = useState<string | null>(null);

  async function saveProfile() {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, emailWeekly, emailMonthly, budgetPeriod }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  async function patchCategory(id: string, body: Record<string, string>) {
    setCatError(null);
    const res = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCatError(data.error ?? "Update failed.");
    }
    router.refresh();
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setCatError(null);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCat, color: newCatColor }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCatError(data.error ?? "Could not add category.");
      return;
    }
    setNewCat("");
    router.refresh();
  }

  async function deleteCategory(id: string, catName: string) {
    if (
      !confirm(
        `Delete "${catName}"? Its transactions become uncategorized and its budget is removed.`
      )
    )
      return;
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const inputCls =
    "rounded-lg border border-lavender-light bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lavender/50";

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Profile & preferences */}
      <section className="rounded-2xl bg-white border border-lavender-light p-5 space-y-4">
        <h2 className="font-semibold">Profile & preferences</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} w-full`} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input value={user.email} disabled className={`${inputCls} w-full opacity-60`} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Default budget period</label>
          <div className="flex gap-2">
            {(["MONTHLY", "WEEKLY"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setBudgetPeriod(p)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                  budgetPeriod === p
                    ? "bg-lavender text-white border-lavender"
                    : "border-lavender-light text-muted hover:border-lavender"
                }`}
              >
                {p === "MONTHLY" ? "Monthly" : "Weekly"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Email reports</p>
          <label className="flex items-center gap-3 py-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={emailWeekly}
              onChange={(e) => setEmailWeekly(e.target.checked)}
              className="accent-[#D4537E] w-4 h-4"
            />
            <span className="text-sm">
              Weekly summary <span className="text-muted">(Mondays — last week&apos;s spending, budgets & goals)</span>
            </span>
          </label>
          <label className="flex items-center gap-3 py-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={emailMonthly}
              onChange={(e) => setEmailMonthly(e.target.checked)}
              className="accent-[#D4537E] w-4 h-4"
            />
            <span className="text-sm">
              Monthly summary <span className="text-muted">(1st of the month — full month recap)</span>
            </span>
          </label>
        </div>

        <button
          onClick={saveProfile}
          className="rounded-lg bg-blossom hover:bg-blossom-dark text-white text-sm font-semibold px-4 py-2 transition-colors"
        >
          {saved ? "Saved ✓" : "Save changes"}
        </button>
      </section>

      {/* Categories */}
      <section className="rounded-2xl bg-white border border-lavender-light p-5 space-y-4">
        <h2 className="font-semibold">Categories</h2>
        <p className="text-xs text-muted">
          Rename, recolor, or change the emoji for any category — changes apply
          everywhere, including charts and budgets.
        </p>
        {catError && <p className="text-sm text-negative">{catError}</p>}
        <ul className="space-y-2">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <input
                defaultValue={c.icon.length <= 4 ? c.icon : "🏷️"}
                onBlur={(e) => {
                  if (e.target.value !== c.icon) patchCategory(c.id, { icon: e.target.value });
                }}
                className="w-10 text-center rounded-lg border border-lavender-light py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lavender/50"
                aria-label={`${c.name} icon`}
                maxLength={4}
              />
              <input
                type="color"
                defaultValue={c.color}
                onBlur={(e) => {
                  if (e.target.value !== c.color) patchCategory(c.id, { color: e.target.value });
                }}
                className="w-8 h-8 rounded cursor-pointer border border-lavender-light"
                aria-label={`${c.name} color`}
              />
              <input
                defaultValue={c.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== c.name) patchCategory(c.id, { name: v });
                }}
                className={`${inputCls} flex-1`}
                aria-label="Category name"
              />
              <button
                onClick={() => deleteCategory(c.id, c.name)}
                className="text-xs text-muted hover:text-negative px-1 transition-colors"
                aria-label={`Delete ${c.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addCategory} className="flex items-center gap-2 pt-1">
          <input
            type="color"
            value={newCatColor}
            onChange={(e) => setNewCatColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-lavender-light"
            aria-label="New category color"
          />
          <input
            required
            placeholder="New category name…"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            className={`${inputCls} flex-1`}
          />
          <button
            type="submit"
            className="rounded-lg bg-lavender-light hover:bg-lavender/20 text-lavender-dark text-sm font-semibold px-3 py-2 transition-colors"
          >
            Add
          </button>
        </form>
      </section>

      {/* Plaid usage */}
      <section className="rounded-2xl bg-white border border-lavender-light p-5">
        <h2 className="font-semibold mb-2">Bank connections</h2>
        <p className="text-sm text-muted mb-2">
          {plaidUsage.count} of {plaidUsage.limit} Plaid Trial connections used.
        </p>
        <div className="h-2 rounded-full bg-lavender-light overflow-hidden mb-3">
          <div
            className={`h-full rounded-full ${plaidUsage.nearCap ? "bg-blossom" : "bg-lavender"}`}
            style={{ width: `${Math.min(100, (plaidUsage.count / plaidUsage.limit) * 100)}%` }}
          />
        </div>
        <Link href="/accounts" className="text-sm font-medium text-lavender-dark hover:underline">
          Manage connections →
        </Link>
      </section>

      {/* Data export */}
      <section className="rounded-2xl bg-white border border-lavender-light p-5">
        <h2 className="font-semibold mb-2">Export your data</h2>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/export/transactions"
            className="rounded-lg bg-lavender-light hover:bg-lavender/20 text-lavender-dark text-sm font-semibold px-3 py-2 transition-colors"
          >
            ⬇ All transactions (CSV)
          </a>
          <a
            href="/api/export/summary"
            className="rounded-lg bg-lavender-light hover:bg-lavender/20 text-lavender-dark text-sm font-semibold px-3 py-2 transition-colors"
          >
            ⬇ Monthly summary (PDF)
          </a>
        </div>
      </section>
    </div>
  );
}
