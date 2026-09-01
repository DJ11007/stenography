import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { EFFICIENCY_EXAM_PATTERNS } from "../lib/efficiency-exam-patterns.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("efficiency exam patterns are unique, non-empty, and disclose sourcing per subject", () => {
  assert.ok(EFFICIENCY_EXAM_PATTERNS.length >= 4);
  const ids = new Set(EFFICIENCY_EXAM_PATTERNS.map((pattern) => pattern.id));
  assert.equal(ids.size, EFFICIENCY_EXAM_PATTERNS.length);
  for (const pattern of EFFICIENCY_EXAM_PATTERNS) {
    assert.ok(pattern.board.length > 0);
    assert.ok(pattern.examName.length > 0);
    assert.ok(["Word", "Excel", "Both"].includes(pattern.subject));
    assert.ok(pattern.taskFocus.length > 0);
    assert.ok(pattern.notes.length > 0);
    assert.equal(typeof pattern.sourced, "boolean");
  }
});

test("both a sourced and an estimated pattern exist, and Word/Excel each have at least one pattern", () => {
  assert.ok(EFFICIENCY_EXAM_PATTERNS.some((pattern) => pattern.sourced));
  assert.ok(EFFICIENCY_EXAM_PATTERNS.some((pattern) => !pattern.sourced));
  assert.ok(EFFICIENCY_EXAM_PATTERNS.some((pattern) => pattern.subject === "Word" || pattern.subject === "Both"));
  assert.ok(EFFICIENCY_EXAM_PATTERNS.some((pattern) => pattern.subject === "Excel" || pattern.subject === "Both"));
});

test("the unsourced Excel pattern honestly flags itself as not independently confirmed", () => {
  const estimated = EFFICIENCY_EXAM_PATTERNS.find((pattern) => !pattern.sourced);
  assert.ok(estimated);
  assert.ok(estimated.notes.some((note) => /not (?:independently confirmed|found stated)/i.test(note)));
});

test("the exam pattern reference component filters by subject and labels sourcing without gating authoring", async () => {
  const component = await read("components/efficiency/exam-pattern-reference.tsx");
  assert.match(component, /pattern\.subject === subject \|\| pattern\.subject === "Both"/);
  assert.match(component, /Sourced/);
  assert.match(component, /Estimated/);
  assert.match(component, /do not restrict what you author/i);
});

test("the Word admin authoring page no longer shows the exam pattern reference panel (removed at the admin's request); Excel's is unchanged", async () => {
  const wordPage = await read("app/admin/word-efficiency-tests/page.tsx");
  assert.doesNotMatch(wordPage, /<ExamPatternReference/);
  const excelPage = await read("app/admin/excel-efficiency-tests/page.tsx");
  assert.match(excelPage, /<ExamPatternReference subject="Excel" \/>/);
});
