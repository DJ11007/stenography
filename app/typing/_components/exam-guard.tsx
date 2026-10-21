"use client";
import { useEffect } from "react";
import { blockedKeyName } from "@/lib/exam-blocked-keys";

export type ExamQuestion = { message: string; confirmLabel: string; onConfirm: () => void };

export function ExamGuard({ active, question, onAnswer, notice, onNotice }: { active: boolean; question: ExamQuestion | null; onAnswer: (yes: boolean) => void; notice: string | null; onNotice: (message: string | null) => void }) {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      const name = blockedKeyName(event);
      if (!name) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onNotice(`${name} is turned off during the test, so your test is not lost. Keep typing.`);
    };
    // Back (Alt+Left, the keyboard or mouse Back button) inside the site: step forward again at once.
    // Handled before Next.js's own listener, so the page is never left.
    const guardState = () => ({ ...(window.history.state ?? {}), typingExamGuard: true });
    window.history.pushState(guardState(), "", window.location.href);
    const onPop = (event: PopStateEvent) => {
      event.stopImmediatePropagation();
      window.history.pushState(guardState(), "", window.location.href);
      onNotice("Going back is turned off during the test, so your test is not lost. Finish or submit the test first.");
    };
    // The right-click menu has "Inspect" (Developer Tools) and "Back"/"Reload"; it is never needed to type.
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      onNotice("The right-click menu is turned off during the test, so your test is not lost. Keep typing.");
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("popstate", onPop, true);
    window.addEventListener("contextmenu", onContextMenu, true);
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("popstate", onPop, true); window.removeEventListener("contextmenu", onContextMenu, true); };
  }, [active, onNotice]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => onNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice, onNotice]);
  return (
    <>
      {notice && <div role="status" className="fixed left-1/2 top-4 z-[200] max-w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-slate-950 shadow-xl">{notice}</div>}
      {question && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/50 p-4" role="alertdialog" aria-modal="true" aria-label={question.message}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-base font-bold text-slate-900">{question.message}</p>
            <p className="mt-2 text-xs text-slate-500">Click a button to answer. Typing keys do not answer this question.</p>
            <div className="mt-5 flex justify-end gap-3">
              {/* tabIndex -1 and no autofocus: Space / Enter typed by a student cannot press these. */}
              <button type="button" tabIndex={-1} onMouseDown={event => event.preventDefault()} onClick={() => onAnswer(false)} className="rounded-xl border border-slate-300 px-4 py-2 font-black text-slate-700">Cancel</button>
              <button type="button" tabIndex={-1} onMouseDown={event => event.preventDefault()} onClick={() => onAnswer(true)} className="rounded-xl bg-red-600 px-4 py-2 font-black text-white">{question.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
