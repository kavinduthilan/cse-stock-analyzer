import Link from "next/link";
import { Row, fmt, fmtInt } from "@/lib/cse";
import { Change } from "./Change";

export function RowsTable({ rows, title }: { rows: Row[]; title: string }) {
  return (
    <section className="panel overflow-hidden">
      <h2 className="px-3 py-2 font-semibold border-b border-line">{title}</h2>
      {rows.length === 0 ? (
        <p className="p-3 text-sm text-muted">No data returned. The market may be closed or the API is unreachable.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="th">Symbol</th><th className="th text-right">Price</th><th className="th text-right">Change</th><th className="th text-right">Volume</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.symbol}>
                  <td className="td"><Link className="text-sea font-medium hover:underline" href={`/stock/${encodeURIComponent(r.symbol)}`}>{r.symbol}</Link></td>
                  <td className="td text-right">{fmt(r.price)}</td>
                  <td className="td text-right"><Change value={r.change} pct={r.pct} /></td>
                  <td className="td text-right">{fmtInt(r.volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
