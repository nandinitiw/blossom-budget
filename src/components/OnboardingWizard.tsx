"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string; color: string };

const INCOME_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every two weeks" },
  { value: "semimonthly", label: "Twice a month" },
  { value: "monthly", label: "Monthly" },
  { value: "irregular", label: "It varies" },
] as const;

const PRIORITY_OPTIONS = [
  {
    value: "saving",
    emoji: "🌱",
    label: "Growing my savings",
    blurb: "Build toward goals and watch your balance climb.",
  },
  {
    value: "debt_payoff",
    emoji: "💪",
    label: "Paying off debt",
    blurb: "Track balances down and keep spending in check.",
  },
  {
    value: "awareness",
    emoji: "🔍",
    label: "Knowing where my money goes",
    blurb: "Clear picture of spending, no judgment.",
  },
] as const;

// Suggested monthly budgets per category, tuned by priority
const SUGGESTED: Record<string, number> = {
  Groceries: 400,
  Dining: 200,
  Transport: 150,
  Subscriptions: 60,
  Shopping: 150,
  Entertainment: 100,
  Health: 100,
  Travel: 100,
  Utilities: 200,
  "Rent & Housing": 1500,
};

export function OnboardingWizard({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [incomeFrequency, setIncomeFrequency] =
    useState<(typeof INCOME_OPTIONS)[number]["value"]>("biweekly");
  const [priority, setPriority] =
    useState<(typeof PRIORITY_OPTIONS)[number]["value"]>("awareness");
  const [budgetPeriod, setBudgetPeriod] = useState<"WEEKLY" | "MONTHLY">("MONTHLY");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(
      categories
        .filter((c) => ["Groceries", "Dining", "Transport", "Subscriptions"].includes(c.name))
        .map((c) => c.id)
    )
  );
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tighter suggestions when the focus is saving/debt payoff
  const factor = priority === "awareness" ? 1 : 0.85;
  const periodFactor = budgetPeriod === "WEEKLY" ? 1 / 4.33 : 1;

  const suggestionFor = (c: Category) =>
    Math.round((SUGGESTED[c.name] ?? 100) * factor * periodFactor);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function finish() {
    setSaving(true);
    setError(null);
    const budgets = categories
      .filter((c) => selected.has(c.id))
      .map((c) => ({
        categoryId: c.id,
        amount: parseFloat(amounts[c.id] ?? "") || suggestionFor(c),
      }));
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incomeFrequency, financialPriority: priority, budgetPeriod, budgets }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Something went wrong — please try again.");
      return;
    }
    router.push("/accounts");
    router.refresh();
  }

  const steps = ["Income", "Priorities", "Budgets"];

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-3xl">🌸</span>
        <h1 className="text-2xl font-bold mt-2">Let&apos;s set you up</h1>
        <p className="text-sm text-muted mt-1">
          Three quick questions to personalize Blossom for you.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                i < step
                  ? "bg-lavender text-white"
                  : i === step
                    ? "bg-blossom text-white"
                    : "bg-lavender-light text-muted"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span className={`text-xs font-medium ${i === step ? "text-ink" : "text-muted"}`}>
              {label}
            </span>
            {i < steps.length - 1 && <span className="w-6 h-px bg-lavender-light" />}
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white border border-lavender-light p-6">
        {step === 0 && (
          <div>
            <h2 className="font-semibold mb-4">How often do you get paid?</h2>
            <div className="space-y-2">
              {INCOME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setIncomeFrequency(opt.value)}
                  className={`w-full text-left rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                    incomeFrequency === opt.value
                      ? "border-blossom bg-blossom-light/40 text-blossom-dark"
                      : "border-lavender-light hover:border-lavender"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="font-semibold mb-4">What matters most right now?</h2>
            <div className="space-y-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPriority(opt.value)}
                  className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                    priority === opt.value
                      ? "border-blossom bg-blossom-light/40"
                      : "border-lavender-light hover:border-lavender"
                  }`}
                >
                  <span className="text-sm font-semibold">
                    {opt.emoji} {opt.label}
                  </span>
                  <p className="text-xs text-muted mt-0.5">{opt.blurb}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-semibold mb-1">Pick categories to budget</h2>
            <p className="text-xs text-muted mb-4">
              We&apos;ve suggested amounts based on your priorities — tweak any of
              them, or adjust later in Budgets.
            </p>
            <div className="flex gap-2 mb-4">
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
                  {p === "MONTHLY" ? "Monthly budgets" : "Weekly budgets"}
                </button>
              ))}
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                    selected.has(c.id) ? "border-blossom bg-blossom-light/20" : "border-lavender-light"
                  }`}
                >
                  <input
                    type="checkbox"
                    id={`cat-${c.id}`}
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="accent-[#D4537E] w-4 h-4"
                  />
                  <label htmlFor={`cat-${c.id}`} className="flex-1 text-sm font-medium flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </label>
                  {selected.has(c.id) && (
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-muted">$</span>
                      <input
                        type="number"
                        min="1"
                        value={amounts[c.id] ?? suggestionFor(c)}
                        onChange={(e) =>
                          setAmounts((prev) => ({ ...prev, [c.id]: e.target.value }))
                        }
                        className="w-20 rounded-lg border border-lavender-light px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-lavender/50"
                        aria-label={`${c.name} budget`}
                      />
                      <span className="text-xs text-muted">
                        /{budgetPeriod === "WEEKLY" ? "wk" : "mo"}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-negative mt-4">{error}</p>}

        <div className="flex justify-between mt-6">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="rounded-lg border border-lavender-light px-4 py-2 text-sm font-medium text-muted hover:bg-lavender-light/60 transition-colors"
            >
              ← Back
            </button>
          ) : (
            <span />
          )}
          {step < 2 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="rounded-lg bg-blossom hover:bg-blossom-dark text-white text-sm font-semibold px-5 py-2 transition-colors"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              className="rounded-lg bg-blossom hover:bg-blossom-dark text-white text-sm font-semibold px-5 py-2 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : "Finish & connect a bank →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
