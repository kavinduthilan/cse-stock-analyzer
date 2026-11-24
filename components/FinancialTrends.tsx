"use client";

import { useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

type Annual = {
  period_end: string;
  eps: number | null; eps_source: string;
  nav: number | null; nav_source: string;
  roe_pct: number | null; roa_pct: number | null;
  equity_to_assets_pct: number | null; nii_to_income_pct: number | null;
};
type Q = { period_end: string; value: number };

// 2021-03-31 -> "2020/21" (fiscal year ending 31 March)
const fyLabel = (d: string) => {
  const y = Number(d.slice(0, 4));
  return `${y - 1}/${String(y).slice(2)}`;
};
// quarter ends keep the plain month label: 2021-03
const qLabel = (d: string) => d.slice(0, 7);

const f2 = (v: number | null) => (v == null ? "n/a" : v.toFixed(2));

function YearChart({ title, data, keyName, name, color, className = "" }: {
  title: string; data: any[]; keyName: string; name: string; color: string; className?: string;
}) {
  return (
    <div className={`panel p-4 ${className}`}>
      <div className="mb-2 text-sm font-medium">{title}</div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" fontSize={12} interval={0} />
          <YAxis fontSize={12} />
          <Tooltip formatter={(v: number) => (v == null ? "n/a" : v.toFixed(2))} />
          <Bar dataKey={keyName} name={name} fill={color} radius={[3, 3, 0, 0]} maxBarSize={56} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function FinancialTrends({ annual, quarterlyProfit }: { annual: Annual[]; quarterlyProfit: Q[] }) {
  // hooks must come before any early return
  const [range, setRange] = useState<5 | 10 | 0>(10); // 0 = all years

  if (!annual.length && !quarterlyProfit.length) {
    return (
      <section className="panel p-4 text-sm text-muted">
        No fundamentals yet. Run <code>python elt/extract.py</code> to build the database.
      </section>
    );
  }

  const all = annual.map((r) => ({ ...r, year: fyLabel(r.period_end) }));
  const a = range ? all.slice(-range) : all;

  const allQ = quarterlyProfit.map((r) => ({ ...r, q: qLabel(r.period_end) }));
  const q = range ? allQ.slice(-range * 4) : allQ;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Fundamentals</h2>
        <div className="flex gap-1">
          {([[5, "5Y"], [10, "10Y"], [0, "All"]] as const).map(([v, t]) => (
            <button
              key={t}
              onClick={() => setRange(v)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                range === v ? "bg-ink text-white border-ink" : "border-line text-muted hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <YearChart className="lg:col-span-2" title="Earning Per Share" data={a} keyName="eps" name="EPS (Rs)" color="#2563eb" />
        <YearChart className="lg:col-span-2" title="Net Asset Per Share" data={a} keyName="nav" name="NAV (Rs)" color="#7c3aed" />

        <div className="panel p-4 lg:col-span-2">
          <div className="mb-2 text-sm font-medium">ROE and ROA (%)</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={a} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" fontSize={12} interval={0} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v: number) => (v == null ? "n/a" : v.toFixed(1) + "%")} />
              <Legend />
              <Line type="monotone" dataKey="roe_pct" name="ROE" stroke="#16a34a" strokeWidth={2} dot connectNulls />
              <Line type="monotone" dataKey="roa_pct" name="ROA" stroke="#f59e0b" strokeWidth={2} dot connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel p-4 lg:col-span-2">
          <div className="mb-2 text-sm font-medium">Profit after tax, single quarters (Rs million, unaudited)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={q} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="q" fontSize={11} />
              <YAxis fontSize={12} tickFormatter={(v) => (v / 1e6).toFixed(0) + "M"} />
              <Tooltip formatter={(v: number) => (v / 1e6).toFixed(1) + " M"} />
              <Bar dataKey="value" name="PAT" fill="#0ea5e9" radius={[3, 3, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* year-wise table, follows the selected range */}
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="p-3">Financial year</th>
              <th className="p-3 text-right">EPS (Rs)</th>
              <th className="p-3 text-right">NAV / share (Rs)</th>
              <th className="p-3 text-right">ROE %</th>
              <th className="p-3 text-right">ROA %</th>
            </tr>
          </thead>
          <tbody>
            {[...a].reverse().map((r) => (
              <tr key={r.period_end} className="border-t border-line">
                <td className="p-3">{r.year}</td>
                <td className="p-3 text-right">
                  {f2(r.eps)}
                  {r.eps_source === "computed" && <span title="computed from shares" className="text-amber-600">*</span>}
                </td>
                <td className="p-3 text-right">
                  {f2(r.nav)}
                  {r.nav_source === "computed" && <span title="computed from shares" className="text-amber-600">*</span>}
                </td>
                <td className="p-3 text-right">{f2(r.roe_pct)}</td>
                <td className="p-3 text-right">{f2(r.roa_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="p-3 text-xs text-muted">
          n/a = not found in the PDF. * = computed from the share count, not reported.
        </p>
      </div>
    </section>
  );
}