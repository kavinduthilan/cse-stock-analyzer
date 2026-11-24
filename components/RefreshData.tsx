"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefreshData({ symbol }: { symbol: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const [open, setOpen] = useState(false);

  async function run() {
    setBusy(true); setOpen(true); setLog("Starting…\n");
    try {
      const res = await fetch("/api/cse/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      if (!res.ok || !res.body) {
        setLog(await res.text());
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setLog((l) => (l + chunk).slice(-12000));
      }
      router.refresh();
    } catch (e) {
      setLog((l) => l + "\nError: " + String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          onClick={run}
          disabled={busy}
          className="rounded-md bg-ink px-4 py-1.5 text-sm text-white disabled:opacity-60"
        >
          {busy ? "Updating financials…" : "Update financial data"}
        </button>
        {log && (
          <button onClick={() => setOpen(!open)} className="text-xs text-muted hover:text-ink">
            {open ? "Hide log" : "Show log"}
          </button>
        )}
      </div>
      {open && log && (
        <pre className="max-h-64 overflow-auto rounded-md border border-line bg-slate-50 p-3 text-xs">
          {log}
        </pre>
      )}
    </div>
  );
}