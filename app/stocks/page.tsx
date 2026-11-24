import { cseGET, asArray, toRow } from "@/lib/cse";
import StocksExplorer from "@/components/StocksExplorer";

export const revalidate = 30;

export default async function Stocks() {

  console.log('starting');
  const rows = asArray(await cseGET("allSecurityCode")).map(toRow).filter((r) => r.symbol);

  console.log('rows', rows);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">All stocks</h1>
      {rows.length ? <StocksExplorer rows={rows} /> : <p className="text-muted">No price data returned right now. Try again when the market is open.</p>}
    </div>
  );
}


// list_by_type  - N
// tradeSummary
// allSecurityCode