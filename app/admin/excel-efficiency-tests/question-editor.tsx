"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateExcelQuestionSummary, MAX_EXCEL_QUESTION_MARKS, type ExcelQuestion } from "@/lib/excel-efficiency";
import type { ExtractedWordQuestion } from "@/lib/word-pdf-extraction";
import { QuestionContentEditor, type QuestionTypingLanguage } from "@/components/efficiency/question-content-editor";
import { QuestionContent } from "@/components/efficiency/question-content";

// The same question editor as on the Word Efficiency admin page: one line per question (tick box, number,
// start of the text, marks) that ▾ opens for editing, Select all, bulk marks and Distribute, and the
// English / हिन्दी typing switch that follows the test's Language.
type EditorQuestion = ExcelQuestion & { clientId: string; selected: boolean };

const fresh = (number: number): EditorQuestion => ({ clientId: crypto.randomUUID(), selected: false, id: "", version_id: "", question_number: number, instruction: "", marks: 1, section: null, display_order: number, is_visible: true, gradingRule: null });
const normalize = (items: EditorQuestion[]) => items.map((item, index) => ({ ...item, display_order: index + 1 }));

export function QuestionEditor({ initialQuestions }: { initialQuestions: ExcelQuestion[] }) {
  // Deterministic ids for the first render (server and browser must agree); see the Word editor.
  const [questions, setQuestions] = useState<EditorQuestion[]>(() => normalize((initialQuestions.length ? initialQuestions : [fresh(1)]).map((question, index) => ({ ...question, clientId: question.id || `new-${index}`, selected: false, display_order: index + 1 }))));
  const [bulkMarks, setBulkMarks] = useState("1");
  const [bulkNote, setBulkNote] = useState<{ text: string; undo?: EditorQuestion[] } | null>(null);
  const [preview, setPreview] = useState(false);
  const [dragged, setDragged] = useState<number | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggleOpen = (id: string) => setOpen((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const [typing, setTyping] = useState<QuestionTypingLanguage>("English");
  useEffect(() => { const select = document.querySelector<HTMLSelectElement>('select[name="language"]'); if (!select) return; const follow = () => setTyping(select.value === "Hindi" ? "Hindi" : "English"); follow(); select.addEventListener("change", follow); return () => select.removeEventListener("change", follow); }, []);
  // Questions read from the question paper PDF (Question Delivery and PDF box).
  useEffect(() => {
    const receive = (event: Event) => {
      const { mode, questions: extracted } = (event as CustomEvent<{ mode: "append" | "replace"; questions: ExtractedWordQuestion[] }>).detail;
      setQuestions((current) => {
        const blank = current.length === 1 && !current[0].instruction.trim() && !current[0].id;
        const imported = extracted.map((item, index): EditorQuestion => ({ ...fresh(item.number || index + 1), instruction: item.text, section: item.section, marks: Number.NaN }));
        return normalize(mode === "replace" || blank ? imported : [...current, ...imported]);
      });
    };
    window.addEventListener("excel-efficiency:questions-import", receive);
    return () => window.removeEventListener("excel-efficiency:questions-import", receive);
  }, []);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  useEffect(() => { if (!pendingDelete) return; const timer = window.setTimeout(() => setPendingDelete(null), 5000); return () => window.clearTimeout(timer); }, [pendingDelete]);
  const summary = useMemo(() => calculateExcelQuestionSummary(questions.map((q) => ({ marks: q.marks }))), [questions]);
  const allSelected = questions.length > 0 && questions.every((item) => item.selected), someSelected = questions.some((item) => item.selected);

  const update = (id: string, patch: Partial<EditorQuestion>) => setQuestions((items) => items.map((item) => (item.clientId === id ? { ...item, ...patch } : item)));
  const move = (index: number, direction: -1 | 1) => setQuestions((items) => { const next = [...items]; const target = index + direction; if (target < 0 || target >= next.length) return items; [next[index], next[target]] = [next[target], next[index]]; return normalize(next); });
  const add = () => { const question = fresh(Math.max(0, ...questions.map((item) => item.question_number ?? 0)) + 1); setQuestions((items) => [...items, question]); setOpen((current) => new Set(current).add(question.clientId)); };
  const duplicate = (index: number) => setQuestions((items) => { const source = items[index]; const copy = { ...source, id: "", clientId: crypto.randomUUID(), question_number: Math.max(0, ...items.map((item) => item.question_number ?? 0)) + 1, selected: false }; const next = [...items]; next.splice(index + 1, 0, copy); return normalize(next); });
  const remove = (id: string) => { if (questions.length > 1 && pendingDelete !== id) { setPendingDelete(id); return; } setPendingDelete(null); setQuestions((items) => normalize(items.filter((item) => item.clientId !== id))); };
  const applyBulk = (selectedOnly: boolean) => { const marks = Number(bulkMarks); if (!Number.isFinite(marks) || marks <= 0 || marks > MAX_EXCEL_QUESTION_MARKS) { setBulkNote({ text: `Enter marks between 0.01 and ${MAX_EXCEL_QUESTION_MARKS}.` }); return; } const targets = selectedOnly ? questions.filter((item) => item.selected) : questions; if (!targets.length) { setBulkNote({ text: "Tick at least one question first (the tick box at the start of each question)." }); return; } const before = questions; setQuestions((items) => items.map((item) => (!selectedOnly || item.selected ? { ...item, marks } : item))); setBulkNote({ text: `Set ${targets.length} question${targets.length === 1 ? "" : "s"} to ${marks} mark${marks === 1 ? "" : "s"} each.`, undo: before }); };
  const distribute = () => { const total = Number(bulkMarks); const count = questions.length; if (!Number.isFinite(total) || total <= 0 || !count) { setBulkNote({ text: "Enter the total marks in the box first." }); return; } const each = Math.floor((total / count) * 100) / 100; const last = Math.round((total - each * (count - 1)) * 100) / 100; if (each <= 0 || last > MAX_EXCEL_QUESTION_MARKS) { setBulkNote({ text: "That total can't be shared across these questions." }); return; } const before = questions; setQuestions((items) => items.map((item, index) => ({ ...item, marks: index === items.length - 1 ? last : each }))); setBulkNote({ text: last === each ? `Shared ${total} marks equally: ${each} mark${each === 1 ? "" : "s"} for each of ${count} questions.` : `Shared ${total} marks: ${each} for each question, ${last} for the last one so the total is exactly ${total}.`, undo: before }); };

  const serialized = questions.map((question) => ({ id: question.id || undefined, number: question.question_number, instruction: question.instruction, marks: Number.isFinite(question.marks) ? question.marks : null, section: question.section, display_order: question.display_order, is_visible: question.is_visible, solution: question.solution ?? null, solution_image: question.solution_image ?? null, gradingRule: question.gradingRule }));

  return (
    <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <input type="hidden" name="questions" value={JSON.stringify(serialized)} />
      <input type="hidden" name="questionCount" value={shown(summary.questionCount)} />
      <input type="hidden" name="maximumMarks" value={shown(summary.maximumMarks)} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-lg font-black">Question editor</h3><p className="text-sm text-slate-500">Marks are assigned per question. The test total is calculated automatically.</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => setPreview(true)} className="rounded-lg bg-violet-100 px-3 py-2 text-sm font-bold text-violet-800">Preview Question Paper</button><button type="button" onClick={add} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white">Add Question</button></div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><Summary label="Total questions" value={summary.questionCount} /><Summary label="Total maximum marks" value={summary.maximumMarks} /><Summary label="Questions without marks" value={summary.questionsWithoutMarks} /><Summary label="Average marks" value={summary.averageMarks} /></dl>
      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
        <label className="text-xs font-bold">Bulk marks<input type="number" min="0.01" max={MAX_EXCEL_QUESTION_MARKS} step="0.01" value={bulkMarks} onChange={(event) => setBulkMarks(event.target.value)} className="input mt-1 w-28" /></label>
        <button type="button" onClick={() => applyBulk(false)} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white">Apply marks to all questions</button>
        <button type="button" onClick={() => applyBulk(true)} className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-bold">Apply marks to selected questions</button>
        <button type="button" onClick={distribute} className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-bold">Distribute total marks equally</button>
        {bulkNote && <p role="status" className="basis-full text-sm font-bold text-slate-700">{bulkNote.text} {bulkNote.undo && <button type="button" onClick={() => { setQuestions(bulkNote.undo!); setBulkNote(null); }} className="ml-1 text-blue-700 underline">Undo</button>}</p>}
        <p className="basis-full text-xs text-slate-500">The Apply buttons give each question this many marks; Distribute shares this number as the total across all questions.</p>
      </div>
      <label className="mt-4 flex w-fit items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold"><input type="checkbox" checked={allSelected} ref={(element) => { if (element) element.indeterminate = someSelected && !allSelected; }} onChange={(event) => { const checked = event.target.checked; setQuestions((items) => items.map((item) => ({ ...item, selected: checked }))); }} />Select all ({questions.filter((item) => item.selected).length}/{questions.length})</label>
      <div className="mt-2 space-y-2">
        {questions.map((question, index) => {
          const isOpen = open.has(question.clientId);
          return (
            <article key={question.clientId} draggable onDragStart={() => setDragged(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged === null || dragged === index) return; setQuestions((items) => { const next = [...items]; const [item] = next.splice(dragged, 1); next.splice(index, 0, item); return normalize(next); }); setDragged(null); }} className={`rounded-xl border bg-white shadow-sm ${isOpen ? "p-4" : "px-3 py-2"}`}>
              <div className="flex items-center gap-3">
                <input type="checkbox" aria-label={`Select question ${question.question_number}`} checked={question.selected} onChange={(event) => update(question.clientId, { selected: event.target.checked })} />
                <button type="button" onClick={() => toggleOpen(question.clientId)} aria-expanded={isOpen} aria-label={`${isOpen ? "Close" : "Open"} question ${question.question_number}`} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-black text-blue-800">Q{question.question_number}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{questionPreview(question.instruction) || <i className="text-slate-400">No question text yet</i>}</span>
                  <span className={`shrink-0 text-xs font-bold ${Number.isFinite(question.marks) ? "text-slate-500" : "text-red-700"}`}>{Number.isFinite(question.marks) ? `${question.marks} marks` : "no marks"}</span>
                  <span aria-hidden className={`shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
                </button>
              </div>
              {isOpen && (
                <>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="cursor-grab text-xs font-bold text-slate-500" title="Drag to reorder">↕ Display order {question.display_order}</span><div className="flex flex-wrap gap-1"><button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="mini">Move Up</button><button type="button" onClick={() => move(index, 1)} disabled={index === questions.length - 1} className="mini">Move Down</button><button type="button" onClick={() => duplicate(index)} className="mini">Duplicate Question</button><button type="button" onClick={() => remove(question.clientId)} className={`mini text-red-700${pendingDelete === question.clientId ? " font-black underline" : ""}`}>{pendingDelete === question.clientId ? "Click again to delete" : "Delete Question"}</button></div></div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Label text="Question number"><input className="input" type="number" min="1" value={question.question_number} onChange={(event) => update(question.clientId, { question_number: Number(event.target.value) })} /></Label>
                    <Label text="Individual maximum marks"><input className="input" type="number" min="0.01" max={MAX_EXCEL_QUESTION_MARKS} step="0.01" required value={Number.isFinite(question.marks) ? question.marks : ""} onChange={(event) => update(question.clientId, { marks: event.target.value === "" ? Number.NaN : Number(event.target.value) })} /></Label>
                    <Label text="Optional section/topic"><input className="input" value={question.section ?? ""} onChange={(event) => update(question.clientId, { section: event.target.value || null })} /></Label>
                    <label className="flex items-center gap-2 self-end pb-3 text-sm font-bold"><input type="checkbox" checked={question.is_visible} onChange={(event) => update(question.clientId, { is_visible: event.target.checked })} />Visible on screen</label>
                  </div>
                  <Label text="Question instruction/text — write or paste from Word/Excel; tables and lists are supported"><QuestionContentEditor ariaLabel={`Question ${question.question_number} instruction`} required={question.is_visible} value={question.instruction} onChange={(value) => update(question.clientId, { instruction: value })} typing={typing} onTypingChange={setTyping} /></Label>
                  <SolutionFields question={question} typing={typing} onTypingChange={setTyping} onChange={(patch) => update(question.clientId, patch)} />
                  {/* As on the Word page there is no grading-rule form here; a question's gradingRule is kept as it is. */}
                  {index > 0 && <button type="button" onClick={() => update(question.clientId, { marks: questions[index - 1].marks })} className="mt-3 text-sm font-bold text-blue-700">Copy marks from previous question</button>}
                </>
              )}
            </article>
          );
        })}
      </div>
      {preview && (
        <div role="dialog" aria-modal="true" aria-label="Question paper preview" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
          <section className="max-h-[90dvh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6">
            <div className="flex justify-between"><h3 className="text-xl font-black">Question Paper Preview · {summary.maximumMarks} marks</h3><button type="button" onClick={() => setPreview(false)} className="font-black">Close</button></div>
            <div className="mt-5 space-y-4">{questions.map((question) => <article key={question.clientId} className="rounded-xl border p-4"><h4 className="font-black">Question {question.question_number} · {Number.isFinite(question.marks) ? `${question.marks} marks` : "no marks yet"}</h4>{question.section && <p className="text-xs font-bold text-blue-700">{question.section}</p>}{question.is_visible ? <div className="mt-2"><QuestionContent text={question.instruction} /></div> : <p className="mt-2">See Question {question.question_number} in the workspace — {question.marks} marks</p>}</article>)}</div>
          </section>
        </div>
      )}
    </section>
  );
}
// The start of a question for its one-line view: the formatting marks and table/list syntax left out.
function questionPreview(text: string) { return text.replace(/\*\*|__|==|\+\+|\*/g, "").replace(/\|/g, " ").replace(/^\s*(?:[-*]|\d+[.)])\s+/gm, "").replace(/\s+/g, " ").trim().slice(0, 160); }
function Label({ text, children }: { text: string; children: React.ReactNode }) { return <label className="grid gap-1 text-sm font-bold text-slate-700"><span>{text}</span>{children}</label>; }
// Paper solution for this question: steps (same text format as questions) and one screenshot, shown to students
// from their result page (migration 202610261000). The image is resized here so it stays small.
function SolutionFields({ question, typing, onTypingChange, onChange }: { question: EditorQuestion; typing: QuestionTypingLanguage; onTypingChange: (value: QuestionTypingLanguage) => void; onChange: (patch: Partial<EditorQuestion>) => void }) {
  const [problem, setProblem] = useState<string | null>(null);
  const pick = (file: File | null) => {
    setProblem(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setProblem("Choose a PNG, JPG or WebP picture."); return; }
    const url = URL.createObjectURL(file), image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1000 / image.width), canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const data = canvas.toDataURL("image/jpeg", 0.82);
      if (data.length > 690000) { setProblem("This picture is too large even after resizing; crop it and try again."); return; }
      onChange({ solution_image: data });
    };
    image.onerror = () => { URL.revokeObjectURL(url); setProblem("This picture could not be read."); };
    image.src = url;
  };
  return (
    <fieldset className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
      <legend className="px-1 text-sm font-black text-emerald-900">Paper solution (shown to students after they submit)</legend>
      <QuestionContentEditor ariaLabel={`Question ${question.question_number} solution steps`} required={false} value={question.solution ?? ""} onChange={(value) => onChange({ solution: value })} typing={typing} onTypingChange={onTypingChange} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-bold text-emerald-900">{question.solution_image ? "Replace screenshot" : "Add screenshot"}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { pick(event.target.files?.[0] ?? null); event.target.value = ""; }} /></label>
        {question.solution_image && <button type="button" onClick={() => onChange({ solution_image: null })} className="text-sm font-bold text-red-700">Remove screenshot</button>}
        {problem && <span role="alert" className="text-sm font-bold text-red-700">{problem}</span>}
      </div>
      {question.solution_image && <img src={question.solution_image} alt={`Solution screenshot for question ${question.question_number}`} className="mt-3 max-h-72 rounded-lg border border-emerald-200" />}
    </fieldset>
  );
}

// While a question has no marks yet (just imported, or its box emptied), a total is not a number: show 0.
const shown = (value: number) => (Number.isFinite(value) ? value : 0);
function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-blue-50 p-3"><dt className="text-xs font-bold text-blue-700">{label}</dt><dd className="mt-1 text-xl font-black">{shown(value)}</dd></div>; }
