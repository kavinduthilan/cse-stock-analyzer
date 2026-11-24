import { cse, asArray, toRow, pick, fmt, fmtInt } from "@/lib/cse";
import { RowsTable } from "@/components/RowsTable";
import { Change } from "@/components/Change";

export const revalidate = 30;

function Stat({ label, children, sub }: { label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-semibold mt-1">{children}</div>
      {sub && <div className="text-sm mt-1">{sub}</div>}
    </div>
  );
}

export default async function Home() {
  const [status, summary, aspi, snp, gainers, losers, active] = await Promise.all([
    cse("marketStatus"), cse("marketSummery"), cse("aspiData"), cse("snpData"),
    cse("topGainers"), cse("topLooses"), cse("mostActiveTrades"),
  ]);
  const open = String(pick(status, "status") ?? "").toLowerCase().includes("open");

  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold">Market today</h1>
        <span className={`text-sm font-medium ${open ? "text-gain" : "text-muted"}`}>{pick(status, "status") ?? "Status unavailable"}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="ASPI" sub={<Change value={pick(aspi, "change")} pct={pick(aspi, "percentage", "changePercentage")} />}>{fmt(pick(aspi, "value", "lastValue"))}</Stat>
        <Stat label="S&P SL20" sub={<Change value={pick(snp, "change")} pct={pick(snp, "percentage", "changePercentage")} />}>{fmt(pick(snp, "value", "lastValue"))}</Stat>
        <Stat label="Turnover (LKR)">{fmtInt(pick(summary, "tradeVolume", "turnover"))}</Stat>
        <Stat label="Shares traded">{fmtInt(pick(summary, "shareVolume"))}</Stat>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RowsTable title="Top gainers" rows={asArray(gainers).slice(0, 10).map(toRow)} />
        <RowsTable title="Top losers" rows={asArray(losers).slice(0, 10).map(toRow)} />
      </div>
      <RowsTable title="Most active by volume" rows={asArray(active).slice(0, 10).map(toRow)} />
    </div>
  );
}
