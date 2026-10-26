"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RichSheetEditor, type ExcelDocument } from "./rich-sheet-editor";
import { BackButton } from "@/app/_components/back-button";
import { QuestionBar } from "@/components/efficiency/question-bar";
import { ConfirmDialog, FullscreenButton, formatClock, useExamCountdown } from "@/components/efficiency/exam-chrome";

type Question = { id: string; number: number; display_order: number; instruction: string | null; marks: number; section: string | null; is_visible: boolean };
type Snapshot = { title: string; language: string; instructions_markdown: string; duration_seconds: number; question_count: number; maximum_marks: number; questions: Question[]; show_questions?: boolean; delivery_onscreen?: boolean; question_toggle?: boolean };

export function ExcelWorkspace({ attemptId, snapshot, status, remainingSeconds, original, initialDocument }: { attemptId: string; snapshot: Snapshot; status: string; remainingSeconds: number; original: ExcelDocument; initialDocument?: ExcelDocument | null }) {
  // The admin decides (migration 202610252100): no on-screen questions (PDF only), or questions the student
  // may not hide. Attempts started before these settings keep the old behaviour (toggle allowed).
  const onscreen = snapshot.delivery_onscreen !== false;
  const canToggle = onscreen && snapshot.question_toggle !== false;
  const [showQuestions, setShowQuestions] = useState(onscreen && (Boolean(snapshot.show_questions) || !canToggle));
  const { remaining, expired } = useExamCountdown(remainingSeconds);
  const router = useRouter();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const questions = snapshot.questions ?? [];
  const catalogueHref = `/typing/excel-efficiency/${snapshot.language.toLowerCase() === "hindi" ? "hindi" : "english"}`;
  const submitted = status === "submitted" || status === "completed";
  return (
    <main className="h-dvh overflow-hidden bg-slate-100">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 bg-slate-950 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <BackButton href={catalogueHref} label="Exit" dark onNavigate={(event) => { if (!submitted) { event.preventDefault(); setLeaveOpen(true); } }} />
          <div><p className="text-xs font-black uppercase tracking-wider text-emerald-300">Excel Efficiency</p><h1 className="font-black">{snapshot.title}</h1></div>
        </div>
        <div className="flex items-center gap-3">
          <FullscreenButton />
          <span className="rounded-xl bg-white/10 px-3 py-2 text-sm font-black">{snapshot.maximum_marks} total marks</span>
          <span aria-live="polite" className="rounded-xl bg-white/10 px-4 py-2 font-mono text-xl font-black">{formatClock(remaining)}</span>
          <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-black">{submitted ? "Submitted" : "Active"}</span>
        </div>
      </header>
      <div className="h-[calc(100dvh-4rem)] min-h-0">
        <RichSheetEditor attemptId={attemptId} original={original} initialDocument={initialDocument} locked={submitted} autoSubmit={expired}
          questionBar={onscreen ? <QuestionBar questions={questions} current={current} onSelect={setCurrent} language={snapshot.language} collapsed={!showQuestions} onToggle={canToggle ? () => setShowQuestions((value) => !value) : undefined} /> : null} />
      </div>
      <ConfirmDialog open={leaveOpen} title="Leave the test?" message="Your progress is saved automatically, but the timer keeps running while you are away." confirmLabel="Leave test" cancelLabel="Stay" onCancel={() => setLeaveOpen(false)} onConfirm={() => { setLeaveOpen(false); router.push(catalogueHref); }} />
    </main>
  );
}
