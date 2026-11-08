"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setQuestionPaperReady } from "./question-paper-actions";

// On a test's row in the admin list: whether students can download its question paper, and a preview of the paper.
// Turn it on only after checking that the test works (questions, marks, model answer).
export function QuestionPaperToggle({ subject, testId, language, ready }: { subject: "word" | "excel"; testId: string; language: string; ready: boolean }) {
  const [on, setOn] = useState(ready);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const toggle = () => {
    const next = !on;
    setError("");
    setOn(next);
    startTransition(async () => {
      const result = await setQuestionPaperReady(subject, testId, next).catch(() => ({ ok: false, error: "Could not save. Check your internet connection and try again." }));
      if (!result.ok) { setOn(!next); setError(result.error); }
    });
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" role="switch" aria-checked={on} disabled={pending} onClick={toggle}
        title={on ? "Students can download the question paper. Click to turn it off." : "Turn on after checking the test works: students then get a Download question paper button."}
        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold disabled:opacity-60 ${on ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}>
        Question paper: {on ? "On" : "Off"}
      </button>
      <Link href={`/admin/question-paper/${subject}/${language.toLowerCase()}/${testId}`} target="_blank" className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 underline-offset-2 hover:underline">Preview</Link>
      {error && <p role="alert" className="w-full text-xs font-bold text-red-700">{error}</p>}
    </div>
  );
}
