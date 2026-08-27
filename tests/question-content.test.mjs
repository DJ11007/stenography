import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseQuestionContent, tabularTextToMarkdownTable } from "../lib/question-content.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("plain text with no special syntax stays a single paragraph", () => {
  const blocks = parseQuestionContent("Type the following passage exactly as shown.");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "paragraph");
  assert.equal(blocks[0].text, "Type the following passage exactly as shown.");
});

test("a bullet list block is recognized and markers are stripped", () => {
  const blocks = parseQuestionContent("- First item\n- Second item\n* Third item");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "bullet-list");
  assert.deepEqual(blocks[0].items, ["First item", "Second item", "Third item"]);
});

test("a numbered list block is recognized and markers are stripped", () => {
  const blocks = parseQuestionContent("1. Open the workbook\n2) Enter the values\n3. Save the file");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "numbered-list");
  assert.deepEqual(blocks[0].items, ["Open the workbook", "Enter the values", "Save the file"]);
});

test("a pipe table with a separator row parses into header and body rows, ignoring the separator", () => {
  const blocks = parseQuestionContent("| Name | Marks |\n|---|---|\n| Ramesh | 42 |\n| Sita | 47 |");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "table");
  assert.deepEqual(blocks[0].rows, [["Name", "Marks"], ["Ramesh", "42"], ["Sita", "47"]]);
});

test("a line with a stray pipe but no separator row is not mistaken for a table", () => {
  const blocks = parseQuestionContent("Use the pipe | symbol only where needed.");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "paragraph");
});

test("mixed content splits into separate blocks on blank lines: paragraph, table, paragraph", () => {
  const blocks = parseQuestionContent("Enter the following data exactly:\n\n| Item | Qty |\n|---|---|\n| Pens | 10 |\n\nThen save the file as answer.xlsx.");
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].type, "paragraph");
  assert.equal(blocks[1].type, "table");
  assert.equal(blocks[2].type, "paragraph");
});

test("tabularTextToMarkdownTable converts tab-and-newline clipboard text copied from Excel/Word into a pipe table", () => {
  const table = tabularTextToMarkdownTable("Name\tMarks\nRamesh\t42\nSita\t47");
  assert.ok(table);
  assert.match(table, /^\| Name \| Marks \|/);
  assert.match(table, /\|---\|---\|/);
  assert.match(table, /\| Ramesh \| 42 \|/);
  const reparsed = parseQuestionContent(table);
  assert.equal(reparsed[0].type, "table");
});

test("tabularTextToMarkdownTable returns null for ordinary pasted prose", () => {
  assert.equal(tabularTextToMarkdownTable("Just a normal sentence with no tabs."), null);
  assert.equal(tabularTextToMarkdownTable("Line one\nLine two\nLine three"), null);
});

test("the shared QuestionContent renderer renders tables, both list types, and bold text without dangerouslySetInnerHTML", async () => {
  const component = await read("components/efficiency/question-content.tsx");
  assert.match(component, /parseQuestionContent/);
  assert.match(component, /<table /);
  assert.match(component, /list-disc/);
  assert.match(component, /list-decimal/);
  assert.match(component, /<strong /);
  assert.doesNotMatch(component, /dangerouslySetInnerHTML/);
});

test("both admin question editors use the shared authoring toolbar and preview questions with QuestionContent instead of raw text", async () => {
  const wordEditor = await read("app/admin/word-efficiency-tests/question-editor.tsx");
  assert.match(wordEditor, /<QuestionContentEditor/);
  assert.match(wordEditor, /<QuestionContent text=\{question\.instruction\}/);
  const excelEditor = await read("app/admin/excel-efficiency-tests/question-editor.tsx");
  assert.match(excelEditor, /<QuestionContentEditor/);
  assert.match(excelEditor, /<QuestionContent text=\{question\.instruction\}/);
});

test("the shared authoring toolbar exposes bold, both list types, a table inserter, and converts pasted tabular clipboard text automatically", async () => {
  const editor = await read("components/efficiency/question-content-editor.tsx");
  assert.match(editor, /Bold/);
  assert.match(editor, /Bullet list/);
  assert.match(editor, /Numbered list/);
  assert.match(editor, /Insert table/);
  assert.match(editor, /onPaste=\{handlePaste\}/);
  assert.match(editor, /tabularTextToMarkdownTable/);
});

test("student-facing question surfaces (workspace panels, results tables, grading views) render rich question content rather than raw instruction strings", async () => {
  const sources = await Promise.all([
    "app/typing/word-efficiency/[language]/[testId]/workspace/word-workspace.tsx",
    "app/typing/excel-efficiency/[language]/[testId]/workspace/excel-workspace.tsx",
    "app/typing/word-efficiency/results/[attemptId]/page.tsx",
    "app/typing/excel-efficiency/results/[attemptId]/page.tsx",
    "app/admin/word-efficiency-tests/attempts/[attemptId]/grading-form.tsx",
    "app/admin/excel-efficiency-tests/attempts/[attemptId]/grading-form.tsx",
    "app/admin/word-efficiency-tests/attempts/[attemptId]/page.tsx",
    "app/admin/excel-efficiency-tests/attempts/[attemptId]/page.tsx",
  ].map(read));
  for (const source of sources) assert.match(source, /<QuestionContent /);
});
