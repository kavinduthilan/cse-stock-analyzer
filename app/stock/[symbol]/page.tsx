import { cse, pick, fmt, fmtInt, num } from "@/lib/cse";
import PriceChart from "@/components/PriceChart";
import { Change } from "@/components/Change";
import Reports from "@/components/Report";
import FinancialTrends from "@/components/FinancialTrends";
import AnalystChat from "@/components/AnalystChat";
import RefreshData from "@/components/RefreshData";
import FinancialStatements from "@/components/FinancialStatements";
import { annualRatios, quarterly, allStatements, cashFlowDetail } from "@/lib/analytics";

export const revalidate = 30;

const emptyT = { years: [], rows: [] };

function loadAnalytics(symbol: string) {
  try {
    return {
      annual: annualRatios(symbol),
      quarterlyProfit: quarterly(symbol, "profit_after_tax"),
      statements: allStatements(symbol),
      cashflowDetail: cashFlowDetail(symbol),
    };
  } catch {
    return {
      annual: [],
      quarterlyProfit: [],
      statements: { position: emptyT, profit: emptyT, cashflow: emptyT },
      cashflowDetail: { years: [], rows: [] },
    };
  }
}

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw);
  const canRefresh = process.env.NODE_ENV !== "production" || process.env.ALLOW_ETL === "1";

  const [data, reports] = await Promise.all([
    cse("companyInfoSummery", { symbol }),
    cse("financials", { symbol }),
  ]);

  const info = data?.reqSymbolInfo ?? data ?? {};
  const price = num(pick(info, "lastTradedPrice"));
  const hi52 = num(pick(info, "p12HiPrice", "hiTrade")), lo52 = num(pick(info, "p12LowPrice", "lowTrade"));
  const pos = Number.isFinite(hi52) && Number.isFinite(lo52) && hi52 > lo52 ? ((price - lo52) / (hi52 - lo52)) * 100 : NaN;

  const { annual, quarterlyProfit, statements, cashflowDetail } = loadAnalytics(symbol);

  const facts: [string, string][] = [
    ["Previous close", fmt(pick(info, "previousClose"))],
    ["Day high", fmt(pick(info, "hiTrade"))],
    ["Day low", fmt(pick(info, "lowTrade"))],
    ["52-week high", fmt(pick(info, "p12HiPrice"))],
    ["52-week low", fmt(pick(info, "p12LowPrice"))],
    ["Share volume", fmtInt(pick(info, "tdyShareVolume", "sharevolume"))],
    ["Trade volume", fmtInt(pick(info, "tdyTradeVolume", "tradevolume"))],
    ["Market cap", fmtInt(pick(info, "marketCap"))],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{symbol}</h1>
        <p className="text-muted">{pick(info, "name") ?? ""}</p>
      </div>
      {!data && <p className="text-loss text-sm">Could not load details for this symbol. Check the symbol format, for example LOLC.N0000.</p>}

      <div className="flex flex-wrap items-baseline gap-4">
        <span className="text-4xl font-semibold">{fmt(price)}</span>
        <span className="text-lg"><Change value={num(pick(info, "change"))} pct={num(pick(info, "changePercentage"))} /></span>
      </div>

      <PriceChart stockId={pick(info, "id")} symbol={symbol} />

      {Number.isFinite(pos) && (
        <div className="panel p-4">
          <div className="text-sm mb-2">Position in 52-week range: <b>{fmt(pos, 0)}%</b></div>
          <div className="h-2 bg-line rounded-full relative"><div className="absolute top-[-3px] h-4 w-1.5 bg-ink rounded" style={{ left: `calc(${Math.min(100, Math.max(0, pos))}% - 3px)` }} /></div>
          <div className="flex justify-between text-xs text-muted mt-1"><span>{fmt(lo52)}</span><span>{fmt(hi52)}</span></div>
        </div>
      )}

      <dl className="grid gap-px bg-line border border-line rounded-md overflow-hidden sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(([k, v]) => (<div key={k} className="bg-white p-3"><dt className="text-xs text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>))}
      </dl>

      {canRefresh && <RefreshData symbol={symbol} />}
      <FinancialTrends annual={annual} quarterlyProfit={quarterlyProfit} />

      <FinancialStatements {...statements} detail={cashflowDetail} />

      <AnalystChat symbol={symbol} />

      <Reports data={reports} />
    </div>
  );
}