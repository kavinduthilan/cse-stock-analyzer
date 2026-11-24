const BASE = process.env.CSE_BASE_URL ?? "https://www.cse.lk/api/";

export type Params = Record<string, string | number>;

/** Server-side call to a CSE endpoint (all endpoints are POST). Returns null on failure. */
export async function cse<T = any>(endpoint: string, params: Params = {}, revalidate = 30): Promise<T | null> {
  try {
    const res = await fetch(BASE + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString(),
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}


export async function cseGET<T = any>(endpoint: string, params: Params = {}, revalidate = 30): Promise<T | null> {
  try {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString();

    const res = await fetch(BASE + endpoint + (qs ? `?${qs}` : ""), {
      method: "GET",
      headers: {
        Accept: "application/json",
        // CSE may reject requests that don't look like a browser
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Referer: "https://www.cse.lk/",
        Origin: "https://www.cse.lk",
      },
      next: { revalidate },
    });

    if (!res.ok) {
      console.error(`cseGET ${endpoint} -> ${res.status} ${res.statusText}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error(`cseGET ${endpoint} threw:`, e);
    return null;
  }
}

/** CSE responses vary in shape; pull the first array out of whatever came back. */
export function asArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const v of Object.values(data)) if (Array.isArray(v)) return v as any[];
  }
  return [];
}

export function pick(o: any, ...keys: string[]) {
  for (const k of keys) if (o?.[k] !== undefined && o?.[k] !== null) return o[k];
  return undefined;
}

export const num = (v: any) => (v === undefined || v === null || v === "" ? NaN : Number(v));
export const fmt = (v: any, d = 2) => {
  const n = num(v);
  return Number.isFinite(n) ? n.toLocaleString("en-LK", { minimumFractionDigits: d, maximumFractionDigits: d }) : "–";
};
export const fmtInt = (v: any) => fmt(v, 0);

export type Row = { symbol: string; name: string; price: number; change: number; pct: number; volume: number; turnover: number };

/** Normalises rows from todaySharePrice / topGainers / topLooses / mostActiveTrades. */
export function toRow(o: any): Row {
  return {
    symbol: String(pick(o, "symbol") ?? ""),
    name: String(pick(o, "name", "companyName") ?? ""),
    price: num(pick(o, "lastTradedPrice", "price", "last")),
    change: num(pick(o, "change")),
    pct: num(pick(o, "changePercentage", "percentageChange", "percentChange")),
    volume: num(pick(o, "sharevolume", "shareVolume", "volume")),
    turnover: num(pick(o, "turnover")),
  };
}
