"use client";

import { useRef, useState, useTransition } from "react";
import type { ExtractedWordQuestion } from "@/lib/word-pdf-extraction";
import { extractExcelEfficiencyPdf } from "./actions";

// The question paper PDF, as on the Word Efficiency admin page: it is saved with the test for students to download
// (when ticked), and its numbered questions can be read into the question editor below.
export function ExtractQuestionsPdf({ defaultDeliveryPdf = false, existingPdf = null }: { defaultDeliveryPdf?: boolean; existingPdf?: { fileName: string; sizeBytes: number | null } | null }) {
  const [deliveryPdf, setDeliveryPdf] = useState(defaultDeliveryPdf);
  const [removeExisting, setRemoveExisting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExtractedWordQuestion[]>([]);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const extract = () => {
    if (!file) return setMessage({ text: "Choose the question paper PDF first.", error: true });
    const data = new FormData();
    const languageControl = inputRef.current?.form?.elements.namedItem("language");
    data.set("language", languageControl instanceof HTMLSelectElement ? languageControl.value : "English");
    data.set("pdfFile", file);
    setMessage(null);
    startTransition(async () => {
      const result = await extractExcelEfficiencyPdf(data);
      if (!result.ok) { setPreview([]); setMessage({ text: result.error ?? "The PDF could not be read.", error: true }); return; }
      setPreview(result.questions.map((item) => ({ ...item, include: true })));
      setMessage({ text: `${result.questions.length} question${result.questions.length === 1 ? "" : "s"} found. Check them, then import.${"note" in result && result.note ? ` ${result.note}` : ""}`, error: false });
    });
  };
  const importQuestions = () => {
    const chosen = preview.filter((item) => item.include);
    if (!chosen.length) return setMessage({ text: "Tick at least one question to import.", error: true });
    window.dispatchEvent(new CustomEvent("excel-efficiency:questions-import", { detail: { questions: chosen } }));
    setPreview([]);
    setMessage({ text: `${chosen.length} question${chosen.length === 1 ? "" : "s"} added to the question editor below. Set each question's marks, then save.`, error: false });
  };

  return (
    <fieldset className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 p-4">
      <legend className="px-2 font-black">Question paper PDF</legend>
      <label className="flex items-start gap-3 text-sm font-bold"><input type="checkbox" name="deliveryPdf" checked={deliveryPdf} onChange={(event) => setDeliveryPdf(event.target.checked)} className="mt-0.5" /><span>Students can download the question paper PDF<span className="block font-normal text-slate-600">Shown on the test&apos;s instructions page. The questions also stay on screen in the workspace.</span></span></label>
      {existingPdf && <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-white p-3 text-sm"><span className="font-black">Current PDF: {existingPdf.fileName}</span>{existingPdf.sizeBytes ? <span className="text-slate-500">{Math.round(existingPdf.sizeBytes / 1024).toLocaleString("en-IN")} KB</span> : null}<label className="flex items-center gap-2 font-bold text-red-700"><input type="checkbox" name="removePdf" checked={removeExisting} onChange={(event) => setRemoveExisting(event.target.checked)} />Remove it</label></div>}
      <p className="mt-3 text-sm text-slate-600">{existingPdf ? "Choose a new PDF to replace it." : "Choose the question paper PDF (English, or Hindi in Kruti Dev 010)."} Extract Questions reads its numbered questions into the question editor below.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* Saved with the test when the form is saved (pdfFile); Extract Questions only reads it. */}
        <input ref={inputRef} type="file" name="pdfFile" accept=".pdf,application/pdf" aria-label="Question paper PDF" className="input max-w-md" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview([]); setMessage(null); }} />
        <button type="button" onClick={extract} disabled={pending} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{pending ? "Reading the PDF…" : "Extract Questions"}</button>
      </div>
      {message && <p role={message.error ? "alert" : "status"} className={`mt-3 rounded-lg p-3 text-sm font-bold ${message.error ? "bg-red-50 text-red-700" : "bg-white text-emerald-900"}`}>{message.text}</p>}
      {preview.length > 0 && (
        <section className="mt-3 rounded-xl border bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={preview.every((item) => item.include)} onChange={(event) => setPreview((items) => items.map((item) => ({ ...item, include: event.target.checked })))} />Select all</label>
            <button type="button" onClick={importQuestions} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">Import {preview.filter((item) => item.include).length} into the question editor</button>
          </div>
          <ol className="mt-3 max-h-80 space-y-2 overflow-auto">
            {preview.map((item) => (
              <li key={item.fingerprint} className="flex gap-2 rounded-lg border p-2 text-sm">
                <input type="checkbox" aria-label={`Import question ${item.number}`} checked={item.include} onChange={(event) => setPreview((items) => items.map((other) => other.fingerprint === item.fingerprint ? { ...other, include: event.target.checked } : other))} />
                <span className="font-black">Q{item.number}.</span>
                <textarea aria-label={`Question ${item.number} text`} value={item.text} rows={2} onChange={(event) => setPreview((items) => items.map((other) => other.fingerprint === item.fingerprint ? { ...other, text: event.target.value } : other))} className="min-w-0 flex-1 rounded border px-2 py-1" />
                {item.confidence !== "Detected" && <span className="self-start rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">Check</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </fieldset>
  );
}
