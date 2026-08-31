"use client";
import { useMemo, useState } from "react";
import { RichDocumentEditor } from "@/app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor";
import { diffWordDocuments, type WordDetectedChange } from "@/lib/word-document-diff";
import { generateWordEfficiencyGradingRulesFromModelAnswer, saveWordEfficiencyModelAnswer } from "../../actions";
import type { WorkingMatterSnapshot } from "@/lib/word-docx";

type Question = { id: string; number: number; instruction: string; marks: number; existingCriteria: { target: string; expectedValue: string }[] };

export function ModelAnswerEditor({ versionId, original, initialDocument, capabilities, questions }: { versionId: string; original: WorkingMatterSnapshot; initialDocument: unknown; capabilities: unknown; questions: Question[] }) {
  const [beforeSnapshot, setBeforeSnapshot] = useState<unknown>(null);
  const [afterSnapshot, setAfterSnapshot] = useState<unknown>(initialDocument ?? null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, setPending] = useState(false);

  const changes: WordDetectedChange[] = useMemo(() => (beforeSnapshot && afterSnapshot ? diffWordDocuments(beforeSnapshot, afterSnapshot) : []), [beforeSnapshot, afterSnapshot]);

  const [assignment, setAssignment] = useState<Record<number, number | "">>({});
  const resolvedAssignment = useMemo(() => {
    const next: Record<number, number | ""> = { ...assignment };
    changes.forEach((change, index) => {
      if (index in next) return;
      const owner = questions.find((question) => question.existingCriteria.some((criterion) => criterion.target === change.target));
      next[index] = owner ? owner.number : "";
    });
    return next;
  }, [changes, questions, assignment]);

  const assignedCount = Object.values(resolvedAssignment).filter((value) => value !== "").length;

  const generate = async () => {
    setPending(true);
    setMessage(null);
    const assignments = questions.map((question) => ({
      questionNumber: question.number,
      allocatedMarks: question.marks,
      criteria: changes.filter((_, index) => resolvedAssignment[index] === question.number).map((change) => ({ target: change.target, expectedValue: JSON.stringify(change.expectedValue) })),
    }));
    const result = await generateWordEfficiencyGradingRulesFromModelAnswer(versionId, assignments);
    setPending(false);
    setMessage(result.ok ? { text: "Grading rules generated. Every question above with at least one assigned change is now auto-graded from your model answer.", ok: true } : { text: result.error, ok: false });
  };

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(320px,1fr)]">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow">
        <RichDocumentEditor
          attemptId={versionId}
          original={original}
          initialDocument={initialDocument}
          capabilities={capabilities}
          locked={false}
          mode="authoring"
          oneTimeSubmit={false}
          submitLabel="Save Model Answer"
          submitConfirmMessage={null}
          autosaveAction={saveWordEfficiencyModelAnswer}
          submitAction={saveWordEfficiencyModelAnswer}
          onReady={setBeforeSnapshot}
          onSaved={setAfterSnapshot}
        />
      </section>
      <aside className="rounded-3xl bg-white p-5 shadow">
        <h2 className="text-lg font-black">Detected changes</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Solve a question in the document on the left (e.g. make a paragraph bold).</li>
          <li>Click <strong>"Save Model Answer"</strong> — every change you made shows up below, one row per change.</li>
          <li>Pick which question each change answers from its dropdown.</li>
          <li>Click <strong>"Generate Grading Rules"</strong> — a student only earns that question's marks if their submission matches every change you assigned to it, exactly.</li>
        </ol>
        {!beforeSnapshot && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Loading the original document…</p>}
        {Boolean(beforeSnapshot) && !changes.length && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">No changes detected yet. Solve a question, then click "Save Model Answer" to detect what changed.</p>}
        <div className="mt-4 max-h-[50dvh] space-y-2 overflow-y-auto">
          {changes.map((change, index) => (
            <div key={`${change.target}-${index}`} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm text-slate-800">{change.label}</p>
              <label className="mt-2 block text-xs font-bold text-slate-500">
                Assign to question
                <select className="input mt-1 w-full" value={resolvedAssignment[index] ?? ""} onChange={(event) => setAssignment((current) => ({ ...current, [index]: event.target.value === "" ? "" : Number(event.target.value) }))}>
                  <option value="">— Not part of any question —</option>
                  {questions.map((question) => <option key={question.id} value={question.number}>Question {question.number} ({question.marks} marks)</option>)}
                </select>
              </label>
            </div>
          ))}
        </div>
        {changes.length > 0 && (
          <div className="mt-5 border-t pt-4">
            <p className="text-xs font-bold text-slate-500">{assignedCount} of {changes.length} detected changes assigned.</p>
            <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs font-bold text-amber-900">Generating replaces ALL grading rules currently configured for this test version — including any authored the old way in the question editor.</p>
            <button type="button" disabled={pending} onClick={generate} className="mt-3 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white disabled:opacity-60">{pending ? "Generating…" : "Generate Grading Rules From Model Answer"}</button>
          </div>
        )}
        {message && <p role={message.ok ? "status" : "alert"} className={`mt-4 rounded-xl p-3 text-sm font-bold ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{message.text}</p>}
        <h3 className="mt-6 font-black">Question paper</h3>
        <div className="mt-2 space-y-2 text-sm text-slate-600">
          {questions.map((question) => <p key={question.id}><strong>Q{question.number}.</strong> {question.instruction} <span className="text-xs font-bold text-slate-400">({question.marks} marks)</span></p>)}
        </div>
      </aside>
    </div>
  );
}
