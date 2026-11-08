import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the printable question paper is made from the current questions and shown only when the admin turned it on", () => {
  const loader = read("lib/question-paper.ts");
  assert.match(loader, /question_paper_ready/);
  assert.match(loader, /const ready = test\.status === "published" && test\.question_paper_ready === true;/);
  assert.match(loader, /if \(!ready && !isAdmin\) return null;/);
  // A live test's questions stay private while it is running.
  assert.match(loader, /if \(liveRunning && !isAdmin\) return null;/);
  assert.match(loader, /filter\(\(row\) => row\.is_visible !== false\)/);
  const migration = read("supabase/migrations/202611081300_efficiency_question_paper_ready.sql");
  assert.match(migration, /word_efficiency_tests add column if not exists question_paper_ready boolean not null default false/);
  assert.match(migration, /excel_efficiency_tests add column if not exists question_paper_ready boolean not null default false/);
});

test("students see Download question paper on the Instructions page (not for the live attempt); the admin list has the switch and a preview", () => {
  for (const subject of ["word", "excel"]) {
    const page = read(`app/typing/${subject}-efficiency/[language]/[testId]/instructions/page.tsx`);
    assert.match(page, new RegExp(`paperReady ?= ?!live ?&& ?await questionPaperReady\\("${subject}"`));
    assert.match(page, /QuestionPaperDownload/);
    assert.match(read(`app/typing/${subject}-efficiency/[language]/[testId]/paper/page.tsx`), new RegExp(`loadQuestionPaper\\("${subject}"`));
  }
  assert.match(read("app/admin/word-efficiency-tests/tests-page.tsx"), /<QuestionPaperToggle subject="word"/);
  assert.match(read("app/admin/excel-efficiency-tests/page.tsx"), /<QuestionPaperToggle subject="excel"/);
  assert.match(read("app/admin/question-paper-toggle.tsx"), /\/admin\/question-paper\/\$\{subject\}/);
  assert.match(read("components/efficiency/print-paper-button.tsx"), /window\.print\(\)/);
});
