import { cse, asArray, pick, fmt, fmtInt, num } from "@/lib/cse";
import { Change } from "@/components/Change";

export const revalidate = 60;

export default async function Sectors() {
  const rows = asArray(await cse("allSectors"));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Sectors</h1>
      {rows.length === 0 ? <p className="text-muted">No sector data returned right now.</p> : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="th">Sector</th><th className="th text-right">Index</th><th className="th text-right">Change</th><th className="th text-right">Turnover</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="td font-medium">{pick(r, "name", "indexName", "sectorName", "symbol") ?? "–"}</td>
                  <td className="td text-right">{fmt(pick(r, "indexValue", "value", "lastValue"))}</td>
                  <td className="td text-right"><Change value={num(pick(r, "change"))} pct={num(pick(r, "percentage", "changePercentage"))} /></td>
                  <td className="td text-right">{fmtInt(pick(r, "turnover", "sectorTurnover"))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
