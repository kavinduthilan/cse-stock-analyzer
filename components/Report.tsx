"use client";

import { useMemo, useState } from "react";

type Item = {
  id: number;
  path: string;
  manualDate: number; 
  uploadedDate: number;
  fileText: string;
};

type ReportsData = {
  infoAnnualData?: Item[];
  infoQuarterlyData?: Item[];
  infoOtherData?: Item[];
};

const CDN = "https://cdn.cse.lk/";

const fileUrl = (p: string) => CDN + encodeURI(p.trim()).replace(/#/g, "%23");

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Colombo",
});
const yearOf = (ms: number) =>
  Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Colombo" }).format(ms));

function kind(text: string): { label: string; cls: string } {
  const t = text.toLowerCase();
  if (t.includes("errata")) return { label: "Errata", cls: "bg-amber-100 text-amber-800" };
  if (t.includes("audited")) return { label: "Audited FS", cls: "bg-emerald-100 text-emerald-800" };
  if (t.includes("annual")) return { label: "Annual Report", cls: "bg-blue-100 text-blue-800" };
  if (t.includes("prospectus")) return { label: "Prospectus", cls: "bg-purple-100 text-purple-800" };
  if (t.includes("trust deed")) return { label: "Trust Deed", cls: "bg-slate-200 text-slate-800" };
  if (t.includes("interim") || t.includes("quarter")) return { label: "Interim", cls: "bg-sky-100 text-sky-800" };
  return { label: "Document", cls: "bg-slate-100 text-slate-700" };
}

const TABS = [
  { key: "infoAnnualData", label: "Annual" },
  { key: "infoQuarterlyData", label: "Quarterly" },
  { key: "infoOtherData", label: "Other" },
] as const;

export default function Reports({ data }: { data: ReportsData | null }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("infoAnnualData");
  const [year, setYear] = useState<number | "all">("all");
  const [q, setQ] = useState("");

  const sorted = useMemo(() => {
    const out = {} as Record<(typeof TABS)[number]["key"], Item[]>;
    for (const t of TABS) {
      out[t.key] = [...(data?.[t.key] ?? [])].sort(
        (a, b) => b.manualDate - a.manualDate || b.uploadedDate - a.uploadedDate
      );
    }
    return out;
  }, [data]);

  const list = sorted[tab];
  const years = useMemo(
    () => Array.from(new Set(list.map((i) => yearOf(i.manualDate)))).sort((a, b) => b - a),
    [list]
  );

  const filtered = list.filter(
    (i) =>
      (year === "all" || yearOf(i.manualDate) === year) &&
      i.fileText.toLowerCase().includes(q.trim().toLowerCase())
  );

  // group by year
  const groups = useMemo(() => {
    const m = new Map<number, Item[]>();
    for (const i of filtered) {
      const y = yearOf(i.manualDate);
      m.set(y, [...(m.get(y) ?? []), i]);
    }
    return Array.from(m.entries());
  }, [filtered]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold">Financial reports</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search reports…"
          className="w-full sm:w-64 rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      {/* tabs */}
      <div role="tablist" className="flex gap-1 border-b border-line">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => { setTab(t.key); setYear("all"); }}
              className={`-mb-px px-4 py-2 text-sm font-medium border-b-2 transition ${
                active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
              <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-xs">
                {sorted[t.key].length}
              </span>
            </button>
          );
        })}
      </div>

      {/* year chips */}
      {years.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {(["all", ...years] as const).map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                year === y ? "bg-ink text-white border-ink" : "border-line text-muted hover:text-ink"
              }`}
            >
              {y === "all" ? "All years" : y}
            </button>
          ))}
        </div>
      )}

      {/* list */}
      {groups.length === 0 ? (
        <p className="text-sm text-muted py-6">No reports found.</p>
      ) : (
        <div className="space-y-5">
          {groups.map(([y, items]) => (
            <div key={y}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{y}</div>
              <ul className="grid gap-2 md:grid-cols-2">
                {items.map((i) => {
                  const k = kind(i.fileText);
                  return (
                    <li key={i.id}>
                      <a
                        href={fileUrl(i.path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-3 rounded-lg border border-line bg-white p-3 transition hover:shadow-md hover:-translate-y-px"
                      >
                        <div className="mt-0.5 flex h-10 w-9 shrink-0 items-center justify-center rounded bg-red-50 text-[10px] font-bold text-red-600">
                          PDF
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium leading-snug group-hover:underline">
                            {i.fileText.trim()}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span className={`rounded px-1.5 py-0.5 font-medium ${k.cls}`}>{k.label}</span>
                            <span>Period end {dateFmt.format(i.manualDate)}</span>
                            <span>· Uploaded {dateFmt.format(i.uploadedDate)}</span>
                          </div>
                        </div>
                        <span className="text-muted transition group-hover:text-ink">↗</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}