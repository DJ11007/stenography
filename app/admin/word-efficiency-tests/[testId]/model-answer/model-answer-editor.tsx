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

  // The old design put a full "assign to question" dropdown on every single
  // detected change -- technically complete, but it asked the admin to
  // think about all N questions at once, N times over. This tracks one
  // "question I'm currently answering" instead, so grading a change is a
  // single click: pick the question once, then click every change that
  // belongs to it. Defaults to the first question so there's always
  // something to click into immediately.
  const [activeQuestion, setActiveQuestion] = useState<number | null>(null);
  const selectedQuestion = activeQuestion !== null && questions.some((question) => question.number === activeQuestion) ? activeQuestion : (questions[0]?.number ?? null);

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
          <li>Click <strong>"Save Model Answer"</strong> — every change you made shows up below.</li>
          <li>Pick the question you're answering, then click each change that answers it.</li>
          <li>Click <strong>"Generate Grading Rules"</strong> once everything is assigned — a student only earns that question's marks if their submission matches every change you assigned to it, exactly.</li>
        </ol>
        {!beforeSnapshot && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Loading the original document…</p>}
        {Boolean(beforeSnapshot) && !changes.length && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">No changes detected yet. Solve a question, then click "Save Model Answer" to detect what changed.</p>}
        {!questions.length && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">Add at least one question to this test before assigning changes.</p>}
        {Boolean(changes.length && questions.length) && <>
          <div className="mt-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Step 1 — which question are you answering?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {questions.map((question) => <button key={question.id} type="button" onClick={() => setActiveQuestion(question.number)} aria-pressed={selectedQuestion === question.number} className={`rounded-full px-3 py-1.5 text-xs font-black ${selectedQuestion === question.number ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>Q{question.number} ({question.marks} marks)</button>)}
            </div>
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-wide text-slate-500">Step 2 — click every change below that answers Q{selectedQuestion}</p>
        </>}
        <div className="mt-2 max-h-[50dvh] space-y-2 overflow-y-auto">
          {changes.map((change, index) => {
            const assignedTo = resolvedAssignment[index];
            const isHere = selectedQuestion !== null && assignedTo === selectedQuestion;
            const isElsewhere = assignedTo !== "" && assignedTo !== selectedQuestion;
            return <button key={`${change.target}-${index}`} type="button" disabled={selectedQuestion === null} onClick={() => setAssignment((current) => ({ ...current, [index]: isHere ? "" : (selectedQuestion as number) }))} aria-pressed={isHere} className={`block w-full rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-60 ${isHere ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
              <p className="text-sm text-slate-800">{change.label}</p>
              <p className={`mt-1 text-xs font-bold ${isHere ? "text-blue-700" : isElsewhere ? "text-amber-700" : "text-slate-400"}`}>{isHere ? `✓ Assigned to Q${selectedQuestion}` : isElsewhere ? `Currently assigned to Q${assignedTo} — click to move to Q${selectedQuestion}` : selectedQuestion === null ? "Add a question first" : `Not assigned — click to assign to Q${selectedQuestion}`}</p>
            </button>;
          })}
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
