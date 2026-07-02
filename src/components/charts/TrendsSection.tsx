"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { money } from "@/lib/format";

type SeriesPoint = { label: string; total: number } & Record<string, number | string>;

export function TrendsSection({
  categories,
  accounts,
}: {
  categories: { id: string; name: string; color: string }[];
  accounts: { id: string; name: string }[];
}) {
  const [granularity, setGranularity] = useState<"monthly" | "weekly">("monthly");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [catMeta, setCatMeta] = useState<{ name: string; color: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ granularity });
    if (categoryId) params.set("categoryId", categoryId);
    if (accountId) params.set("accountId", accountId);
    const res = await fetch(`/api/analytics/trends?${params}`);
    if (res.ok) {
      const data = await res.json();
      setSeries(data.series);
      setCatMeta(data.categories);
    }
    setLoading(false);
  }, [granularity, categoryId, accountId]);

  useEffect(() => {
    load();
  }, [load]);

  // Stack by category unless filtered to a single one
  const activeCats = categoryId
    ? catMeta.filter((c) => c.name === categories.find((x) => x.id === categoryId)?.name)
    : catMeta;
  const stacked = activeCats.filter((c) =>
    series.some((p) => Number(p[c.name] ?? 0) > 0)
  );

  const selectCls =
    "rounded-lg border border-lavender-light bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lavender/50";

  return (
    <div className="rounded-2xl bg-white border border-lavender-light p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold">Spending trends</h2>
        <div className="flex flex-wrap gap-2">
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as "monthly" | "weekly")}
            className={selectCls}
            aria-label="Granularity"
          >
            <option value="monthly">Monthly · 6mo</option>
            <option value="weekly">Weekly · 12wk</option>
          </select>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={selectCls}
            aria-label="Category filter"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className={selectCls}
            aria-label="Account filter"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-sm text-muted">
          Loading…
        </div>
      ) : series.every((p) => p.total === 0) ? (
        <div className="h-64 flex items-center justify-center text-sm text-muted">
          No spending in this range yet — connect a bank or adjust filters.
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} stroke="#EEEDFE" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "#6E6879" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => money(v, { whole: true })}
                tick={{ fontSize: 12, fill: "#6E6879" }}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip
                formatter={(value, name) => [money(Number(value)), name]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #EEEDFE",
                  fontSize: 13,
                }}
              />
              {stacked.map((c) => (
                <Bar
                  key={c.name}
                  dataKey={c.name}
                  stackId="spend"
                  fill={c.color}
                  radius={[0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
