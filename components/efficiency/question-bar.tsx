"use client";

import { splitQuestionParts } from "@/lib/question-parts";
import { QuestionContent } from "./question-content";

// The exam's question paper as a bar between the ribbon and the page, laid out like the admin's Model Answer bar:
// the question buttons in one row across the top (scrolling sideways when there are many), the chosen question's
// marks and a Hide/Show arrow at the right, and the question text underneath with its a), b), c) parts on separate
// lines. The arrow folds away only the text, so the buttons stay and the page gets the space. It used to stack the
// buttons in a narrow block beside the text, which got cramped inside the live exam's narrower screen.
type BarQuestion = { id: string; number: number; instruction: string | null; marks: number; section: string | null };

export function QuestionBar({ questions, current, onSelect, language, collapsed = false, onToggle }: { questions: BarQuestion[]; current: number; onSelect: (index: number) => void; language: string; collapsed?: boolean; onToggle?: () => void }) {
  const question = questions[current];
  if (!question) return null;
  const split = splitQuestionParts(question.instruction);
  return (
    <section aria-label="Question paper" lang={language === "Hindi" ? "hi" : "en"} className="flex max-h-[34vh] min-h-0 flex-none flex-col border-b border-slate-300 bg-white px-3 py-1.5 text-slate-900">
      <div className="flex flex-none items-center gap-2">
        <nav aria-label="Questions" className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          {questions.map((item, index) => (
            <button key={item.id} type="button" aria-current={index === current ? "step" : undefined} aria-label={`Question ${item.number}, ${item.marks} marks`} title={`Question ${item.number} · ${item.marks} marks`}
              onMouseDown={event => event.preventDefault()} onClick={() => onSelect(index)}
              className={`h-7 min-w-9 flex-none rounded-md border px-2 text-xs font-black ${index === current ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50"}`}>
              Q{item.number}
            </button>
          ))}
        </nav>
        <span className="flex-none whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{question.marks} marks</span>
        {onToggle && (
          <button type="button" aria-expanded={!collapsed} aria-label={collapsed ? "Show Questions" : "Hide Questions"} title={collapsed ? "Show the question" : "Hide the question"}
            onMouseDown={event => event.preventDefault()} onClick={onToggle}
            className="flex h-7 w-8 flex-none items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100">
            <svg aria-hidden viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        )}
      </div>
      {!collapsed && (
        <div className="mt-1 min-h-0 overflow-y-auto text-sm leading-snug">
          {question.section && <p className="text-xs font-bold text-slate-500">{question.section}</p>}
          {split ? <>
            <p><span className="font-black text-blue-800">Q{question.number}.</span> {split.intro && <span className="text-slate-600">{split.intro}</span>}</p>
            <ol className="mt-0.5 space-y-0.5">
              {split.parts.map(part => <li key={part.label} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-1"><span className="font-black text-blue-800">{part.label})</span><span>{part.text}</span></li>)}
            </ol>
          </> : <div className="flex gap-1.5"><span className="flex-none font-black text-blue-800">Q{question.number}.</span><QuestionContent className="!space-y-1 !text-sm !leading-snug" text={question.instruction} /></div>}
        </div>
      )}
    </section>
  );
}
