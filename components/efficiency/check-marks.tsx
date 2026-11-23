"use client";

import { useState } from "react";

// "Check marks" on the admin Model Answer pages: what the sheet / document being edited would score with the paper's
// saved marking rules, question by question -- a way to test a paper without signing in as a student (that put test
// attempts into a student's results). Nothing is saved.
export type CheckRow = { number: number; maximum: number; awarded: number; hint?: string | null };
type CheckResult = { ok: boolean; error: string; rows: CheckRow[] };

export function CheckMarks({ run, disabled }: { run: () => Promise<CheckResult>; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const check = async () => {
    setBusy(true);
    const answer = await run().catch(() => ({ ok: false, error: "Could not check. Check your internet connection and try again.", rows: [] }));
    setResult(answer); setBusy(false);
  };
  const total = result?.rows.reduce((sum, row) => sum + Number(row.awarded ?? 0), 0) ?? 0;
  const maximum = result?.rows.reduce((sum, row) => sum + Number(row.maximum ?? 0), 0) ?? 0;
  const short = result?.rows.filter((row) => Number(row.awarded ?? 0) < Number(row.maximum)) ?? [];
  const fmt = (value: number) => String(Math.round(value * 100) / 100);
  return (
    <>
      <button type="button" disabled={disabled || busy} onClick={check} title="Score this sheet with the paper's saved marking rules (nothing is saved)"
        className="h-7 flex-none rounded-md border border-sky-300 px-2 text-xs font-black text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Checking…" : "Check marks"}</button>
      {result && (
        <div role="status" className="fixed right-4 top-20 z-[85] max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <p className="font-black">{result.ok ? `Marks with the saved rules: ${fmt(total)} / ${fmt(maximum)}` : "Check failed"}</p>
            <button type="button" onClick={() => setResult(null)} aria-label="Close marks" className="px-1 font-black text-slate-500 hover:text-slate-900">✕</button>
          </div>
          {!result.ok && <p className="mt-1 text-amber-900">{result.error}</p>}
          {result.ok && short.length === 0 && <p className="mt-1 font-bold text-green-700">Every question gets full marks.</p>}
          {result.ok && short.length > 0 && <ul className="mt-1.5 space-y-1">{short.map((row) => (
            <li key={row.number} className="rounded-md bg-amber-50 px-2 py-1"><span className="font-black">Q{row.number}</span>: {fmt(Number(row.awarded ?? 0))} / {fmt(Number(row.maximum))}{row.hint ? <span className="block text-slate-600">{row.hint}</span> : null}</li>
          ))}</ul>}
        </div>
      )}
    </>
  );
}
