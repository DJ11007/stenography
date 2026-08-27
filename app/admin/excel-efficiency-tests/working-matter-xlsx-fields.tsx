"use client";
import { useState, useTransition } from "react";
import type { WorkingSheetSnapshot } from "@/lib/excel-sheet";
import { columnLetters } from "@/lib/excel-sheet";
import { extractWorkingMatterXlsx } from "./actions";

export function WorkingMatterXlsxFields({ initialSnapshot }: { initialSnapshot: WorkingSheetSnapshot | null }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const extract = (file: File | null) => {
    if (!file) return;
    const form = new FormData();
    form.set("workingMatterFile", file);
    form.set("language", snapshot?.language ?? "English");
    startTransition(async () => {
      const result = await extractWorkingMatterXlsx(form);
      if (!result.ok || !result.snapshot) { setError(result.error ?? "XLSX import failed."); return; }
      setSnapshot(result.snapshot);
      setError("");
    });
  };
  const rowNumbers = snapshot ? Array.from({ length: snapshot.rows }, (_, index) => index + 1) : [];
  const colLetters = snapshot ? Array.from({ length: snapshot.cols }, (_, index) => columnLetters(index)) : [];
  return (
    <fieldset className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
      <legend className="px-2 font-black">Upload Working Matter (.xlsx)</legend>
      <p className="text-sm text-slate-600">This is the starting spreadsheet the student sees when the workspace opens — values, formulas and basic formatting are preserved.</p>
      <input className="input mt-3" type="file" name="workingMatterFile" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => extract(event.target.files?.[0] ?? null)} />
      {pending && <p role="status" className="mt-2 font-bold text-emerald-700">Importing and sanitizing XLSX…</p>}
      {error && <p role="alert" className="mt-2 font-bold text-red-700">{error}</p>}
      {snapshot && (
        <section className="mt-4 rounded-xl bg-white p-4">
          <input type="hidden" name="workingMatterSnapshot" value={JSON.stringify(snapshot)} />
          <div className="grid gap-2 text-sm sm:grid-cols-4">
            <Meta label="Filename" value={snapshot.source?.fileName ?? "Saved snapshot"} />
            <Meta label="Size" value={snapshot.source ? `${snapshot.source.sizeBytes.toLocaleString()} bytes` : "Stored version"} />
            <Meta label="Rows × columns" value={`${snapshot.rows} × ${snapshot.cols}`} />
            <Meta label="Populated cells" value={String(Object.keys(snapshot.cells).length)} />
            <label className="grid gap-1 text-xs font-bold text-slate-500"><span className="uppercase">Sheet language</span><select className="input" value={snapshot.language} onChange={(event) => setSnapshot((current) => current ? { ...current, language: event.target.value as WorkingSheetSnapshot["language"] } : current)}><option>English</option><option>Hindi</option></select></label>
          </div>
          <h3 className="mt-5 font-black">Sheet preview</h3>
          <p className="text-xs text-slate-500">Review that values and formulas imported correctly before publishing.</p>
          <div className="mt-3 max-h-96 overflow-auto rounded-lg border">
            <table className="min-w-full border-collapse text-xs">
              <thead><tr className="bg-slate-100"><th className="border p-1" />{colLetters.map((letter) => <th key={letter} className="border p-1 font-black">{letter}</th>)}</tr></thead>
              <tbody>
                {rowNumbers.map((row) => (
                  <tr key={row}>
                    <th className="border bg-slate-50 p-1 font-black">{row}</th>
                    {colLetters.map((letter) => {
                      const cell = snapshot.cells[`${letter}${row}`];
                      return <td key={letter} className="border p-1" style={{ fontWeight: cell?.bold ? 700 : 400, fontStyle: cell?.italic ? "italic" : "normal", backgroundColor: cell?.fillColor ? `#${cell.fillColor}` : undefined, textAlign: cell?.align }}>{cell?.formula ?? cell?.value ?? ""}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </fieldset>
  );
}
function Meta({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-2"><strong className="block text-[10px] uppercase text-slate-500">{label}</strong>{value}</div>; }
