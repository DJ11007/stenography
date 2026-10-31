"use client";
import Link from "next/link";
import { useState } from "react";
import { isStaleServerActionError } from "@/lib/pending-attempts";
import { RichSheetEditor, type ExcelDocument } from "@/app/typing/excel-efficiency/[language]/[testId]/workspace/rich-sheet-editor";
import { diffExcelDocuments, excelQuestionRules, excelRuleGroups } from "@/lib/excel-document-diff";
import { resetExcelEfficiencyModelAnswer, saveExcelEfficiencyModelAnswer, saveExcelEfficiencyQuestionRules } from "../../actions";

type Question = { id: string; number: number; instruction: string; marks: number; graded: boolean };

// The admin solves the paper in the real Excel sheet, one question at a time, and presses "Save answer for Q<n>".
// What changed since the question was opened (formatting, typed values and formulas' results, merged cells, page
// settings...) becomes that question's marking rules, with the question's marks shared between the things it asks.
// Questions are answered in order: the sheet as it stood when a question was opened is that question's "before".
export function ModelAnswerEditor({ versionId, original, initialDocument, questions, autoGradingHref }: { versionId: string; original: ExcelDocument; initialDocument: unknown; questions: Question[]; autoGradingHref: string }) {
  const firstOpen = questions.find((question) => !question.graded)?.number ?? null;
  const [latest, setLatest] = useState<unknown>(initialDocument ?? null);
  const [checkpoints, setCheckpoints] = useState<Record<number, unknown>>(() => (initialDocument != null && firstOpen !== null ? { [firstOpen]: initialDocument } : {}));
  const [graded, setGraded] = useState<Set<number>>(() => new Set(questions.filter((question) => question.graded).map((question) => question.number)));
  const [activeNumber, setActiveNumber] = useState<number | null>(firstOpen);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [showQuestion, setShowQuestion] = useState(true);
  const [resetting, setResetting] = useState(false);

  const ready = latest !== null;
  const active = questions.find((question) => question.number === activeNumber) ?? null;
  const hasProgress = graded.size > 0 || Boolean(initialDocument);

  const handleReset = async () => {
    if (!confirm("Reset the model answer for this test? This clears every question's saved answer and auto-grading rule here — it does not change any student's already-graded result. This can't be undone.")) return;
    setResetting(true); setMessage(null);
    const result = await resetExcelEfficiencyModelAnswer(versionId).catch((error: unknown) => ({ ok: false, error: isStaleServerActionError(error) ? "This page was updated on the server. Refresh the page, then press Reset again." : "Could not reset. Check your internet connection and try again." }));
    if (!result.ok) { setResetting(false); setMessage({ text: result.error, ok: false }); return; }
    window.location.reload();
  };

  const selectQuestion = (number: number) => {
    if (!ready) return;
    setCheckpoints((current) => (number in current ? current : { ...current, [number]: latest }));
    setActiveNumber(number);
    setMessage(null);
  };

  // Nothing saved yet: the sheet as first drawn is the "before" state of the question that starts open.
  const handleReady = (sheet: ExcelDocument) => {
    if (latest === null) {
      setLatest(sheet);
      if (activeNumber !== null) setCheckpoints((current) => (activeNumber in current ? current : { ...current, [activeNumber]: sheet }));
    }
  };

  const saveActiveAnswer = async (_id: string, document: unknown): Promise<{ ok: boolean; error: string }> => {
    const saved = await saveExcelEfficiencyModelAnswer(versionId, document);
    if (!saved.ok) return saved;
    setLatest(document);
    if (activeNumber === null || !active) return { ok: true, error: "" };
    const before = checkpoints[activeNumber] ?? document;
    const { changes, unsupported } = diffExcelDocuments(before, document);
    const rules = excelQuestionRules(active.marks, excelRuleGroups(document, changes));
    if (!rules.length) {
      setMessage({ text: `No change was detected for Q${activeNumber}${unsupported.length ? ` that can be marked automatically (${unsupported.join(", ")} cannot be)` : ""} — nothing was changed in the sheet, so this question keeps its old rules and otherwise needs manual marking.`, ok: false });
      return { ok: true, error: "" };
    }
    const result = await saveExcelEfficiencyQuestionRules(versionId, activeNumber, rules);
    if (!result.ok) return { ok: false, error: result.error };
    const nextGraded = new Set(graded); nextGraded.add(activeNumber); setGraded(nextGraded);
    setMessage(unsupported.length
      ? { text: `Q${activeNumber} is graded, but these changes cannot be marked automatically and are not part of its rules: ${unsupported.join(", ")}.`, ok: false }
      : { text: `Saved. Q${activeNumber} is now auto-graded from your answer (${rules.length} part${rules.length === 1 ? "" : "s"}).`, ok: true });
    const upcoming = questions.find((question) => !nextGraded.has(question.number));
    if (upcoming) {
      setCheckpoints((current) => (upcoming.number in current ? current : { ...current, [upcoming.number]: document }));
      setActiveNumber(upcoming.number);
    } else setActiveNumber(null);
    return { ok: true, error: "" };
  };

  if (!questions.length) return <p className="mt-6 rounded-2xl bg-amber-50 p-5 text-sm font-bold text-amber-900">Add at least one question to this test (in the question editor) before authoring a model answer.</p>;

  return (
    <div className="mt-2">
      <div className="rounded-2xl bg-white px-3 py-2 shadow">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
            {questions.map((question) => {
              const done = graded.has(question.number), current = activeNumber === question.number;
              return (
                <button key={question.id} type="button" disabled={!ready} onClick={() => selectQuestion(question.number)} aria-pressed={current}
                  aria-label={`Question ${question.number}, ${question.marks} marks, ${done ? "graded" : "not graded"}`} title={`Q${question.number} · ${question.marks} marks · ${done ? "graded" : "not graded"}`}
                  className={`flex h-7 flex-none items-center gap-1 rounded-md border px-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50 ${current ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}>
                  Q{question.number}
                  <span aria-hidden className={`text-[13px] leading-none ${current ? (done ? "text-green-300" : "text-red-300") : done ? "text-green-600" : "text-red-600"}`}>{done ? "✓" : "✗"}</span>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setShowQuestion((open) => !open)} aria-expanded={showQuestion} aria-label={showQuestion ? "Hide the question text" : "Show the question text"} title={showQuestion ? "Hide the question text" : "Show the question text"}
            className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100">
            <svg viewBox="0 0 24 24" aria-hidden className={`h-4 w-4 transition-transform ${showQuestion ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <Link href={autoGradingHref} className="h-7 flex-none rounded-md border border-emerald-300 px-2 py-1 text-xs font-black text-emerald-800 hover:bg-emerald-50">Auto-grading</Link>
          <button type="button" disabled={resetting || !hasProgress} onClick={handleReset} title={hasProgress ? "Clear every saved answer and start this paper over" : "Nothing to reset yet"}
            className="h-7 flex-none rounded-md border border-red-200 px-2 text-xs font-black text-red-700 disabled:cursor-not-allowed disabled:opacity-40">{resetting ? "Resetting…" : "Reset"}</button>
        </div>
        {!ready && <p className="mt-1 text-xs text-slate-500">Loading the sheet…</p>}
        {active && showQuestion && <p className="mt-1.5 text-sm text-slate-900"><span className="font-black text-emerald-800">Q{active.number}.</span> {active.instruction} <span className="whitespace-nowrap text-[11px] font-bold text-slate-500">({active.marks} marks)</span></p>}
        {!active && ready && <p className="mt-1.5 rounded-md bg-green-50 px-2 py-1 text-xs font-bold text-green-900">Every question has rules. Click a question to redo it, or open Auto-grading to check them and turn on automatic publishing.</p>}
        {message && <p role={message.ok ? "status" : "alert"} className={`mt-1.5 rounded-md px-2 py-1 text-xs font-bold ${message.ok ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}>{message.text}</p>}
      </div>
      <section className="mt-2 h-[calc(100dvh-8.5rem)] min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow">
        <RichSheetEditor attemptId={versionId} original={original} initialDocument={initialDocument as ExcelDocument | null} locked={false} mode="authoring" oneTimeSubmit={false}
          submitLabel={active ? `Save answer for Q${active.number}` : "Save Model Answer"} submitConfirmMessage={null}
          autosaveAction={saveExcelEfficiencyModelAnswer} submitAction={saveActiveAnswer} onReady={handleReady} />
      </section>
    </div>
  );
}
