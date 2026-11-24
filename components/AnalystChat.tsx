"use client";
import { useState } from "react";

export default function AnalystChat({ symbol }: { symbol: string }) {
  const [q, setQ] = useState("How did profit and ROE change over the last 5 years?");
  const [a, setA] = useState(""); const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true); setA("");
    const r = await fetch("/api/analyze", { method: "POST", body: JSON.stringify({ symbol, question: q }) });
    setA((await r.json()).answer); setBusy(false);
  }
  return (
    <section className="panel p-4 space-y-3">
      <h2 className="text-xl font-semibold">AI analyst</h2>
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 rounded-md border border-line px-3 py-1.5 text-sm" />
        <button onClick={ask} disabled={busy} className="rounded-md bg-ink px-4 py-1.5 text-sm text-white">{busy ? "Thinking…" : "Ask"}</button>
      </div>
      {a && <p className="whitespace-pre-wrap text-sm">{a}</p>}
    </section>
  );
}