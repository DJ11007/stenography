"use client";
import { useState } from "react";
import { RichDocumentEditor } from "@/app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor";
import { diffWordDocuments } from "@/lib/word-document-diff";
import { generateWordEfficiencyGradingRulesFromModelAnswer, resetWordEfficiencyModelAnswer, saveWordEfficiencyModelAnswer } from "../../actions";
import type { WorkingMatterSnapshot } from "@/lib/word-docx";

type Question = { id: string; number: number; instruction: string; marks: number; existingCriteria: { target: string; expectedValue: string }[] };
type Criterion = { target: string; expectedValue: string };

// Redesigned per the admin's own feedback on the earlier version of this
// page: that one showed a flat, technical list of every detected change
// across the whole document ("Paragraph 6: bold changed to true") in a
// sidebar, with a separate "assign each change to a question" step, and
// the actual question paper was buried at the bottom of that same sidebar
// -- reported back as genuinely confusing.
//
// This version shows no change list at all. The admin works through
// questions one at a time (top stepper), types the correct answer
// directly into the real document below, and clicks one "Save answer"
// button per question. The diffing/grading-rule generation still happens
// underneath -- diffWordDocuments and generateWordEfficiencyGradingRulesFromModelAnswer
// are unchanged -- it's just never surfaced as something the admin has to
// read or interact with directly.
//
// Checkpoint model: the document snapshot right before a question is
// first opened becomes that question's "before" state; saving diffs
// against it. This means questions should be answered in order, top to
// bottom -- going back to edit an earlier question after later ones are
// already saved can pick up those later edits too, matching the known,
// documented scope of diffWordDocuments itself (see lib/word-document-diff.ts).
export function ModelAnswerEditor({ versionId, original, initialDocument, capabilities, questions }: { versionId: string; original: WorkingMatterSnapshot; initialDocument: unknown; capabilities: unknown; questions: Question[] }) {
  const [latestDocument, setLatestDocument] = useState<unknown>(initialDocument ?? null);
  const [checkpoints, setCheckpoints] = useState<Record<number, unknown>>({});
  const [assignments, setAssignments] = useState<Record<number, Criterion[]>>(() => Object.fromEntries(questions.map((question) => [question.number, question.existingCriteria])));
  const [answeredNumbers, setAnsweredNumbers] = useState<Set<number>>(() => new Set(questions.filter((question) => question.existingCriteria.length > 0).map((question) => question.number)));
  const [activeNumber, setActiveNumber] = useState<number | null>(() => questions.find((question) => question.existingCriteria.length === 0)?.number ?? null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [resetting, setResetting] = useState(false);

  const ready = latestDocument !== null;
  const active = questions.find((question) => question.number === activeNumber) ?? null;
  const hasProgress = answeredNumbers.size > 0 || Boolean(initialDocument);

  // Clears the saved model answer and every grading rule generated from it
  // on the server, then reloads so this page (and RichDocumentEditor's own
  // internal DOM state) starts over completely fresh, exactly as if the
  // paper had never been touched. Never affects an already-submitted
  // student attempt's score -- see resetWordEfficiencyModelAnswer's own comment.
  const handleReset = async () => {
    if (!confirm(`Reset the model answer for this test? This clears every question's saved answer and auto-grading rule here — it does not change any student's already-graded result. This can't be undone.`)) return;
    setResetting(true);
    setMessage(null);
    const result = await resetWordEfficiencyModelAnswer(versionId);
    if (!result.ok) {
      setResetting(false);
      setMessage({ text: result.error, ok: false });
      return;
    }
    window.location.reload();
  };

  const selectQuestion = (number: number) => {
    if (!ready) return;
    setCheckpoints((current) => (number in current ? current : { ...current, [number]: latestDocument }));
    setActiveNumber(number);
    setMessage(null);
  };

  const handleReady = (snapshot: unknown) => {
    if (latestDocument === null) setLatestDocument(snapshot);
  };

  // Passed as RichDocumentEditor's submitAction -- same (id, document) =>
  // {ok, error} shape as saveWordEfficiencyModelAnswer/submitWordDocument,
  // so the editor needs no changes to call this instead.
  const saveActiveAnswer = async (_id: string, document: unknown): Promise<{ ok: boolean; error: string }> => {
    const saveResult = await saveWordEfficiencyModelAnswer(versionId, document);
    if (!saveResult.ok) return saveResult;
    setLatestDocument(document);
    if (activeNumber === null) return { ok: true, error: "" };
    const before = checkpoints[activeNumber] ?? document;
    const changes = diffWordDocuments(before, document);
    const criteria: Criterion[] = changes.map((change) => ({ target: change.target, expectedValue: JSON.stringify(change.expectedValue) }));
    const nextAssignments = { ...assignments, [activeNumber]: criteria };
    setAssignments(nextAssignments);
    const payload = questions.map((question) => ({ questionNumber: question.number, allocatedMarks: question.marks, criteria: nextAssignments[question.number] ?? [] }));
    const ruleResult = await generateWordEfficiencyGradingRulesFromModelAnswer(versionId, payload);
    if (!ruleResult.ok) return { ok: false, error: ruleResult.error };
    const nextAnswered = new Set(answeredNumbers);
    nextAnswered.add(activeNumber);
    setAnsweredNumbers(nextAnswered);
    if (!criteria.length) setMessage({ text: `No change was detected for Q${activeNumber} — nothing was typed or changed, so this question is still ungraded and needs manual marking.`, ok: false });
    else setMessage({ text: `Saved. Q${activeNumber} is now auto-graded from your answer.`, ok: true });
    const upcoming = questions.find((question) => !nextAnswered.has(question.number));
    if (upcoming) {
      setCheckpoints((current) => (upcoming.number in current ? current : { ...current, [upcoming.number]: document }));
      setActiveNumber(upcoming.number);
    } else {
      setActiveNumber(null);
    }
    return { ok: true, error: "" };
  };

  if (!questions.length) {
    return <p className="mt-6 rounded-2xl bg-amber-50 p-5 text-sm font-bold text-amber-900">Add at least one question to this test (in the question editor) before authoring a model answer.</p>;
  }

  return (
    <div className="mt-6">
      <div className="rounded-3xl bg-white p-5 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Questions</p>
          <button
            type="button"
            disabled={resetting || !hasProgress}
            onClick={handleReset}
            title={hasProgress ? "Clear every saved answer and start this paper over" : "Nothing to reset yet"}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-black text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {resetting ? "Resetting…" : "Reset"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {questions.map((question) => {
            const status = answeredNumbers.has(question.number) ? "answered" : activeNumber === question.number ? "active" : "pending";
            return (
              <button
                key={question.id}
                type="button"
                disabled={!ready}
                onClick={() => selectQuestion(question.number)}
                aria-pressed={activeNumber === question.number}
                className={`rounded-full px-4 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50 ${status === "answered" ? "bg-green-100 text-green-800" : status === "active" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                Q{question.number}{status === "answered" ? " ✓" : ""} · {question.marks} marks
              </button>
            );
          })}
        </div>
        {!ready && <p className="mt-3 text-sm text-slate-500">Loading the question paper…</p>}
        {active && (
          <div className="mt-4 rounded-2xl bg-blue-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">Answering Question {active.number} · {active.marks} marks</p>
            <p className="mt-1 text-sm text-blue-900">{active.instruction}</p>
            <p className="mt-2 text-xs text-blue-700">Type the correct answer directly into the paper below, then click <strong>Save answer for Q{active.number}</strong>.</p>
          </div>
        )}
        {!active && ready && <p className="mt-4 rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-900">Every question has a saved answer. Click any question above to review or redo it.</p>}
        {message && <p role={message.ok ? "status" : "alert"} className={`mt-4 rounded-xl p-3 text-sm font-bold ${message.ok ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}>{message.text}</p>}
      </div>
      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow">
        <RichDocumentEditor
          attemptId={versionId}
          original={original}
          initialDocument={initialDocument}
          capabilities={capabilities}
          locked={false}
          mode="authoring"
          oneTimeSubmit={false}
          submitLabel={active ? `Save answer for Q${active.number}` : "Save Model Answer"}
          submitConfirmMessage={null}
          autosaveAction={saveWordEfficiencyModelAnswer}
          submitAction={saveActiveAnswer}
          onReady={handleReady}
        />
      </section>
    </div>
  );
}
