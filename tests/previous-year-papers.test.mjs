import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { formatExamDate, groupPapersByYear, parsePreviousYearForm, isPreviousYearSection } from "../lib/previous-year-papers.ts";

test("the admin form needs an exam name and a date or year; the year follows the date", () => {
  assert.deepEqual(parsePreviousYearForm({ examName: " RSMSSB IA ", examDate: "2024-09-15", examYear: "2020", description: "  Shift 1 " }), { ok: true, value: { examName: "RSMSSB IA", examDate: "2024-09-15", examYear: 2024, description: "Shift 1" } });
  assert.deepEqual(parsePreviousYearForm({ examName: "X", examDate: "", examYear: "2023", description: "" }), { ok: true, value: { examName: "X", examDate: null, examYear: 2023, description: null } });
  assert.equal(parsePreviousYearForm({ examName: "", examDate: "2024-01-01", examYear: "", description: "" }).ok, false);
  assert.equal(parsePreviousYearForm({ examName: "X", examDate: "", examYear: "", description: "" }).ok, false);
  assert.equal(parsePreviousYearForm({ examName: "X", examDate: "15/09/2024", examYear: "", description: "" }).ok, false);
});

test("dates read the Indian way, and papers group by year, newest first", () => {
  assert.equal(formatExamDate({ examDate: "2024-09-15", examYear: 2024 }), "15 Sep 2024");
  assert.equal(formatExamDate({ examDate: null, examYear: 2023 }), "2023");
  const groups = groupPapersByYear([{ examYear: 2023, examDate: null }, { examYear: 2024, examDate: "2024-01-05" }, { examYear: 2024, examDate: "2024-09-15" }]);
  assert.deepEqual(groups.map((group) => [group.year, group.papers.map((paper) => paper.examDate)]), [[2024, ["2024-09-15", "2024-01-05"]], [2023, [null]]]);
  assert.ok(isPreviousYearSection("stenography") && !isPreviousYearSection("live"));
});

test("every section shows the highlight, and the table is readable by all but written only by admins", async () => {
  for (const file of ["app/typing/word-efficiency/_components/word-test-catalogue.tsx", "app/typing/excel-efficiency/_components/excel-test-catalogue.tsx", "app/typing/exams/category/[slug]/[language]/page.tsx", "app/typing/practice/stenography/exams/[slug]/real-test-grid.tsx"])
    assert.match(await readFile(file, "utf8"), /PREVIOUS_YEAR_CARD/, file);
  const sql = await readFile("supabase/migrations/202611282000_previous_year_papers.sql", "utf8");
  assert.match(sql, /for select using \(true\)/);
  assert.match(sql, /using \(public\.is_aal2_admin\(\)\) with check \(public\.is_aal2_admin\(\)\)/);
  assert.match(await readFile("app/typing/page.tsx", "utf8"), /\/typing\/old-exam-papers/);
});
