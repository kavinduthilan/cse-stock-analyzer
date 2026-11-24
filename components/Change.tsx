import { fmt } from "@/lib/cse";
export function Change({ value, pct }: { value?: number; pct?: number }) {
  const v = Number.isFinite(pct as number) ? (pct as number) : (value as number);
  const cls = !Number.isFinite(v) || v === 0 ? "text-muted" : v > 0 ? "text-gain" : "text-loss";
  const sign = v > 0 ? "+" : "";
  return (
    <span className={cls}>
      {Number.isFinite(value as number) && `${sign}${fmt(value)}`}
      {Number.isFinite(pct as number) && ` (${sign}${fmt(pct)}%)`}
      {!Number.isFinite(value as number) && !Number.isFinite(pct as number) && "–"}
    </span>
  );
}
