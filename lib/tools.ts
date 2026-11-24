import { series, quarterly, annualRatios } from "./analytics";

export const toolDefs = [
  { type: "function", function: {
      name: "get_metric",
      description: "Get a financial metric over time. Metrics: total_assets, total_equity, total_liabilities, deposits, loans, net_interest_income, total_operating_income, impairment, profit_before_tax, profit_after_tax, eps, cfo, cfi, cff",
      parameters: { type: "object", required: ["metric", "frequency"], properties: {
        metric: { type: "string" },
        frequency: { type: "string", enum: ["annual", "quarterly"] } } } } },
  { type: "function", function: {
      name: "get_ratios",
      description: "Annual ROE, ROA, equity/assets, NII/income and EPS",
      parameters: { type: "object", properties: {} } } },
];

export function runTool(symbol: string, name: string, args: any) {
  if (name === "get_ratios") return annualRatios(symbol);
  if (name === "get_metric") {
    return args.frequency === "annual"
      ? series(symbol, args.metric).filter((r) => r.period_months === 12)
      : quarterly(symbol, args.metric);
  }
  return { error: "unknown tool" };
}