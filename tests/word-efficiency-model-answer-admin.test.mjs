import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// The Model Answer admin UI was rebuilt after the admin explained exactly
// what confused them about the earlier version: a flat, technical list of
// every detected change across the whole document ("Paragraph 6: bold
// changed to true") in a sidebar, a separate "assign each change to a
// question" step, and the actual question paper buried at the bottom of
// that same sidebar. This version shows no change list at all -- the
// admin picks a question from a stepper, types the answer directly into
// the real document, and clicks one "Save answer for Q<n>" button per
// question. diffWordDocuments/generateWordEfficiencyGradingRulesFromModelAnswer
// still do the same work underneath; they're just never rendered as
// something the admin has to read.

test("RichDocumentEditor's authoring-mode props default to exactly the original student-attempt behavior when omitted", async () => {
  const editor = await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.match(editor, /mode="attempt"/);
  assert.match(editor, /oneTimeSubmit=true/);
  assert.match(editor, /submitLabel="Submit Final Document"/);
  assert.match(editor, /submitConfirmMessage="Submit your final document\? You cannot edit it afterward\."/);
  assert.match(editor, /\(autosaveAction\?\?autosaveWordDocument\)/);
  assert.match(editor, /\(submitAction\?\?submitWordDocument\)/);
});

test("saveWordEfficiencyModelAnswer and generateWordEfficiencyGradingRulesFromModelAnswer remain admin-gated server actions calling the matching RPCs", async () => {
  const actions = await read("app/admin/word-efficiency-tests/actions.ts");
  const modelAnswerBody = actions.slice(actions.indexOf("export async function saveWordEfficiencyModelAnswer"), actions.indexOf("export async function generateWordEfficiencyGradingRulesFromModelAnswer"));
  assert.match(modelAnswerBody, /requireAdmin\(\)/);
  assert.match(modelAnswerBody, /save_word_efficiency_model_answer/);
  const generateBody = actions.slice(actions.indexOf("export async function generateWordEfficiencyGradingRulesFromModelAnswer"));
  assert.match(generateBody, /requireAdmin\(\)/);
  assert.match(generateBody, /save_word_efficiency_grading_rules/);
  assert.match(generateBody, /additionalCriteria:rest/);
});

test("the admin test list links to the Model Answer page alongside Edit/Preview and View Attempts", async () => {
  const page = await read("app/admin/word-efficiency-tests/page.tsx");
  assert.match(page, /\/admin\/word-efficiency-tests\/\$\{test\.id\}\/model-answer/);
  assert.match(page, /Model Answer/);
  assert.match(page, /Edit \/ Preview/);
  assert.match(page, /View Attempts/);
});

test("the Model Answer page loads test/version/questions/existing grading rules and renders ModelAnswerEditor", async () => {
  const page = await read("app/admin/word-efficiency-tests/[testId]/model-answer/page.tsx");
  assert.match(page, /await requireAdmin\(\)/);
  assert.match(page, /from\("word_efficiency_tests"\)/);
  assert.match(page, /from\("word_efficiency_versions"\)/);
  assert.match(page, /from\("word_efficiency_questions"\)/);
  assert.match(page, /from\("word_efficiency_grading_rules"\)/);
  assert.match(page, /<ModelAnswerEditor/);
});

// The critical regression guard: the confusing UI must not come back.
test("the Model Answer editor shows a question stepper and one Save button, and never renders a detected-changes list or a per-change assign-to-question control", async () => {
  const editor = await read("app/admin/word-efficiency-tests/[testId]/model-answer/model-answer-editor.tsx");
  assert.match(editor, /import \{ diffWordDocuments \} from "@\/lib\/word-document-diff";/);
  assert.match(editor, /import \{ generateWordEfficiencyGradingRulesFromModelAnswer, saveWordEfficiencyModelAnswer \} from "\.\.\/\.\.\/actions";/);
  assert.match(editor, /selectQuestion/);
  assert.match(editor, /submitLabel=\{active \? `Save answer for Q\$\{active\.number\}` : "Save Model Answer"\}/);
  assert.match(editor, /submitAction=\{saveActiveAnswer\}/);
  assert.doesNotMatch(editor, /Detected changes/i);
  assert.doesNotMatch(editor, /change\.label/);
  assert.doesNotMatch(editor, /isElsewhere|resolvedAssignment/);
});

test("saving an answer diffs against that question's checkpoint and regenerates rules for every question, not just the active one", async () => {
  const editor = await read("app/admin/word-efficiency-tests/[testId]/model-answer/model-answer-editor.tsx");
  assert.match(editor, /const changes = diffWordDocuments\(before, document\);/);
  assert.match(editor, /questions\.map\(\(question\) => \(\{ questionNumber: question\.number, allocatedMarks: question\.marks, criteria: nextAssignments\[question\.number\] \?\? \[\] \}\)\)/);
  assert.match(editor, /generateWordEfficiencyGradingRulesFromModelAnswer\(versionId, payload\)/);
});

test("the migration's additional_criteria column and evaluator ship together with the model answer save RPC", async () => {
  const migration = await read("supabase/migrations/202608280039_word_efficiency_model_answer_grading.sql");
  assert.match(migration, /alter table public\.word_efficiency_grading_rules add column if not exists additional_criteria jsonb not null default '\[\]'::jsonb/);
  assert.match(migration, /create or replace function public\.save_word_efficiency_model_answer/);
  assert.match(migration, /create or replace function public\.evaluate_word_efficiency_grading_rule\(final_document jsonb,target text,expected_operation text,expected_value jsonb,allocated_marks numeric,partial_marks numeric,additional_criteria jsonb default '\[\]'::jsonb\)/);
});
