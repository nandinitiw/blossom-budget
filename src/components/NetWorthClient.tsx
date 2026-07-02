"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { money, shortDate } from "@/lib/format";
import type { NetWorthBreakdown } from "@/lib/networth";

type Snapshot = { date: string; netWorth: number; assets: number; liabilities: number };
type AccountRow = { id: string; name: string; type: string; mask: string | null; balance: number };
type ManualRow = { id: string; name: string; type: "ASSET" | "LIABILITY"; balance: number };

export function NetWorthClient({
  breakdown,
  snapshots,
  accounts,
  manualEntries,
}: {
  breakdown: NetWorthBreakdown;
  snapshots: Snapshot[];
  accounts: AccountRow[];
  manualEntries: ManualRow[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"ASSET" | "LIABILITY">("ASSET");
  const [balance, setBalance] = useState("");

  const chartData = snapshots.map((s) => ({
    label: shortDate(s.date),
    "Net worth": s.netWorth,
  }));

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/manual-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, balance: parseFloat(balance) }),
    });
    setAdding(false);
    setName("");
    setBalance("");
    router.refresh();
  }

  async function updateEntry(id: string, newBalance: string) {
    const value = parseFloat(newBalance);
    if (Number.isNaN(value) || value < 0) return;
    await fetch(`/api/manual-entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balance: value }),
    });
    router.refresh();
  }

  async function removeEntry(id: string) {
    if (!confirm("Remove this entry?")) return;
    await fetch(`/api/manual-entries/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const inputCls =
    "rounded-lg border border-lavender-light bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lavender/50";

  const plaidAssets = accounts.filter((a) => a.type !== "credit" && a.type !== "loan");
  const plaidDebts = accounts.filter((a) => a.type === "credit" || a.type === "loan");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Net worth</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-lavender-light p-5">
          <p className="text-sm text-lavender-dark mb-1">Net worth</p>
          <p
            className={`text-2xl font-bold ${
              breakdown.netWorth < 0 ? "text-negative" : "text-lavender-dark"
            }`}
          >
            {money(breakdown.netWorth)}
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-lavender-light p-5">
          <p className="text-sm text-muted mb-1">Assets</p>
          <p className="text-2xl font-bold text-positive">{money(breakdown.assets)}</p>
        </div>
        <div className="rounded-2xl bg-white border border-lavender-light p-5">
          <p className="text-sm text-muted mb-1">Liabilities</p>
          <p className="text-2xl font-bold text-blossom-dark">
            {money(breakdown.liabilities)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-lavender-light p-5">
        <h2 className="font-semibold mb-3">Over time</h2>
        {chartData.length < 2 ? (
          <p className="text-sm text-muted py-8 text-center">
            Snapshots are recorded daily — check back in a few days to see your
            trend line grow.
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} stroke="#EEEDFE" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "#6E6879" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                />
                <YAxis
                  tickFormatter={(v) => money(v, { whole: true })}
                  tick={{ fontSize: 12, fill: "#6E6879" }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  formatter={(value) => money(Number(value))}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #EEEDFE",
                    fontSize: 13,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="Net worth"
                  stroke="#7F77DD"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: "#D4537E" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-lavender-light p-5">
          <h2 className="font-semibold mb-3">Connected accounts</h2>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted">No accounts connected yet.</p>
          ) : (
            <ul className="space-y-2">
              {[...plaidAssets, ...plaidDebts].map((a) => (
                <li key={a.id} className="flex items-center justify-between text-sm">
                  <span>
                    {a.name}
                    {a.mask && <span className="text-muted"> ··{a.mask}</span>}
                  </span>
                  <span
                    className={`font-medium ${
                      a.type === "credit" || a.type === "loan"
                        ? "text-blossom-dark"
                        : ""
                    }`}
                  >
                    {a.type === "credit" || a.type === "loan" ? "−" : ""}
                    {money(a.balance)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-lavender-light p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Manual assets & liabilities</h2>
            <button
              onClick={() => setAdding((v) => !v)}
              className="text-sm font-medium text-lavender-dark hover:underline"
            >
              {adding ? "Cancel" : "＋ Add"}
            </button>
          </div>

          {adding && (
            <form onSubmit={addEntry} className="flex flex-wrap items-end gap-2 mb-4">
              <input
                required
                placeholder="e.g. Brokerage, Car loan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`${inputCls} flex-1 min-w-36`}
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "ASSET" | "LIABILITY")}
                className={inputCls}
              >
                <option value="ASSET">Asset</option>
                <option value="LIABILITY">Liability</option>
              </select>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="$"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className={`${inputCls} w-28`}
              />
              <button
                type="submit"
                className="rounded-lg bg-blossom hover:bg-blossom-dark text-white text-sm font-semibold px-3 py-2 transition-colors"
              >
                Save
              </button>
            </form>
          )}

          {manualEntries.length === 0 && !adding ? (
            <p className="text-sm text-muted">
              Track things Plaid can&apos;t see — investment accounts, property,
              or loans — so your net worth is complete.
            </p>
          ) : (
            <ul className="space-y-2">
              {manualEntries.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex-1 truncate">
                    {m.name}
                    <span className="text-xs text-muted ml-1.5">
                      {m.type === "ASSET" ? "asset" : "liability"}
                    </span>
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={m.balance}
                    onBlur={(e) => updateEntry(m.id, e.target.value)}
                    className="rounded-lg border border-lavender-light px-2 py-1 text-xs w-28 text-right focus:outline-none focus:ring-2 focus:ring-lavender/50"
                    aria-label={`${m.name} balance`}
                  />
                  <button
                    onClick={() => removeEntry(m.id)}
                    className="text-xs text-muted hover:text-negative transition-colors"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
