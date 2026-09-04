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

// saveWordEfficiencyModelAnswer/generateWordEfficiencyGradingRulesFromModelAnswer
// deliberately skip requireAdmin() -- the same real bug and fix already
// shipped for Word/Excel Efficiency's own autosave/submit actions (see
// tests/efficiency-autosave-latency.test.mjs): a transient hiccup in
// requireAdmin()'s three network round trips (getUser, profiles lookup,
// getClaims for AAL2), fired on every 800ms autosave during a long
// Model Answer authoring session, bounced the admin to the sign-in page --
// a false "logout". Authorization is still fully enforced by
// is_aal2_admin() inside each RPC itself.
test("saveWordEfficiencyModelAnswer and generateWordEfficiencyGradingRulesFromModelAnswer call the matching RPCs but deliberately do not call requireAdmin()", async () => {
  const actions = await read("app/admin/word-efficiency-tests/actions.ts");
  const modelAnswerBody = actions.slice(actions.indexOf("export async function saveWordEfficiencyModelAnswer"), actions.indexOf("export async function generateWordEfficiencyGradingRulesFromModelAnswer"));
  assert.doesNotMatch(modelAnswerBody, /await requireAdmin\(\)/);
  assert.match(modelAnswerBody, /save_word_efficiency_model_answer/);
  const generateBody = actions.slice(actions.indexOf("export async function generateWordEfficiencyGradingRulesFromModelAnswer"), actions.indexOf("export async function resetWordEfficiencyModelAnswer"));
  assert.doesNotMatch(generateBody, /await requireAdmin\(\)/);
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
  assert.match(editor, /import \{ generateWordEfficiencyGradingRulesFromModelAnswer, resetWordEfficiencyModelAnswer, saveWordEfficiencyModelAnswer \} from "\.\.\/\.\.\/actions";/);
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

// A teacher asked for a way to undo a mistake made while solving the
// paper -- one Reset button that clears everything authored here and
// starts the paper over, without touching any already-graded student's
// score (those are frozen at submission, same as every other test-attempt
// result on this platform).
test("the Model Answer editor has a confirmed Reset button that clears saved answers via resetWordEfficiencyModelAnswer and reloads", async () => {
  const editor = await read("app/admin/word-efficiency-tests/[testId]/model-answer/model-answer-editor.tsx");
  assert.match(editor, /const handleReset = async \(\) => \{/);
  assert.match(editor, /if \(!confirm\(`Reset the model answer for this test\?/);
  assert.match(editor, /const result = await resetWordEfficiencyModelAnswer\(versionId\);/);
  assert.match(editor, /window\.location\.reload\(\);/);
  assert.match(editor, /disabled=\{resetting \|\| !hasProgress\}/);
  assert.match(editor, /\{resetting \? "Resetting…" : "Reset"\}/);
});

test("resetWordEfficiencyModelAnswer is an admin-gated server action calling the matching RPC", async () => {
  const actions = await read("app/admin/word-efficiency-tests/actions.ts");
  const resetBody = actions.slice(actions.indexOf("export async function resetWordEfficiencyModelAnswer"));
  assert.match(resetBody, /requireAdmin\(\)/);
  assert.match(resetBody, /reset_word_efficiency_model_answer/);
});

test("the reset RPC clears grading rules and the model answer snapshot for the version, admin-gated, and never touches question scores", async () => {
  const migration = await read("supabase/migrations/202609040057_word_efficiency_model_answer_reset.sql");
  assert.match(migration, /create or replace function public\.reset_word_efficiency_model_answer\(p_version_id uuid\)/);
  assert.match(migration, /if not public\.is_aal2_admin\(\) then raise exception 'not authorized'; end if;/);
  assert.match(migration, /delete from public\.word_efficiency_grading_rules where version_id=p_version_id;/);
  assert.match(migration, /update public\.word_efficiency_versions set model_answer_snapshot=null where id=p_version_id;/);
  assert.match(migration, /grant execute on function public\.reset_word_efficiency_model_answer\(uuid\) to authenticated;/);
});

test("the migration's additional_criteria column and evaluator ship together with the model answer save RPC", async () => {
  const migration = await read("supabase/migrations/202608280039_word_efficiency_model_answer_grading.sql");
  assert.match(migration, /alter table public\.word_efficiency_grading_rules add column if not exists additional_criteria jsonb not null default '\[\]'::jsonb/);
  assert.match(migration, /create or replace function public\.save_word_efficiency_model_answer/);
  assert.match(migration, /create or replace function public\.evaluate_word_efficiency_grading_rule\(final_document jsonb,target text,expected_operation text,expected_value jsonb,allocated_marks numeric,partial_marks numeric,additional_criteria jsonb default '\[\]'::jsonb\)/);
});
