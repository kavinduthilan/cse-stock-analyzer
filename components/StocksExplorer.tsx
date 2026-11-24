"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Row } from "@/lib/cse";
import { fmt, fmtInt } from "@/lib/cse";
import { Change } from "./Change";

type Key = keyof Row;
const cols: [Key, string, boolean][] = [["symbol", "Symbol", false], ["price", "Price", true], ["pct", "Change %", true], ["volume", "Volume", true], ["turnover", "Turnover", true]];

export default function StocksExplorer({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [key, setKey] = useState<Key>("turnover");
  const [dir, setDir] = useState(-1);
  const [filter, setFilter] = useState<"all" | "up" | "down">("all");

  const data = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((r) => (!s || r.symbol.toLowerCase().includes(s) || r.name.toLowerCase().includes(s)) &&
        (filter === "all" || (filter === "up" ? r.pct > 0 : r.pct < 0)))
      .sort((a, b) => {
        const x = a[key], y = b[key];
        if (typeof x === "string") return dir * x.localeCompare(y as string);
        return dir * ((Number.isFinite(x as number) ? (x as number) : -Infinity) - (Number.isFinite(y as number) ? (y as number) : -Infinity));
      });
  }, [rows, q, key, dir, filter]);

  const adv = rows.filter((r) => r.pct > 0).length, dec = rows.filter((r) => r.pct < 0).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symbol or company" aria-label="Search stocks"
          className="border border-line rounded-md px-3 py-2 text-sm w-64 bg-white" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} aria-label="Filter by direction" className="border border-line rounded-md px-3 py-2 text-sm bg-white">
          <option value="all">All stocks</option><option value="up">Gainers only</option><option value="down">Losers only</option>
        </select>
        <span className="text-sm text-muted">{data.length} shown · <span className="text-gain">{adv} up</span> · <span className="text-loss">{dec} down</span></span>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {cols.map(([k, label, right]) => (
                <th key={k} className={`th ${right ? "text-right" : ""}`} aria-sort={key === k ? (dir > 0 ? "ascending" : "descending") : "none"}>
                  <button onClick={() => (key === k ? setDir(-dir) : (setKey(k), setDir(k === "symbol" ? 1 : -1)))} className="hover:text-ink">
                    {label}{key === k ? (dir > 0 ? " ▲" : " ▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.symbol} className="hover:bg-paper">
                <td className="td"><Link href={`/stock/${encodeURIComponent(r.symbol)}`} className="text-sea font-medium hover:underline">{r.symbol}</Link><div className="text-xs text-muted">{r.name}</div></td>
                <td className="td text-right">{fmt(r.price)}</td>
                <td className="td text-right"><Change pct={r.pct} /></td>
                <td className="td text-right">{fmtInt(r.volume)}</td>
                <td className="td text-right">{fmtInt(r.turnover)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
