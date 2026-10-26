"use client";

import { splitQuestionParts } from "@/lib/question-parts";
import { QuestionContent } from "./question-content";

// The exam's question paper as a bar between the ribbon and the page (replaces the
// narrow side panel, which wrapped each question into a column of tiny text):
// numbered buttons to switch question, and the chosen question with its a), b), c)
// parts on separate lines. The page keeps its full width. With onToggle, a Hide/Show arrow
// button after the marks folds the bar to one slim strip so the page gets the space.
type BarQuestion = { id: string; number: number; instruction: string | null; marks: number; section: string | null };

export function QuestionBar({ questions, current, onSelect, language, collapsed = false, onToggle }: { questions: BarQuestion[]; current: number; onSelect: (index: number) => void; language: string; collapsed?: boolean; onToggle?: () => void }) {
  const question = questions[current];
  if (!question) return null;
  const toggle = onToggle && (
    <button type="button" aria-expanded={!collapsed} aria-label={collapsed ? "Show Questions" : "Hide Questions"} title={collapsed ? "Show Questions" : "Hide Questions"}
      onMouseDown={event => event.preventDefault()} onClick={onToggle}
      className="flex h-7 flex-none items-center gap-1 rounded-md border border-blue-700 bg-blue-700 pl-2 pr-1.5 text-xs font-black text-white shadow-sm hover:bg-blue-800">
      {collapsed ? "Show" : "Hide"}
      <svg aria-hidden viewBox="0 0 16 16" className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10l4-4 4 4" /></svg>
    </button>
  );
  if (collapsed) return (
    <section aria-label="Question paper" className="flex flex-none items-center gap-3 border-b border-slate-300 bg-white px-3 py-1 text-slate-900">
      <p className="min-w-0 flex-1 truncate text-xs font-bold text-slate-600">Questions hidden · Q{question.number} of {questions.length}</p>
      <span className="flex-none whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{question.marks} marks</span>
      {toggle}
    </section>
  );
  const split = splitQuestionParts(question.instruction);
  return (
    <section aria-label="Question paper" lang={language === "Hindi" ? "hi" : "en"} className="flex max-h-[32vh] min-h-0 flex-none items-start gap-3 overflow-y-auto border-b border-slate-300 bg-white px-3 py-2 text-slate-900">
      <nav aria-label="Questions" className="flex max-w-[11rem] flex-none flex-wrap gap-1 pt-0.5">
        {questions.map((item, index) => (
          <button key={item.id} type="button" aria-current={index === current ? "step" : undefined} aria-label={`Question ${item.number}, ${item.marks} marks`} title={`Question ${item.number} · ${item.marks} marks`}
            onMouseDown={event => event.preventDefault()} onClick={() => onSelect(index)}
            className={`h-7 min-w-7 rounded-md border px-1.5 text-xs font-black ${index === current ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50"}`}>
            {index === current ? `Q${item.number}` : item.number}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 text-sm leading-snug">
        {question.section && <p className="text-xs font-bold text-slate-500">{question.section}</p>}
        {split ? <>
          {split.intro && <p className="text-xs text-slate-500">{split.intro}</p>}
          <ol className="mt-0.5 space-y-0.5">
            {split.parts.map(part => <li key={part.label} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-1"><span className="font-black text-blue-800">{part.label})</span><span>{part.text}</span></li>)}
          </ol>
        </> : <QuestionContent className="!space-y-1 !text-sm !leading-snug" text={question.instruction} />}
      </div>
      <span className="flex-none whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{question.marks} marks</span>
      {toggle}
    </section>
  );
}
