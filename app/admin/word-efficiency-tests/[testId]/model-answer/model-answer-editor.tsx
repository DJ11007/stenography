"use client";
import { useState } from "react";
import { RichDocumentEditor } from "@/app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor";
import { compressRunCriteria, diffWordDocuments, modelAnswerRuleCriteria, stripBlankParagraphs, type ModelAnswerCriterion } from "@/lib/word-document-diff";
import { generateWordEfficiencyGradingRulesFromModelAnswer, resetWordEfficiencyModelAnswer, saveWordEfficiencyModelAnswer } from "../../actions";
import type { WorkingMatterSnapshot } from "@/lib/word-docx";

type KeptRule = { exactTarget: string; expectedOperation: string; expectedValue: string; allocatedMarks: number; partialMarks: number | null; partLabel: string | null; additionalCriteria: unknown[] };
type Question = { id: string; number: number; instruction: string; marks: number; graded: boolean; keptRules: KeptRule[]; existingCriteria: ModelAnswerCriterion[] };
type Criterion = ModelAnswerCriterion;

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
// Number of non-blank paragraphs/elements in an editor document, or null when it is not a document.
// Header and footer are not counted: rules find body paragraphs by their place among body blocks, so adding a
// header or footer (questions like "write X in the footer") moves nothing. Counting them refused every such save.
function countParagraphs(document: unknown): number | null {
  const blocks = (stripBlankParagraphs(document) as { blocks?: unknown } | null)?.blocks;
  return Array.isArray(blocks) ? blocks.filter((block) => !["header", "footer"].includes((block as { type?: string } | null)?.type ?? "")).length : null;
}

export function ModelAnswerEditor({ versionId, original, initialDocument, questions }: { versionId: string; original: WorkingMatterSnapshot; initialDocument: unknown; questions: Question[] }) {
  // The question that starts active (first one with no existing grading
  // rule) needs a checkpoint -- the document as it stood before THIS
  // question's edits -- exactly like selectQuestion seeds one for every
  // later question switch. Computed once, up front, so both initializers
  // below can use it without an effect (an effect only runs after the
  // first paint, too late to matter for a value only ever read at submit
  // time -- but wrong in a subtler way too: see handleReady's comment).
  const initialActiveNumber = questions.find((question) => !question.graded)?.number ?? null;
  const [latestDocument, setLatestDocument] = useState<unknown>(initialDocument ?? null);
  // If a document was already saved (any question answered in an earlier
  // session, including ones with no grading rule of their own yet), THAT
  // saved snapshot -- not some later in-session edit -- is the true
  // "before" state for whichever question starts active. Seeding it here
  // covers that case; handleReady below covers the other one (nothing
  // saved yet, so there's no initialDocument to seed from).
  const [checkpoints, setCheckpoints] = useState<Record<number, unknown>>(() => (initialDocument != null && initialActiveNumber !== null ? { [initialActiveNumber]: initialDocument } : {}));
  const [assignments, setAssignments] = useState<Record<number, Criterion[]>>(() => Object.fromEntries(questions.map((question) => [question.number, question.existingCriteria])));
  const [answeredNumbers, setAnsweredNumbers] = useState<Set<number>>(() => new Set(questions.filter((question) => question.graded).map((question) => question.number)));
  const [activeNumber, setActiveNumber] = useState<number | null>(initialActiveNumber);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [resetting, setResetting] = useState(false);
  // Questions answered on this page since it opened: their saved rules are rebuilt; the others keep rules this page cannot rebuild.
  const [touched, setTouched] = useState<Set<number>>(new Set());
  const [showQuestion, setShowQuestion] = useState(true);

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

  // Covers the OTHER half of the initial-question checkpoint problem (see
  // the checkpoints initializer above): when nothing has been saved yet at
  // all, there's no initialDocument to seed a checkpoint from, so the
  // initializer above leaves checkpoints empty. In that case the pristine,
  // as-rendered-from-the-original-Working-Matter snapshot this effect
  // fires with (before RichDocumentEditor's own initialDocument effect, if
  // any, overwrites the DOM) IS the correct "before" state for whichever
  // question starts active. Without this, saveActiveAnswer fell back to
  // `checkpoints[activeNumber] ?? document`, i.e. diffing the just-saved
  // document against itself, which always produces zero changes -- the
  // very first question ever authored on a version could never be
  // auto-graded, no matter what was typed.
  const handleReady = (snapshot: unknown) => {
    if (latestDocument === null) {
      setLatestDocument(snapshot);
      if (activeNumber !== null) setCheckpoints((current) => (activeNumber in current ? current : { ...current, [activeNumber]: snapshot }));
    }
  };

  // Passed as RichDocumentEditor's submitAction -- same (id, document) =>
  // {ok, error} shape as saveWordEfficiencyModelAnswer/submitWordDocument,
  // so the editor needs no changes to call this instead.
  const saveActiveAnswer = async (_id: string, document: unknown): Promise<{ ok: boolean; error: string }> => {
    // Saved without blank paragraphs: grading counts text-bearing paragraphs
    // only (see stripBlankParagraphs), so the stored answer must too.
    const cleanDocument = stripBlankParagraphs(document);
    // Rules point at paragraphs by position, so solving a question must never add, delete, split or merge
    // paragraphs. Refuse the save (before anything is stored) and say exactly what changed.
    if (activeNumber !== null) {
      const expected = countParagraphs(checkpoints[activeNumber] ?? latestDocument ?? cleanDocument);
      const actual = countParagraphs(cleanDocument);
      if (expected !== null && actual !== expected) {
        return { ok: false, error: `Q${activeNumber} was not saved: the paper had ${expected} paragraphs when you started this question but now has ${actual}. A paragraph was added, deleted, split or merged. While solving, only format or edit text inside the existing paragraphs. Press Undo (Ctrl+Z) until the paper has ${expected} paragraphs again, then save.` };
      }
    }
    const saveResult = await saveWordEfficiencyModelAnswer(versionId, cleanDocument);
    if (!saveResult.ok) return saveResult;
    setLatestDocument(cleanDocument);
    if (activeNumber === null) return { ok: true, error: "" };
    const before = checkpoints[activeNumber] ?? cleanDocument;
    const changes = diffWordDocuments(before, cleanDocument);
    const criteria: Criterion[] = changes.map((change) => ({ target: change.target, savedValue: change.expectedValue, caseOnly: change.caseOnly }));
    const nextAssignments = { ...assignments, [activeNumber]: criteria };
    setAssignments(nextAssignments);
    const nextTouched = new Set(touched).add(activeNumber);
    setTouched(nextTouched);
    const payload = questions.map((question) => question.keptRules.length && !nextTouched.has(question.number)
      ? { questionNumber: question.number, keep: question.keptRules }
      : { questionNumber: question.number, allocatedMarks: question.marks, criteria: compressRunCriteria(cleanDocument, modelAnswerRuleCriteria(cleanDocument, nextAssignments[question.number] ?? [])) });
    const ruleResult = await generateWordEfficiencyGradingRulesFromModelAnswer(versionId, payload);
    if (!ruleResult.ok) return { ok: false, error: ruleResult.error };
    const nextAnswered = new Set(answeredNumbers);
    nextAnswered.add(activeNumber);
    setAnsweredNumbers(nextAnswered);
    if (!criteria.length) setMessage({ text: `No change was detected for Q${activeNumber} — nothing was typed or changed, so this question is still ungraded and needs manual marking.`, ok: false });
    else setMessage({ text: `Saved. Q${activeNumber} is now auto-graded from your answer.`, ok: true });
    const upcoming = questions.find((question) => !nextAnswered.has(question.number));
    if (upcoming) {
      setCheckpoints((current) => (upcoming.number in current ? current : { ...current, [upcoming.number]: cleanDocument }));
      setActiveNumber(upcoming.number);
    } else {
      setActiveNumber(null);
    }
    return { ok: true, error: "" };
  };

  if (!questions.length) {
    return <p className="mt-6 rounded-2xl bg-amber-50 p-5 text-sm font-bold text-amber-900">Add at least one question to this test (in the question editor) before authoring a model answer.</p>;
  }

  // One compact bar (the admin asked for the paper to get the space): question buttons in one row, each
  // marked graded (green tick) or not graded (red cross); the chosen question's text with its marks; Reset.
  // Only a failed save shows a message line.
  return (
    <div className="mt-2">
      <div className="rounded-2xl bg-white px-3 py-2 shadow">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
            {questions.map((question) => {
              const graded = (assignments[question.number] ?? []).length > 0 || (question.keptRules.length > 0 && !touched.has(question.number));
              const current = activeNumber === question.number;
              return (
                <button
                  key={question.id}
                  type="button"
                  disabled={!ready}
                  onClick={() => selectQuestion(question.number)}
                  aria-pressed={current}
                  aria-label={`Question ${question.number}, ${question.marks} marks, ${graded ? "graded" : "not graded"}`}
                  title={`Q${question.number} · ${question.marks} marks · ${graded ? "graded" : "not graded"}`}
                  className={`flex h-7 flex-none items-center gap-1 rounded-md border px-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50 ${current ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}
                >
                  Q{question.number}
                  <span aria-hidden className={`text-[13px] leading-none ${current ? (graded ? "text-green-300" : "text-red-300") : graded ? "text-green-600" : "text-red-600"}`}>{graded ? "✓" : "✗"}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setShowQuestion((open) => !open)}
            aria-expanded={showQuestion}
            aria-label={showQuestion ? "Hide the question text" : "Show the question text"}
            title={showQuestion ? "Hide the question text" : "Show the question text"}
            className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" aria-hidden className={`h-4 w-4 transition-transform ${showQuestion ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <button
            type="button"
            disabled={resetting || !hasProgress}
            onClick={handleReset}
            title={hasProgress ? "Clear every saved answer and start this paper over" : "Nothing to reset yet"}
            className="h-7 flex-none rounded-md border border-red-200 px-2 text-xs font-black text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {resetting ? "Resetting…" : "Reset"}
          </button>
        </div>
        {!ready && <p className="mt-1 text-xs text-slate-500">Loading the question paper…</p>}
        {active && showQuestion && (
          <p className="mt-1.5 text-sm text-slate-900"><span className="font-black text-blue-800">Q{active.number}.</span> {active.instruction} <span className="whitespace-nowrap text-[11px] font-bold text-slate-500">({active.marks} marks)</span></p>
        )}
        {message && !message.ok && <p role="alert" className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900">{message.text}</p>}
      </div>
      <section className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow">
        <RichDocumentEditor
          attemptId={versionId}
          original={original}
          initialDocument={initialDocument}
          // Every tool, whatever the test lets students use: the model answer must be solvable the way the paper asks
          // (tables, headers and footers, page setup...) even for a test that restricts what students may do.
          capabilities={null}
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
