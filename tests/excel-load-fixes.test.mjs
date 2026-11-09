import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Load test, 9 Nov 2026 (docs/load-test-efficiency.md): on the 200-row Excel papers one autosave costs the database
// ~160 ms and one marking pass 0.9-1.7 s; with 100+ students at once the submit (which marked every question 2-3 times)
// risked the 8 s statement_timeout of the `authenticated` role.
test("the submit migration marks each question once and takes the comment from that number", async () => {
  const sql = await read("supabase/migrations/202611091200_excel_submit_scores_each_question_once.sql");
  assert.match(sql, /awarded numeric;/);
  assert.match(sql, /awarded := ' \|\| call/);
  assert.match(sql, /<> 1 then raise exception 'marking function should now be called once'/);
  // idempotent: a second run does nothing
  assert.match(sql, /position\('awarded :=' in def\) > 0 then raise notice/);
});

test("big Excel sheets autosave at most every 8 s, small sheets keep the quick 800 ms save", async () => {
  const editor = await read("app/typing/excel-efficiency/[language]/[testId]/workspace/rich-sheet-editor.tsx");
  assert.match(editor, /BIG_SHEET_CELLS = 800, BIG_SHEET_SAVE_GAP_MS = 8000/);
  assert.match(editor, /const wait = big \? Math\.max\(800, BIG_SHEET_SAVE_GAP_MS - \(Date\.now\(\) - lastSaveAt\.current\)\) : 800;/);
  assert.match(editor, /setTimeout\(\(\) => \{ void saveDocument\(\); \}, wait\)/);
  // Submit still sends the whole current document, so nothing is lost by the slower autosave.
  assert.match(editor, /submitExcelDocument/);
  // Test 6 (small) stays under the limit, Tests 4 and 5 start above it.
  const cells = async (n) => Object.keys(JSON.parse(await read(`tests/fixtures/excel-test${n}-initial.json`)).cells).length;
  assert.ok((await cells(6)) < 800);
  assert.ok((await cells(5)) > 800 && (await cells(4)) > 800);
});
