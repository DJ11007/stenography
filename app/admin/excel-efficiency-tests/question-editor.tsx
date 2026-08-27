"use client";

import { useMemo, useState } from "react";
import { calculateExcelQuestionSummary, MAX_EXCEL_QUESTION_MARKS, type ExcelQuestion } from "@/lib/excel-efficiency";
import { QuestionContentEditor } from "@/components/efficiency/question-content-editor";
import { QuestionContent } from "@/components/efficiency/question-content";

type EditorQuestion = ExcelQuestion & { clientId: string; selected: boolean };

const fresh = (number: number): EditorQuestion => ({ clientId: crypto.randomUUID(), selected: false, id: "", version_id: "", question_number: number, number, instruction: "", marks: 1, section: null, display_order: number, is_visible: true, gradingRule: null } as unknown as EditorQuestion);
const normalize = (items: EditorQuestion[]) => items.map((item, index) => ({ ...item, display_order: index + 1 }));

export function QuestionEditor({ initialQuestions }: { initialQuestions: ExcelQuestion[] }) {
  const [questions, setQuestions] = useState<EditorQuestion[]>(() => normalize((initialQuestions.length ? initialQuestions : [fresh(1)]).map((question, index) => ({ ...question, clientId: crypto.randomUUID(), selected: false, display_order: index + 1 } as EditorQuestion))));
  const [bulkMarks, setBulkMarks] = useState("1");
  const [preview, setPreview] = useState(false);
  const [dragged, setDragged] = useState<number | null>(null);
  const summary = useMemo(() => calculateExcelQuestionSummary(questions.map((q) => ({ marks: q.marks }))), [questions]);

  const update = (id: string, patch: Partial<EditorQuestion>) => setQuestions((items) => items.map((item) => (item.clientId === id ? { ...item, ...patch } : item)));
  const move = (index: number, direction: -1 | 1) => setQuestions((items) => { const next = [...items]; const target = index + direction; if (target < 0 || target >= next.length) return items; [next[index], next[target]] = [next[target], next[index]]; return normalize(next); });
  const add = () => setQuestions((items) => [...items, fresh(Math.max(0, ...items.map((item) => item.question_number ?? 0)) + 1)]);
  const duplicate = (index: number) => setQuestions((items) => { const source = items[index]; const copy = { ...source, id: "", clientId: crypto.randomUUID(), question_number: Math.max(0, ...items.map((item) => item.question_number ?? 0)) + 1, selected: false }; const next = [...items]; next.splice(index + 1, 0, copy); return normalize(next); });
  const remove = (id: string) => { if (questions.length === 1 || confirm("Delete this question?")) setQuestions((items) => normalize(items.filter((item) => item.clientId !== id))); };
  const applyBulk = (selectedOnly: boolean) => { const marks = Number(bulkMarks); if (!Number.isFinite(marks) || marks <= 0 || marks > MAX_EXCEL_QUESTION_MARKS) return alert(`Enter marks between 0 and ${MAX_EXCEL_QUESTION_MARKS}.`); const targets = selectedOnly ? questions.filter((item) => item.selected) : questions; if (!targets.length) return alert("Select at least one question."); if (!confirm(`Replace marks on ${targets.length} question${targets.length === 1 ? "" : "s"}?`)) return; setQuestions((items) => items.map((item) => (!selectedOnly || item.selected ? { ...item, marks } : item))); };

  const serialized = questions.map((question) => ({ id: question.id || undefined, number: question.question_number, instruction: question.instruction, marks: Number.isFinite(question.marks) ? question.marks : null, section: question.section, display_order: question.display_order, is_visible: question.is_visible, gradingRule: question.gradingRule }));

  return (
    <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <input type="hidden" name="questions" value={JSON.stringify(serialized)} />
      <input type="hidden" name="questionCount" value={summary.questionCount} />
      <input type="hidden" name="maximumMarks" value={summary.maximumMarks} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-lg font-black">Question editor</h3><p className="text-sm text-slate-500">Marks are assigned per question. The test total is calculated automatically.</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => setPreview(true)} className="rounded-lg bg-violet-100 px-3 py-2 text-sm font-bold text-violet-800">Preview Question Paper</button><button type="button" onClick={add} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white">Add Question</button></div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><Summary label="Total questions" value={summary.questionCount} /><Summary label="Total maximum marks" value={summary.maximumMarks} /><Summary label="Questions without marks" value={summary.questionsWithoutMarks} /><Summary label="Average marks" value={summary.averageMarks} /></dl>
      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
        <label className="text-xs font-bold">Bulk marks<input type="number" min="0.01" max={MAX_EXCEL_QUESTION_MARKS} step="0.01" value={bulkMarks} onChange={(event) => setBulkMarks(event.target.value)} className="input mt-1 w-28" /></label>
        <button type="button" onClick={() => applyBulk(false)} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white">Apply marks to all questions</button>
        <button type="button" onClick={() => applyBulk(true)} className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-bold">Apply marks to selected questions</button>
      </div>
      <div className="mt-4 space-y-4">
        {questions.map((question, index) => (
          <article key={question.clientId} draggable onDragStart={() => setDragged(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged === null || dragged === index) return; setQuestions((items) => { const next = [...items]; const [item] = next.splice(dragged, 1); next.splice(index, 0, item); return normalize(next); }); setDragged(null); }} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={question.selected} onChange={(event) => update(question.clientId, { selected: event.target.checked })} />Select</label>
              <span className="cursor-grab text-xs font-bold text-slate-500" title="Drag to reorder">↕ Display order {question.display_order}</span>
              <div className="flex flex-wrap gap-1"><button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="mini">Move Up</button><button type="button" onClick={() => move(index, 1)} disabled={index === questions.length - 1} className="mini">Move Down</button><button type="button" onClick={() => duplicate(index)} className="mini">Duplicate Question</button><button type="button" onClick={() => remove(question.clientId)} className="mini text-red-700">Delete Question</button></div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Label text="Question number"><input className="input" type="number" min="1" value={question.question_number} onChange={(event) => update(question.clientId, { question_number: Number(event.target.value) })} /></Label>
              <Label text="Individual maximum marks"><input className="input" type="number" min="0.01" max={MAX_EXCEL_QUESTION_MARKS} step="0.01" required value={Number.isFinite(question.marks) ? question.marks : ""} onChange={(event) => update(question.clientId, { marks: event.target.value === "" ? Number.NaN : Number(event.target.value) })} /></Label>
              <Label text="Optional section/topic"><input className="input" value={question.section ?? ""} onChange={(event) => update(question.clientId, { section: event.target.value || null })} /></Label>
              <label className="flex items-center gap-2 self-end pb-3 text-sm font-bold"><input type="checkbox" checked={question.is_visible} onChange={(event) => update(question.clientId, { is_visible: event.target.checked })} />Visible on screen</label>
            </div>
            <Label text="Question instruction/text — write or paste from Word/Excel; tables and lists are supported"><QuestionContentEditor ariaLabel={`Question ${question.question_number} instruction`} required={question.is_visible} value={question.instruction} onChange={(value) => update(question.clientId, { instruction: value })} /></Label>
            <fieldset className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <legend className="px-2 text-sm font-black text-emerald-900">Explicit automatic grading rule (optional)</legend>
              <p className="mb-3 text-xs text-emerald-800">Target a cell's computed value or formula, e.g. <code>cells.B5.value</code> or <code>cells.B5.formula</code>.</p>
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={Boolean(question.gradingRule)} onChange={(event) => update(question.clientId, { gradingRule: event.target.checked ? { target: "cells.A1.value", expectedOperation: "bold", expectedValue: "0", allocatedMarks: question.marks, partialMarks: null } : null })} />Enable explicit rule</label>
              {question.gradingRule && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Label text="Exact target"><input className="input" value={question.gradingRule.target} onChange={(event) => update(question.clientId, { gradingRule: { ...question.gradingRule!, target: event.target.value } })} /></Label>
                  <Label text="Expected operation"><input className="input" value={question.gradingRule.expectedOperation} onChange={(event) => update(question.clientId, { gradingRule: { ...question.gradingRule!, expectedOperation: event.target.value } })} /></Label>
                  <Label text="Expected value (JSON/text)"><input className="input" value={question.gradingRule.expectedValue} onChange={(event) => update(question.clientId, { gradingRule: { ...question.gradingRule!, expectedValue: event.target.value } })} /></Label>
                  <Label text="Allocated marks"><input className="input" type="number" min="0.01" max={question.marks} step=".01" value={question.gradingRule.allocatedMarks} onChange={(event) => update(question.clientId, { gradingRule: { ...question.gradingRule!, allocatedMarks: Number(event.target.value) } })} /></Label>
                  <Label text="Optional partial marks"><input className="input" type="number" min="0" max={question.gradingRule.allocatedMarks} step=".01" value={question.gradingRule.partialMarks ?? ""} onChange={(event) => update(question.clientId, { gradingRule: { ...question.gradingRule!, partialMarks: event.target.value === "" ? null : Number(event.target.value) } })} /></Label>
                </div>
              )}
            </fieldset>
          </article>
        ))}
      </div>
      {preview && (
        <div role="dialog" aria-modal="true" aria-label="Question paper preview" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
          <section className="max-h-[90dvh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6">
            <div className="flex justify-between"><h3 className="text-xl font-black">Question Paper Preview · {summary.maximumMarks} marks</h3><button type="button" onClick={() => setPreview(false)} className="font-black">Close</button></div>
            <div className="mt-5 space-y-4">{questions.map((question) => <article key={question.clientId} className="rounded-xl border p-4"><h4 className="font-black">Question {question.question_number} · {question.marks} marks</h4>{question.section && <p className="text-xs font-bold text-emerald-700">{question.section}</p>}{question.is_visible ? <div className="mt-2"><QuestionContent text={question.instruction} /></div> : <p className="mt-2">See Question {question.question_number} in the workspace — {question.marks} marks</p>}</article>)}</div>
          </section>
        </div>
      )}
    </section>
  );
}
function Label({ text, children }: { text: string; children: React.ReactNode }) { return <label className="grid gap-1 text-sm font-bold text-slate-700"><span>{text}</span>{children}</label>; }
function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-emerald-50 p-3"><dt className="text-xs font-bold text-emerald-700">{label}</dt><dd className="mt-1 text-xl font-black">{value}</dd></div>; }
