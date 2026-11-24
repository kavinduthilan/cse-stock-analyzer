import { NextRequest, NextResponse } from "next/server";
import { cse } from "@/lib/cse";

const ALLOWED = new Set([
  "chartData", "companyChartDataByStock", "companyInfoSummery", "todaySharePrice", "marketStatus",
  "marketSummery", "aspiData", "snpData", "allSectors", "detailedTrades", "dailyMarketSummery", "alphabetical", "allSecurityCode", "financials"
]);

// Browser -> this route -> cse.lk (avoids CORS)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ endpoint: string }> }
) {
  const { endpoint } = await params;

  if (!ALLOWED.has(endpoint)) {
    return NextResponse.json({ error: "Unknown endpoint" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const data = await cse(endpoint, body, 30);

  if (data === null) {
    return NextResponse.json({ error: "CSE API unavailable" }, { status: 502 });
  }
  return NextResponse.json(data);
}