import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// The Excel admin gets what Word has: solve the paper in the sheet (Model Answer), see whether it earns every
// rule and switch automatic publishing on (Auto-grading), and re-mark after a fix. Source pins for the wiring;
// the rules and the database functions are run for real in excel-efficiency-model-answer-runtime.test.mjs.

test("the Excel test list links to the Model Answer and Auto-grading pages beside Edit and Attempts", async () => {
  const page = await read("app/admin/excel-efficiency-tests/page.tsx");
  assert.match(page, /\/admin\/excel-efficiency-tests\/\$\{test\.id\}\/model-answer/);
  assert.match(page, /\/admin\/excel-efficiency-tests\/\$\{test\.id\}\/auto-grading/);
  assert.match(page, />Model Answer</);
  assert.match(page, />Auto-grading</);
});

test("the Model Answer page loads the current version's sheet, saved answer, questions and which have rules, and is admin only", async () => {
  const page = await read("app/admin/excel-efficiency-tests/[testId]/model-answer/page.tsx");
  assert.match(page, /await requireAdmin\(\)/);
  assert.match(page, /from\("excel_efficiency_versions"\)\.select\("id,title,working_matter_snapshot,model_answer_snapshot"\)/);
  assert.match(page, /from\("excel_efficiency_questions"\)/);
  assert.match(page, /from\("excel_efficiency_grading_rules"\)/);
  assert.match(page, /<ModelAnswerEditor/);
});

test("the Model Answer editor runs the real sheet in authoring mode and saves one question's rules at a time", async () => {
  const editor = await read("app/admin/excel-efficiency-tests/[testId]/model-answer/model-answer-editor.tsx");
  assert.match(editor, /mode="authoring"/);
  assert.match(editor, /oneTimeSubmit=\{false\}/);
  assert.match(editor, /submitConfirmMessage=\{null\}/);
  assert.match(editor, /submitLabel=\{active \? `Save answer for Q\$\{active\.number\}` : "Save Model Answer"\}/);
  assert.match(editor, /autosaveAction=\{saveExcelEfficiencyModelAnswer\}/);
  assert.match(editor, /submitAction=\{saveActiveAnswer\}/);
  assert.match(editor, /diffExcelDocuments\(before, document\)/);
  assert.match(editor, /excelQuestionRules\(active\.marks, excelRuleGroups\(document, changes\)\)/);
  assert.match(editor, /saveExcelEfficiencyQuestionRules\(versionId, activeNumber, rules\)/);
  // the same bar as Word's: question buttons with a tick or a cross, an arrow to hide the question, Reset
  assert.match(editor, /\{done \? "✓" : "✗"\}/);
  assert.match(editor, /aria-label=\{showQuestion \? "Hide the question text" : "Show the question text"\}/);
  assert.match(editor, /resetExcelEfficiencyModelAnswer\(versionId\)/);
  // a change the rules cannot check is said out loud
  assert.match(editor, /cannot be marked automatically/);
});

test("the save actions skip requireAdmin() like Word's (the sheet autosaves after every change); Reset does not", async () => {
  const actions = await read("app/admin/excel-efficiency-tests/actions.ts");
  const start = actions.indexOf("export async function saveExcelEfficiencyModelAnswer");
  const body = actions.slice(start);
  const saveBody = body.slice(0, body.indexOf("export async function resetExcelEfficiencyModelAnswer"));
  assert.doesNotMatch(saveBody, /await requireAdmin\(\)/);
  assert.match(saveBody, /save_excel_efficiency_model_answer/);
  assert.match(saveBody, /save_excel_efficiency_question_rules/);
  const resetBody = body.slice(body.indexOf("export async function resetExcelEfficiencyModelAnswer"));
  assert.match(resetBody, /await requireAdmin\(\)/);
  assert.match(resetBody, /reset_excel_efficiency_model_answer/);
});

test("the Auto-grading page checks the rules, gates publishing on the check and re-grades through the database functions", async () => {
  const page = await read("app/admin/excel-efficiency-tests/[testId]/auto-grading/page.tsx");
  assert.match(page, /rpc\("check_excel_efficiency_auto_grading"/);
  assert.match(page, /disabled=\{!enabled && !check\?\.ready\}/);
  assert.match(page, /regradeExcelEfficiencyAttempts/);
  const actions = await read("app/admin/excel-efficiency-tests/[testId]/auto-grading/actions.ts");
  assert.match(actions, /rpc\("set_excel_efficiency_auto_publish"/);
  assert.match(actions, /rpc\("regrade_excel_efficiency_version"/);
  assert.equal((actions.match(/await requireAdmin\(\)/g) ?? []).length, 2);
});

test("the sheet's own attempt behaviour is unchanged when the new props are left out", async () => {
  const editor = await read("app/typing/excel-efficiency/[language]/[testId]/workspace/rich-sheet-editor.tsx");
  assert.match(editor, /mode = "attempt"/);
  assert.match(editor, /submitLabel = "Submit"/);
  assert.match(editor, /submitConfirmMessage = "Submit your final sheet\? You cannot edit it afterward\."/);
  assert.match(editor, /oneTimeSubmit = true/);
  assert.match(editor, /\(autosaveAction \?\? autosaveExcelDocument\)/);
  assert.match(editor, /\(submitAction \?\? submitExcelDocument\)/);
  assert.match(editor, /if \(!oneTimeSubmit\) \{ setStatus\("Saved"\); setFinalSubmitting\(false\); submitting\.current = false; return true; \}/);
});

test("the Model Answer page says which database update is missing instead of answering 404 when the new column or rules access is not there", async () => {
  const page = await read("app/admin/excel-efficiency-tests/[testId]/model-answer/page.tsx");
  assert.match(page, /if \(versionError\) return <MigrationNotice testId=\{test\.id\} detail=\{versionError\.message\} \/>;/);
  assert.match(page, /if \(rulesError\) return <MigrationNotice/);
  assert.match(page, /202610291000_excel_efficiency_model_answer_and_auto_grading\.sql/);
  assert.ok(page.indexOf("if (versionError)") < page.indexOf("if (!version) notFound();"), "the real error is shown before the 404");
});
