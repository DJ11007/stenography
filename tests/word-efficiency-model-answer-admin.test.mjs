import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// The Model Answer admin UI page (the "click every detected change" diff
// workflow) was removed at the admin's request -- they prefer authoring
// grading manually and reviewing/grading student attempts directly via
// "Edit / Preview" and "View Attempts" on the test list, both of which
// already existed and are untouched by this removal. The underlying
// save_word_efficiency_model_answer/evaluate_word_efficiency_grading_rule
// schema and server actions are left in place (unreachable without a UI,
// but harmless, and preserve the option to rebuild an authoring surface
// later without a new migration).

test("RichDocumentEditor's authoring-mode props default to exactly the original student-attempt behavior when omitted", async () => {
  const editor = await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.match(editor, /mode="attempt"/);
  assert.match(editor, /oneTimeSubmit=true/);
  assert.match(editor, /submitLabel="Submit Final Document"/);
  assert.match(editor, /submitConfirmMessage="Submit your final document\? You cannot edit it afterward\."/);
  assert.match(editor, /\(autosaveAction\?\?autosaveWordDocument\)/);
  assert.match(editor, /\(submitAction\?\?submitWordDocument\)/);
});

test("saveWordEfficiencyModelAnswer and generateWordEfficiencyGradingRulesFromModelAnswer remain admin-gated server actions calling the matching RPCs, even with no UI calling them any more", async () => {
  const actions = await read("app/admin/word-efficiency-tests/actions.ts");
  const modelAnswerBody = actions.slice(actions.indexOf("export async function saveWordEfficiencyModelAnswer"), actions.indexOf("export async function generateWordEfficiencyGradingRulesFromModelAnswer"));
  assert.match(modelAnswerBody, /requireAdmin\(\)/);
  assert.match(modelAnswerBody, /save_word_efficiency_model_answer/);
  const generateBody = actions.slice(actions.indexOf("export async function generateWordEfficiencyGradingRulesFromModelAnswer"));
  assert.match(generateBody, /requireAdmin\(\)/);
  assert.match(generateBody, /save_word_efficiency_grading_rules/);
  assert.match(generateBody, /additionalCriteria:rest/);
});

test("the admin test list no longer links to the removed Model Answer page, and Edit/Preview + View Attempts remain the way to check a test and grade student submissions", async () => {
  const page = await read("app/admin/word-efficiency-tests/page.tsx");
  assert.doesNotMatch(page, /\/admin\/word-efficiency-tests\/\$\{test\.id\}\/model-answer/);
  assert.doesNotMatch(page, />Model Answer</);
  assert.match(page, /Edit \/ Preview/);
  assert.match(page, /View Attempts/);
});

test("the migration's additional_criteria column and evaluator ship together with the model answer save RPC", async () => {
  const migration = await read("supabase/migrations/202608280039_word_efficiency_model_answer_grading.sql");
  assert.match(migration, /alter table public\.word_efficiency_grading_rules add column if not exists additional_criteria jsonb not null default '\[\]'::jsonb/);
  assert.match(migration, /create or replace function public\.save_word_efficiency_model_answer/);
  assert.match(migration, /create or replace function public\.evaluate_word_efficiency_grading_rule\(final_document jsonb,target text,expected_operation text,expected_value jsonb,allocated_marks numeric,partial_marks numeric,additional_criteria jsonb default '\[\]'::jsonb\)/);
});
