import { db } from "./db";

type Row = { period_end: string; period_months: number; value: number };

export function series(symbol: string, metric: string): Row[] {
  return db.prepare(
    `SELECT period_end, period_months, value FROM financials
     WHERE symbol=? AND metric=? ORDER BY period_end`
  ).all(symbol, metric) as Row[];
}

// interim figures are cumulative: Q2 = 6M - 3M, Q3 = 9M - 6M, Q4 = 12M - 9M
export function quarterly(symbol: string, metric: string) {
  return series(symbol, metric)
    .filter((r) => r.period_months === 3)
    .map((r) => ({ period_end: r.period_end, value: r.value }));
}

const sameFY = (a: string, b: string) => {
  const fy = (s: string) => { const d = new Date(s); return d.getMonth() >= 3 ? d.getFullYear() + 1 : d.getFullYear(); };
  return fy(a) === fy(b);
};


// Optional manual override of shares outstanding at year end (from the annual report).
// Leave empty to use the implied count (profit / EPS).
const SHARES: Record<string, number> = {};

export function annualRatios(symbol: string) {
  const g = (m: string) =>
    new Map(series(symbol, m).filter((r) => r.period_months === 12).map((r) => [r.period_end, r.value]));

  const pat = g("profit_after_tax"), ta = g("total_assets"), eq = g("total_equity"),
        nii = g("net_interest_income"), toi = g("total_operating_income"),
        epsR = g("eps"), navR = g("nav_per_share");

  const dates = Array.from(
    new Set([...pat.keys(), ...ta.keys(), ...eq.keys(), ...epsR.keys()])
  ).sort();

  const div = (a?: number, b?: number) => (a != null && b ? (a / b) * 100 : null);

  return dates.map((d) => {
    const eps = epsR.get(d) ?? null;
    const p = pat.get(d), e = eq.get(d);

    const shares = SHARES[d] ?? (eps && p ? p / eps : undefined);
    const navCalc = shares && e != null ? e / shares : null;

    // use the reported NAV only when it agrees with the calculated one (within 15%)
    const rep = navR.get(d);
    const agrees = rep != null && navCalc != null && Math.abs(rep - navCalc) / navCalc < 0.15;
    const nav = agrees ? rep! : navCalc;

    return {
      period_end: d,
      eps,
      nav,
      shares_m: shares ? shares / 1e6 : null,
      eps_source: eps != null ? "reported" : "missing",
      nav_source: nav == null ? "missing" : agrees ? "reported" : "computed",
      roe_pct: div(p, e),
      roa_pct: div(p, ta.get(d)),
      equity_to_assets_pct: div(e, ta.get(d)),
      nii_to_income_pct: div(nii.get(d), toi.get(d)),
    };
  });
}


export const STATEMENTS = {
  position: [
    ["total_assets", "Total assets"],
    ["loans", "Loans and receivables"],
    ["total_liabilities", "Total liabilities"],
    ["deposits", "Deposits"],
    ["borrowings", "Borrowings"],
    ["total_equity", "Total equity"],
  ],
  profit: [
    ["interest_income", "Interest income"],
    ["interest_expense", "Interest expense"],
    ["net_interest_income", "Net interest income"],
    ["total_operating_income", "Total operating income"],
    ["operating_expenses", "Operating expenses"],
    ["impairment", "Impairment charges"],
    ["profit_before_tax", "Profit before tax"],
    ["profit_after_tax", "Profit after tax"],
  ],
  cashflow: [
    ["cfo", "Operating activities"],
    ["cfi", "Investing activities"],
    ["cff", "Financing activities"],
  ],
} as const;

export type StatementKey = keyof typeof STATEMENTS;

export type StatementTable = {
  years: string[];
  rows: { key: string; label: string; values: (number | null)[] }[];
};

// Annual values (full rupees) for one statement, last `maxYears` years
export function statementTable(symbol: string, statement: StatementKey, maxYears = 10): StatementTable {
  const defs = STATEMENTS[statement];
  const maps = defs.map(([key]) =>
    new Map(series(symbol, key).filter((r) => r.period_months === 12).map((r) => [r.period_end, r.value]))
  );
  const years = Array.from(new Set(maps.flatMap((m) => [...m.keys()]))).sort().slice(-maxYears);
  return {
    years,
    rows: defs.map(([key, label], i) => ({
      key, label, values: years.map((y) => maps[i].get(y) ?? null),
    })),
  };
}

export function allStatements(symbol: string) {
  return {
    position: statementTable(symbol, "position"),
    profit: statementTable(symbol, "profit"),
    cashflow: statementTable(symbol, "cashflow"),
  };
}



const CF_ORDER = ["operating", "investing", "financing", "summary", "analysis"];

export type CashFlowDetail = {
  years: string[];
  rows: { section: string; label: string; is_total: boolean; values: (number | null)[] }[];
};

// unify wording differences between years for the three totals
function cfKey(section: string, label: string) {
  const l = label.toLowerCase();
  const m = l.match(/^net cash(?!.*before).*\b(operating|investing|financing)\b/);
  return m ? `total|${m[1]}` : `${section}|${l.replace(/[^a-z0-9]+/g, " ").trim()}`;
}

export function cashFlowDetail(symbol: string, maxYears = 10): CashFlowDetail {
  let lines: { period_end: string; section: string; label: string; is_total: number; value: number }[];
  try {
    lines = db.prepare(
      `SELECT period_end, section, label, is_total, value FROM cashflow_lines
       WHERE symbol=? ORDER BY period_end, seq`
    ).all(symbol) as any[];
  } catch {
    return { years: [], rows: [] };
  }

  const years = Array.from(new Set(lines.map((l) => l.period_end))).sort().slice(-maxYears);

  // per year: key (with occurrence number) -> value
  const perYear = new Map<string, { key: string; l: (typeof lines)[number] }[]>();
  for (const y of years) {
    const seen = new Map<string, number>();
    perYear.set(
      y,
      lines.filter((l) => l.period_end === y).map((l) => {
        const base = cfKey(l.section, l.label);
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        return { key: `${base}#${n}`, l };
      })
    );
  }

  // master row order: newest year first, older years slot their extra lines in after the previous line
  const master: { key: string; section: string; label: string; is_total: boolean }[] = [];
  for (const y of [...years].reverse()) {
    let prev = -1;
    for (const { key, l } of perYear.get(y)!) {
      let idx = master.findIndex((m) => m.key === key);
      if (idx < 0) {
        idx = prev >= 0 ? prev + 1 : master.findIndex((m) => m.section === l.section);
        if (idx < 0) idx = master.length;
        master.splice(idx, 0, { key, section: l.section, label: l.label, is_total: !!l.is_total });
      }
      prev = idx;
    }
  }
  master.sort((a, b) => CF_ORDER.indexOf(a.section) - CF_ORDER.indexOf(b.section)); // stable

  const rows = master.map((m) => ({
    section: m.section,
    label: m.label,
    is_total: m.is_total,
    values: years.map((y) => perYear.get(y)!.find((x) => x.key === m.key)?.l.value ?? null),
  }));
  return { years, rows };
}