import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Reported 9 Nov 2026: a student solved questions with Flash Fill (right values, no formula) and the paper marked them
// wrong, because every answer check of Tests 4/5/6 said {"formula": true}. A question can be done many ways (formula,
// drag and fill, Flash Fill, typing) -- the ANSWER is what is marked.
test("the marking migration removes the formula requirement from the value check and fixes the instructions", async () => {
  const sql = await read("supabase/migrations/202611091300_excel_marks_by_answer_not_method.sql");
  assert.match(sql, /excel_efficiency_criterion_matches/);
  assert.match(sql, /judged by its value; how it was made \(formula, Flash Fill, typing\) does not matter/);
  assert.match(sql, /could not remove the formula requirement/);
  assert.match(sql, /Any method is fine \(formula, drag and fill, Flash Fill or typing\)/);
  assert.match(sql, /efficiency-test-4', 'efficiency-test-5', 'efficiency-test-6'/);
});

test("the three generators no longer tell students to use formulas only", async () => {
  for (const n of [4, 5, 6]) {
    const script = await read(`scripts/build-excel-test${n}.mjs`);
    assert.doesNotMatch(script, /not by typing the answers/);
    assert.match(script, /Any method is fine \(formula, drag and fill, Flash Fill or typing\)/);
  }
});
