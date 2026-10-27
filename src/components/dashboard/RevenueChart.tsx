"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useBrewStore } from "@/store/machine-store";
import { revenueByProduct } from "@/store/selectors";
import { formatINR } from "@/lib/currency";
import { cn } from "@/lib/cn";

interface TipProps {
  active?: boolean;
  payload?: Array<{ payload: { name: string; revenue: number; units: number } }>;
}

function ChartTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-ink-750 px-3 py-2 text-[12px] shadow-xl">
      <p className="font-medium text-ivory">{row.name}</p>
      <p className="tabular text-ivory-dim">
        {formatINR(row.revenue)} · {row.units} sold
      </p>
    </div>
  );
}

/** Single-series bar chart of paid revenue per product, with a table view. */
export function RevenueChart() {
  const orders = useBrewStore((s) => s.orders);
  const data = revenueByProduct(orders).slice(0, 8);
  const [asTable, setAsTable] = useState(false);

  return (
    <section aria-labelledby="rev-title" className="rounded-2xl border border-white/[0.06] bg-ink-850/80 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="rev-title" className="eyebrow">
          Revenue by product
        </h2>
        {data.length > 0 && (
          <div className="flex rounded-md bg-black/30 p-0.5 text-[11px]" role="group" aria-label="Chart view">
            {(["Chart", "Table"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={(v === "Table") === asTable}
                onClick={() => setAsTable(v === "Table")}
                className={cn("rounded px-2 py-0.5", (v === "Table") === asTable ? "bg-white/10 text-ivory" : "text-faint hover:text-ivory-dim")}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>
      {data.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-faint">Revenue appears here after the first paid order.</p>
      ) : asTable ? (
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              <th className="pb-2 text-left font-normal">Product</th>
              <th className="pb-2 text-right font-normal">Units</th>
              <th className="pb-2 text-right font-normal">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.name} className="border-t border-white/[0.04]">
                <td className="py-1.5 text-ivory-dim">{d.name}</td>
                <td className="tabular py-1.5 text-right text-faint">{d.units}</td>
                <td className="tabular py-1.5 text-right text-ivory">{formatINR(d.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="h-52" role="img" aria-label={`Revenue by product: ${data.map((d) => `${d.name} ${formatINR(d.revenue)}`).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ fill: "#8d877b", fontSize: 10.5 }}
                tickFormatter={(n: string) => (n.length > 10 ? `${n.slice(0, 9)}…` : n)}
              />
              <YAxis tickLine={false} axisLine={false} width={52} tick={{ fill: "#5f5a52", fontSize: 10 }} tickFormatter={(v: number) => formatINR(v)} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="revenue" fill="#c99a6a" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
