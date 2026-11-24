"use client";

import { useState, Fragment } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

type Table = { years: string[]; rows: { key: string; label: string; values: (number | null)[] }[] };
type Detail = {
  years: string[];
  rows: { section: string; label: string; is_total: boolean; values: (number | null)[] }[];
};
type Props = { position: Table; profit: Table; cashflow: Table; detail?: Detail };

const TABS = [
  { key: "position", label: "Financial position", chart: ["total_assets", "total_liabilities", "total_equity"] },
  { key: "profit", label: "Profit or loss", chart: ["total_operating_income", "profit_before_tax", "profit_after_tax"] },
  { key: "cashflow", label: "Cash flows", chart: ["cfo", "cfi", "cff"] },
] as const;

const COLORS = ["#2563eb", "#f59e0b", "#16a34a"];

const CF_TITLES: Record<string, string> = {
  operating: "Operating activities",
  investing: "Investing activities",
  financing: "Financing activities",
  summary: "Net change in cash",
  analysis: "Analysis of cash and cash equivalents",
};

const fy = (d: string) => { const y = Number(d.slice(0, 4)); return `${y - 1}/${String(y).slice(2)}`; };
const mn = (v: number | null) =>
  v == null ? "n/a" : (v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 });
const fm = (v: number | null) =>
  v == null ? "n/a"
  : v < 0 ? `(${(-v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 })})`
  : (v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 });

function CashFlowDetail({ detail }: { detail: Detail }) {
  const sections = Object.keys(CF_TITLES).filter((s) => detail.rows.some((r) => r.section === s));
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="p-3 text-left">Cash flow statement (Rs million)</th>
            {detail.years.map((y) => <th key={y} className="p-3 text-right whitespace-nowrap">{fy(y)}</th>)}
          </tr>
        </thead>
        <tbody>
          {sections.map((s) => (
            <Fragment key={s}>
              <tr className="bg-slate-50">
                <td colSpan={detail.years.length + 1} className="p-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  {CF_TITLES[s]}
                </td>
              </tr>
              {detail.rows.filter((r) => r.section === s).map((r, i) => (
                <tr key={i} className={`border-t border-line ${r.is_total ? "font-semibold bg-slate-50/60" : ""}`}>
                  <td className="p-2 px-3 min-w-[16rem]">{r.label}</td>
                  {r.values.map((v, j) => (
                    <td key={j} className={`p-2 px-3 text-right tabular-nums whitespace-nowrap ${v != null && v < 0 ? "text-loss" : ""}`}>
                      {fm(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      <p className="p-3 text-xs text-muted">Annual figures from each year's own report. n/a = line not reported that year.</p>
    </div>
  );
}

export default function FinancialStatements(props: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("position");
  const t = props[tab];
  const def = TABS.find((x) => x.key === tab)!;

  if (!props.position.years.length && !props.profit.years.length && !props.cashflow.years.length) return null;

  const chartRows = t.rows.filter((r) => (def.chart as readonly string[]).includes(r.key));
  const data = t.years.map((y, i) => ({
    year: fy(y),
    ...Object.fromEntries(chartRows.map((r) => [r.label, r.values[i] == null ? null : r.values[i]! / 1e6])),
  }));

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Financial statements</h2>

      <div role="tablist" className="flex gap-1 border-b border-line">
        {TABS.map((x) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={tab === x.key}
            onClick={() => setTab(x.key)}
            className={`-mb-px px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === x.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {!t.years.length ? (
        <p className="text-sm text-muted">No data extracted for this statement yet.</p>
      ) : (
        <>
          <div className="panel p-4">
            <div className="mb-2 text-sm font-medium">{def.label} (Rs million)</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" fontSize={12} interval={0} />
                <YAxis fontSize={12} tickFormatter={(v) => v.toLocaleString()} />
                <Tooltip formatter={(v: number) => (v == null ? "n/a" : v.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " M")} />
                <Legend />
                {chartRows.map((r, i) => (
                  <Bar key={r.key} dataKey={r.label} fill={COLORS[i % 3]} radius={[3, 3, 0, 0]} maxBarSize={28} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="p-3 text-left">Rs million</th>
                  {t.years.map((y) => <th key={y} className="p-3 text-right whitespace-nowrap">{fy(y)}</th>)}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r) => (
                  <tr key={r.key} className="border-t border-line">
                    <td className="p-3 whitespace-nowrap font-medium">{r.label}</td>
                    {r.values.map((v, i) => (
                      <td key={i} className={`p-3 text-right tabular-nums ${v != null && v < 0 ? "text-loss" : ""}`}>
                        {v != null && v < 0 ? `(${mn(-v)})` : mn(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="p-3 text-xs text-muted">
              n/a = not found in the PDF. Negative values are shown in brackets. Annual figures only.
            </p>
          </div>

          {tab === "cashflow" && props.detail && props.detail.rows.length > 0 && (
            <CashFlowDetail detail={props.detail} />
          )}
        </>
      )}
    </section>
  );
}