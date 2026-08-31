import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the Model Answer page loads the version's working matter, existing model answer, questions, and grading rules, and requires an admin", async () => {
  const page = await read("app/admin/word-efficiency-tests/[testId]/model-answer/page.tsx");
  assert.match(page, /await requireAdmin\(\)/);
  assert.match(page, /working_matter_snapshot,model_answer_snapshot,editor_capabilities/);
  assert.match(page, /word_efficiency_grading_rules/);
  assert.match(page, /notFound\(\)/);
});

test("the Model Answer editor reuses RichDocumentEditor in authoring mode with a non-locking save action, not the student attempt actions", async () => {
  const editor = await read("app/admin/word-efficiency-tests/[testId]/model-answer/model-answer-editor.tsx");
  assert.match(editor, /mode="authoring"/);
  assert.match(editor, /oneTimeSubmit=\{false\}/);
  assert.match(editor, /submitAction=\{saveWordEfficiencyModelAnswer\}/);
  assert.match(editor, /autosaveAction=\{saveWordEfficiencyModelAnswer\}/);
  assert.match(editor, /diffWordDocuments/);
  assert.match(editor, /Generate Grading Rules From Model Answer/);
  assert.match(editor, /replaces ALL grading rules/);
  assert.doesNotMatch(editor, /autosaveWordDocument|submitWordDocument/);
});

test("RichDocumentEditor's authoring-mode props default to exactly the original student-attempt behavior when omitted", async () => {
  const editor = await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.match(editor, /mode="attempt"/);
  assert.match(editor, /oneTimeSubmit=true/);
  assert.match(editor, /submitLabel="Submit Final Document"/);
  assert.match(editor, /submitConfirmMessage="Submit your final document\? You cannot edit it afterward\."/);
  assert.match(editor, /\(autosaveAction\?\?autosaveWordDocument\)/);
  assert.match(editor, /\(submitAction\?\?submitWordDocument\)/);
});

test("saveWordEfficiencyModelAnswer and generateWordEfficiencyGradingRulesFromModelAnswer are admin-gated server actions calling the matching RPCs", async () => {
  const actions = await read("app/admin/word-efficiency-tests/actions.ts");
  const modelAnswerBody = actions.slice(actions.indexOf("export async function saveWordEfficiencyModelAnswer"), actions.indexOf("export async function generateWordEfficiencyGradingRulesFromModelAnswer"));
  assert.match(modelAnswerBody, /requireAdmin\(\)/);
  assert.match(modelAnswerBody, /save_word_efficiency_model_answer/);
  const generateBody = actions.slice(actions.indexOf("export async function generateWordEfficiencyGradingRulesFromModelAnswer"));
  assert.match(generateBody, /requireAdmin\(\)/);
  assert.match(generateBody, /save_word_efficiency_grading_rules/);
  assert.match(generateBody, /additionalCriteria:rest/);
});

test("the main admin test list links to the Model Answer page per test", async () => {
  const page = await read("app/admin/word-efficiency-tests/page.tsx");
  assert.match(page, /\/admin\/word-efficiency-tests\/\$\{test\.id\}\/model-answer/);
  assert.match(page, /Model Answer/);
});

test("assigning a detected change to a question is a single click against the currently selected question, not a per-row dropdown", async () => {
  const editor = await read("app/admin/word-efficiency-tests/[testId]/model-answer/model-answer-editor.tsx");
  // The old per-row <select> is gone entirely.
  assert.doesNotMatch(editor, /Assign to question/);
  assert.doesNotMatch(editor, /<select className="input mt-1 w-full"/);
  // A question is picked once (Step 1), then every change is a toggle button
  // against that selection (Step 2) -- not one dropdown per change.
  assert.match(editor, /which question are you answering/);
  assert.match(editor, /click every change below that answers/);
  assert.match(editor, /onClick=\{\(\) => setActiveQuestion\(question\.number\)\}/);
  assert.match(editor, /onClick=\{\(\) => setAssignment\(\(current\) => \(\{ \.\.\.current, \[index\]: isHere \? "" : \(selectedQuestion as number\) \}\)\)\}/);
});

test("a change already assigned to a different question is shown as movable, not silently overwritten or hidden", async () => {
  const editor = await read("app/admin/word-efficiency-tests/[testId]/model-answer/model-answer-editor.tsx");
  assert.match(editor, /Currently assigned to Q\$\{assignedTo\} — click to move to Q\$\{selectedQuestion\}/);
});

test("the migration's additional_criteria column and evaluator ship together with the model answer save RPC", async () => {
  const migration = await read("supabase/migrations/202608280039_word_efficiency_model_answer_grading.sql");
  assert.match(migration, /alter table public\.word_efficiency_grading_rules add column if not exists additional_criteria jsonb not null default '\[\]'::jsonb/);
  assert.match(migration, /create or replace function public\.save_word_efficiency_model_answer/);
  assert.match(migration, /create or replace function public\.evaluate_word_efficiency_grading_rule\(final_document jsonb,target text,expected_operation text,expected_value jsonb,allocated_marks numeric,partial_marks numeric,additional_criteria jsonb default '\[\]'::jsonb\)/);
});
