"use client";
import { useState } from "react";
import { prepareExcelAttempt } from "../../../actions";

export function StudentTestLaunch({ testId, language, duration, serverError }: { testId: string; language: string; duration: number; serverError?: string }) {
  const [accepted, setAccepted] = useState(false);
  const [showQuestions, setShowQuestions] = useState(true);
  return (
    <form action={prepareExcelAttempt} className="h-fit rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <input type="hidden" name="testId" value={testId} />
      <input type="hidden" name="duration" value={duration} />
      <input type="hidden" name="language" value={language} />
      <h2 className="font-black">Question delivery</h2>
      <div className="mt-3 rounded-xl bg-white p-4">
        <strong className="block">On-screen questions</strong>
        <span className="mt-1 block text-xs leading-5 text-slate-600">Questions and navigation will be available in the spreadsheet workspace.</span>
        <label className="mt-3 flex gap-2 text-sm font-bold">
          <input type="checkbox" name="showQuestions" checked={showQuestions} onChange={(event) => setShowQuestions(event.target.checked)} />
          Show questions inside the test workspace
        </label>
        {!showQuestions && <p className="mt-2 text-xs text-amber-700">The panel starts hidden; use Show Questions in the workspace to reopen it.</p>}
      </div>
      <label className="mt-5 flex gap-3 rounded-xl border border-emerald-200 bg-white p-4 text-sm font-bold">
        <input type="checkbox" name="accepted" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required />
        I have read and understood the instructions.
      </label>
      {serverError && <p role="alert" className="mt-3 text-sm font-bold text-red-700">{serverError}</p>}
      <button disabled={!accepted} className="mt-5 w-full rounded-xl bg-emerald-700 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">Start Test</button>
      <p className="mt-3 text-center text-xs text-slate-500">Your attempt and timer begin only when Start Test is pressed.</p>
    </form>
  );
}
