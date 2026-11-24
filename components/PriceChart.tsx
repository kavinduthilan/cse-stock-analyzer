"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const periods: [string, string][] = [
  ["1", "1D"],
  ["2", "1W"],
  ["3", "1M"],
  ["4", "3M"],
  ["5", "1Y"],
];

type Point = { t: number; p: number };

function extract(data: any): Point[] {
  const arr: any[] = Array.isArray(data)
    ? data
    : (Object.values(data ?? {}).find(Array.isArray) as any[]) ?? [];

  return arr
    .map((d) => ({
      t: Number(d.t ?? d.time ?? d.date),
      p: Number(d.p ?? d.c ?? d.close ?? d.price),
    }))
    .filter((d) => Number.isFinite(d.t) && Number.isFinite(d.p))
    .sort((a, b) => a.t - b.t);
}

export default function PriceChart({
  stockId,
  symbol,
}: {
  stockId?: number | string;
  symbol: string;
}) {
  const [period, setPeriod] = useState("3");
  const [raw, setRaw] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sma, setSma] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setRaw(null);
    setErr(null);

    const [endpoint, body] = stockId
      ? ["companyChartDataByStock", { stockId, period }]
      : ["chartData", { symbol, chartId: 1, period }];

    console.log("chart request", endpoint, body);

    fetch(`/api/cse/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        console.log("chart response", j);
        setRaw(j);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        console.error("chart error", e);
        setErr(String(e?.message ?? e));
      });

    return () => ctrl.abort();
  }, [stockId, symbol, period]);

  const series = useMemo(() => {
    const pts = extract(raw);
    return pts.map((d, i) => {
      const w = pts.slice(Math.max(0, i - 19), i + 1);
      return {
        ...d,
        sma: w.length === 20 ? w.reduce((s, x) => s + x.p, 0) / 20 : null,
      };
    });
  }, [raw]);

  const fmtT = (t: number) =>
    new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex gap-1" role="group" aria-label="Chart period">
          {periods.map(([v, l]) => (
            <button
              key={v}
              onClick={() => setPeriod(v)}
              aria-pressed={period === v}
              className={`px-3 py-1 text-sm rounded-md border ${
                period === v
                  ? "bg-ink text-white border-ink"
                  : "border-line hover:bg-paper"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={sma}
            onChange={(e) => setSma(e.target.checked)}
          />{" "}
          20-point average
        </label>
      </div>

      {/* Explicit pixel height: ResponsiveContainer renders nothing if its parent has 0 height */}
      <div style={{ width: "100%", height: 288 }}>
        {err ? (
          <p className="text-sm text-loss">Could not load chart data ({err}).</p>
        ) : !raw ? (
          <p className="text-sm text-muted">Loading chart…</p>
        ) : series.length === 0 ? (
          <p className="text-sm text-muted">No chart points for this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series}>
              <CartesianGrid stroke="#d8e0e3" strokeDasharray="3 3" />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={fmtT}
                fontSize={12}
                minTickGap={32}
              />
              <YAxis domain={["auto", "auto"]} fontSize={12} width={56} />
              <Tooltip
                labelFormatter={(t) => new Date(Number(t)).toLocaleString("en-GB")}
                formatter={(v: any) => Number(v).toFixed(2)}
              />
              <Area
                type="monotone"
                dataKey="p"
                name="Price"
                stroke="#0e6e73"
                fill="#0e6e73"
                fillOpacity={0.12}
                dot={false}
                isAnimationActive={false}
              />
              {sma && (
                <Line
                  type="monotone"
                  dataKey="sma"
                  name="Average"
                  stroke="#c8372d"
                  dot={false}
                  strokeWidth={1.5}
                  connectNulls
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}