import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gradingRuleProblem, validateWordDraft, withValidGradingRules } from "../lib/word-efficiency.ts";

// An admin can reword a question after solving the model paper: grading rules are worked out on the Model Answer
// page and only carried through the test form, so a rule that no longer fits is left out of the save instead of
// refusing it, and an edited question keeps its whole rule (every extra check, e.g. all six cells of a column).
const base = { title: "EFFICIENCY TEST 3", language: "English", instructions: "1. Carefully read the instructions.", durations: [600], questionCount: 2, maximumMarks: 3, passingMarks: null, onscreen: true, pdf: false, hasPdf: false };
const rule = (marks) => ({ target: "blocks.7.attrs.cellFormats.0.3.color", expectedOperation: "model-answer-match-v2", expectedValue: "\"C9C9C9\"", allocatedMarks: marks, partialMarks: null });
const question = (number, marks, gradingRule) => ({ number, instruction: "Apply font colour to the fourth column of the table Gray, Accent-3, lighter 40%.", marks, section: null, display_order: number, is_visible: true, gradingRule });

test("a rule that no longer fits is dropped from the save, never a reason to refuse it", () => {
  const questions = [question(1, 1, rule(1)), question(2, 2, rule(3))];
  assert.match(gradingRuleProblem(questions[1]), /worth 3 marks, more than the question's 2/);
  const kept = withValidGradingRules(questions);
  assert.deepEqual(kept[0].gradingRule, rule(1));
  assert.equal(kept[1].gradingRule, null);
  assert.deepEqual(validateWordDraft({ ...base, questions: kept }), []);
});

test("the test form carries each rule's extra checks, so a reworded question keeps them all", async () => {
  const page = await readFile(new URL("../app/admin/word-efficiency-tests/tests-page.tsx", import.meta.url), "utf8");
  assert.match(page, /allocated_marks,partial_marks,additional_criteria"\)/);
  assert.match(page, /additionalCriteria:Array\.isArray\(rule\.additional_criteria\)/);
  const actions = await readFile(new URL("../app/admin/word-efficiency-tests/actions.ts", import.meta.url), "utf8");
  assert.match(actions, /const questions=withValidGradingRules\(parseWordQuestions\(value\(form,"questions"\)\)\);/);
});

test("answering a question again on the Model Answer page keeps its hand-written (part-by-part) marking", async () => {
  // Re-solving the paper on 2 Nov replaced Test 2's (a)(b)(c) rules and Test 3's footer rules with rules rebuilt
  // from the document, which cannot express parts, "every word" or a date format -- whole batches were mis-marked.
  const editor = await readFile(new URL("../app/admin/word-efficiency-tests/[testId]/model-answer/model-answer-editor.tsx", import.meta.url), "utf8");
  assert.match(editor, /const rulesPayload = \(document: unknown, nextAssignments: Record<number, Criterion\[\]>\) => questions\.map\(\(question\) => question\.keptRules\.length\s+\? \{ questionNumber: question\.number, keep: question\.keptRules \}/);
  assert.doesNotMatch(editor, /keptRules\.length && !nextTouched\.has/);
  const page = await readFile(new URL("../app/admin/word-efficiency-tests/[testId]/model-answer/page.tsx", import.meta.url), "utf8");
  assert.match(page, /rule\.expected_operation !== "model-answer-match-v2" \|\| Boolean\(rule\.part_label\) \|\|/);
});

test("a triple-click selects the whole paragraph even when it is split between two pages", async () => {
  // The page-split spacer is non-editable, which the browser takes for the end of a paragraph: a triple-click on
  // paragraph 3 of Test 2 (split on an A5 page) selected only one half, so an effect reached only part of it.
  const editor = (await readFile(new URL("../app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  assert.match(editor, /onMouseUp=\{event=>\{endCellDrag\(\);if\(event\.detail===3\)window\.setTimeout\(selectWholeSplitParagraph,0\);/);
  assert.match(editor, /function selectWholeSplitParagraph\(\) \{[\s\S]*?if \(!block\?\.querySelector\("\[data-page-split\]"\)\) return;[\s\S]*?range\.selectNodeContents\(block\);/);
});

test("bullets or numbering on a selection reaching a table keep the table a table", async () => {
  // Test 2, 3 Nov: the browser's list command wrapped the table in a bullet item (<p><ul><li>…</li><li><table>), the
  // editor then lifted the list to the top, and the table was saved as one list paragraph -- Q5 0 for every student.
  const editor = (await readFile(new URL("../app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  assert.match(editor, /document\.execCommand\(name,false,safeValue\);[^\n]*\n\s+if\(cellListsBefore&&editor\.current\)keepTablesOutOfLists\(editor\.current,cellListsBefore\);/);
  assert.match(editor, /wrapLooseText\(editor\.current\);\n\s+if\(cellListsBefore&&editor\.current\)keepTablesOutOfLists/);
  assert.match(editor, /function keepTablesOutOfLists\(root: HTMLElement, cellListsBefore: Set<HTMLElement>\) \{[\s\S]*?root\.querySelectorAll<HTMLElement>\("ul table, ol table"\)[\s\S]*?top\.after\(table\);/);
  // and a list inside a table is never lifted out over the table
  assert.match(editor, /if\(!list\.isConnected\|\|list\.closest\("td,th"\)\)continue;/);
});
