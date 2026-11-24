import {
  series,
  quarterly,
  annualRatios,
  statementTable,
  STATEMENTS,
  StatementKey,
  cashFlowDetail,
} from "./analytics";

const METRICS = Object.values(STATEMENTS)
  .flat()
  .map(([k]) => k)
  .concat(["eps", "nav_per_share"]);

export const toolDefs = [
  {
    type: "function",
    function: {
      name: "get_statement",
      description:
        "Annual financial statement for the last 10 years, in LKR. " +
        "position = assets, loans, liabilities, deposits, borrowings, equity. " +
        "profit = interest income/expense, operating income, expenses, impairment, PBT, PAT. " +
        "cashflow = operating, investing and financing cash flows. Null means not found.",
      parameters: {
        type: "object",
        required: ["statement"],
        properties: {
          statement: {
            type: "string",
            enum: ["position", "profit", "cashflow"],
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_metric",
      description: `One metric over time. Metrics: ${METRICS.join(", ")}`,
      parameters: {
        type: "object",
        required: ["metric", "frequency"],
        properties: {
          metric: { type: "string" },
          frequency: { type: "string", enum: ["annual", "quarterly"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ratios",
      description:
        "Annual ROE, ROA, equity/assets, NII/income, EPS and NAV per share",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_cashflow_detail",
      description:
        "Line-by-line annual cash flow statement, last 10 years, in LKR million. " +
        "section: operating, investing, financing, summary (net change in cash) or analysis (cash and overdrafts). Null = not reported.",
      parameters: {
        type: "object",
        properties: {
          section: {
            type: "string",
            enum: [
              "operating",
              "investing",
              "financing",
              "summary",
              "analysis",
              "all",
            ],
          },
        },
      },
    },
  },
];

export function runTool(symbol: string, name: string, args: any) {
  if (name === "get_ratios") return annualRatios(symbol);
  if (name === "get_statement") {
    if (!(args?.statement in STATEMENTS))
      return { error: "statement must be position, profit or cashflow" };
    return statementTable(symbol, args.statement as StatementKey);
  }
  if (name === "get_metric") {
    if (!METRICS.includes(args?.metric))
      return { error: `unknown metric, use one of: ${METRICS.join(", ")}` };
    return args.frequency === "annual"
      ? series(symbol, args.metric).filter((r) => r.period_months === 12)
      : quarterly(symbol, args.metric);
  }
  if (name === "get_cashflow_detail") {
    const d = cashFlowDetail(symbol);
    const s = args?.section;
    return {
      unit: "LKR million",
      years: d.years,
      rows: d.rows
        .filter((r) => !s || s === "all" || r.section === s)
        .map((r) => ({
          section: r.section,
          line: r.label,
          total: r.is_total,
          values: r.values.map((v) =>
            v == null ? null : Math.round(v / 1e5) / 10,
          ),
        })),
    };
  }
  return { error: "unknown tool" };
}
