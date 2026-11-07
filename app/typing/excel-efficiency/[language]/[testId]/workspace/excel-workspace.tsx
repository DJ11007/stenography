"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RichSheetEditor, type ExcelDocument } from "./rich-sheet-editor";
import { BackButton } from "@/app/_components/back-button";
import { QuestionBar } from "@/components/efficiency/question-bar";
import { ConfirmDialog, ExamClock, FullscreenButton } from "@/components/efficiency/exam-chrome";

type Question = { id: string; number: number; display_order: number; instruction: string | null; marks: number; section: string | null; is_visible: boolean };
type Snapshot = { title: string; language: string; instructions_markdown: string; duration_seconds: number; question_count: number; maximum_marks: number; questions: Question[]; show_questions?: boolean; delivery_onscreen?: boolean; question_toggle?: boolean };

// liveExam: inside a Live Exam Center part — no Exit, and after submitting the exam page carries on (no result page).
export function ExcelWorkspace({ attemptId, snapshot, status, remainingSeconds, original, initialDocument, liveExam }: { liveExam?: { onSubmitted: () => void }; attemptId: string; snapshot: Snapshot; status: string; remainingSeconds: number; original: ExcelDocument; initialDocument?: ExcelDocument | null }) {
  // The admin decides (migration 202610252100): no on-screen questions (PDF only), or questions the student
  // may not hide. Attempts started before these settings keep the old behaviour (toggle allowed).
  const onscreen = snapshot.delivery_onscreen !== false;
  const canToggle = onscreen && snapshot.question_toggle !== false;
  const [showQuestions, setShowQuestions] = useState(onscreen && (Boolean(snapshot.show_questions) || !canToggle));
  // The clock redraws itself only (ExamClock); this page, and the sheet in it, redraw once when time runs out.
  const [expired, setExpired] = useState(false);
  const router = useRouter();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const questions = useMemo(() => snapshot.questions ?? [], [snapshot.questions]);
  const catalogueHref = `/typing/excel-efficiency/${snapshot.language.toLowerCase() === "hindi" ? "hindi" : "english"}`;
  const submitted = status === "submitted" || status === "completed";
  // Stable props, so the sheet (a memo component) does not redraw when only this page does — e.g. on every tick of
  // the Live Exam page's clock around it.
  const onExpire = useCallback(() => setExpired(true), []);
  const submittedRef = useRef(liveExam?.onSubmitted);
  useEffect(() => { submittedRef.current = liveExam?.onSubmitted; });
  const afterSubmit = useCallback(() => submittedRef.current?.(), []);
  const toggleQuestions = useCallback(() => setShowQuestions((value) => !value), []);
  const questionBar = useMemo(() => (onscreen
    ? <QuestionBar questions={questions} current={current} onSelect={setCurrent} language={snapshot.language} collapsed={!showQuestions} onToggle={canToggle ? toggleQuestions : undefined} />
    : null), [onscreen, questions, current, snapshot.language, showQuestions, canToggle, toggleQuestions]);
  return (
    <main className="h-dvh overflow-hidden bg-slate-100">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 bg-slate-950 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          {!liveExam && <BackButton href={catalogueHref} label="Exit" dark onNavigate={(event) => { if (!submitted) { event.preventDefault(); setLeaveOpen(true); } }} />}
          <div><p className="text-xs font-black uppercase tracking-wider text-emerald-300">Excel Efficiency</p><h1 className="font-black">{snapshot.title}</h1></div>
        </div>
        <div className="flex items-center gap-3">
          <FullscreenButton />
          <span className="rounded-xl bg-white/10 px-3 py-2 text-sm font-black">{snapshot.maximum_marks} total marks</span>
          <ExamClock remainingSeconds={remainingSeconds} onExpire={onExpire} className="rounded-xl bg-white/10 px-4 py-2 font-mono text-xl font-black" />
          <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-black">{submitted ? "Submitted" : "Active"}</span>
        </div>
      </header>
      <div className="h-[calc(100dvh-4rem)] min-h-0">
        <RichSheetEditor afterSubmit={liveExam ? afterSubmit : undefined} attemptId={attemptId} original={original} initialDocument={initialDocument} locked={submitted} autoSubmit={expired} questionBar={questionBar} />
      </div>
      <ConfirmDialog open={leaveOpen} title="Leave the test?" message="Your progress is saved automatically, but the timer keeps running while you are away." confirmLabel="Leave test" cancelLabel="Stay" onCancel={() => setLeaveOpen(false)} onConfirm={() => { setLeaveOpen(false); router.push(catalogueHref); }} />
    </main>
  );
}
