"use client";
import { useEffect } from "react";

export type ExamQuestion = { message: string; confirmLabel: string; onConfirm: () => void };

// Keys that leave, reload or cover the test page. A student's stray finger on one of these used to end
// the attempt with no result: Back went to another page (the "leave page?" warning does not cover moves
// inside the site), and a browser OK/Cancel box -- whose OK button has the focus -- was accepted by the
// next Space or Enter the student typed. While a test is running these keys do nothing except show a
// short warning, and every question is asked on the page, answered only by clicking.
function blockedKeyName(event: KeyboardEvent): string | null {
  const key = event.key;
  const ctrl = event.ctrlKey || event.metaKey;
  if (["BrowserBack", "BrowserForward", "BrowserRefresh", "BrowserHome", "BrowserSearch", "BrowserFavorites"].includes(key)) return key.replace("Browser", "Browser ");
  if (key === "F5" || (ctrl && (key === "r" || key === "R"))) return "Refresh (F5 / Ctrl+R)";
  if (event.altKey && (key === "ArrowLeft" || key === "ArrowRight" || key === "Home")) return `Alt+${key.replace("Arrow", "")}`;
  if (["F1", "F3", "F6", "F7", "F10", "ContextMenu"].includes(key)) return key;
  if (ctrl && !event.altKey && ["p", "P", "s", "S", "o", "O", "u", "U", "l", "L", "f", "F", "g", "G", "h", "H", "j", "J", "d", "D"].includes(key)) return `Ctrl+${key.toUpperCase()}`;
  return null;
}

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
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("popstate", onPop, true);
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("popstate", onPop, true); };
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
