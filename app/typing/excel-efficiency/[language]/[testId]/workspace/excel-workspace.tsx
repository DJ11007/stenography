"use client";
import { useEffect, useState } from "react";
import { RichSheetEditor, type ExcelDocument } from "./rich-sheet-editor";
import { BackButton } from "@/app/_components/back-button";
import { QuestionContent } from "@/components/efficiency/question-content";

type Question = { id: string; number: number; display_order: number; instruction: string | null; marks: number; section: string | null; is_visible: boolean };
type Snapshot = { title: string; language: string; instructions_markdown: string; duration_seconds: number; question_count: number; maximum_marks: number; questions: Question[]; show_questions?: boolean };

export function ExcelWorkspace({ attemptId, snapshot, status, startedAt, original, initialDocument }: { attemptId: string; snapshot: Snapshot; status: string; startedAt: string | null; original: ExcelDocument; initialDocument?: ExcelDocument | null }) {
  const startTime = startedAt ? new Date(startedAt).getTime() : Date.now();
  const [remaining, setRemaining] = useState(snapshot.duration_seconds);
  const [showQuestions, setShowQuestions] = useState(Boolean(snapshot.show_questions));
  useEffect(() => { const tick = () => setRemaining(Math.max(0, snapshot.duration_seconds - Math.floor((Date.now() - startTime) / 1000))); tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer); }, [snapshot.duration_seconds, startTime]);
  const questions = snapshot.questions ?? [];
  const catalogueHref = `/typing/excel-efficiency/${snapshot.language.toLowerCase() === "hindi" ? "hindi" : "english"}`;
  const submitted = status === "submitted" || status === "completed";
  return (
    <main className="h-dvh overflow-hidden bg-slate-100">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 bg-slate-950 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <BackButton href={catalogueHref} label="Exit" dark onNavigate={(event) => { if (!submitted && !confirm("Leave the test? Your progress autosaves, but the timer keeps running in the background.")) event.preventDefault(); }} />
          <div><p className="text-xs font-black uppercase tracking-wider text-emerald-300">Excel Efficiency</p><h1 className="font-black">{snapshot.title}</h1></div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setShowQuestions((value) => !value)} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-black">{showQuestions ? "Hide Questions" : "Show Questions"}</button>
          <span className="rounded-xl bg-white/10 px-3 py-2 text-sm font-black">{snapshot.maximum_marks} total marks</span>
          <span aria-live="polite" className="rounded-xl bg-white/10 px-4 py-2 font-mono text-xl font-black">{formatClock(remaining)}</span>
          <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-black">{submitted ? "Submitted" : "Active"}</span>
        </div>
      </header>
      <div className={`grid h-[calc(100dvh-4rem)] min-h-0 ${showQuestions ? "lg:grid-cols-[minmax(300px,34%)_minmax(0,1fr)]" : "grid-cols-1"}`}>
        {showQuestions && (
          <aside className="min-h-0 overflow-y-auto border-r border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between"><h2 className="font-black">Question paper</h2><span className="text-xs font-bold text-slate-500">{questions.length} questions</span></div>
            <p className="mt-1 text-xs text-slate-500">Complete each task directly in the spreadsheet.</p>
            <nav aria-label="Complete question paper" className="mt-4 flex w-full flex-col gap-3" lang={snapshot.language === "Hindi" ? "hi" : "en"}>
              {questions.map((item) => (
                <div key={item.id} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="block text-sm font-black text-emerald-800">Question {item.number}</span>
                  {item.section && <span className="mt-1 block text-xs font-bold text-slate-500">{item.section}</span>}
                  <QuestionContent className="mt-2 text-slate-900" text={item.instruction} />
                  <span className="mt-2 block text-xs font-bold text-slate-500">{item.marks} marks</span>
                </div>
              ))}
            </nav>
          </aside>
        )}
        <RichSheetEditor attemptId={attemptId} original={original} initialDocument={initialDocument} locked={submitted} />
      </div>
    </main>
  );
}
function formatClock(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
