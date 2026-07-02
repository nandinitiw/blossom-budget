"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { money } from "@/lib/format";

export function CategoryDonut({
  data,
}: {
  data: { name: string; amount: number; color: string }[];
}) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-10">
        No spending yet this month.
      </p>
    );
  }
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="name"
            innerRadius="60%"
            outerRadius="90%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => money(Number(value))}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #EEEDFE",
              fontSize: 13,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
