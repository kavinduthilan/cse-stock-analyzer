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