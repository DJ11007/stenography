import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Reported 2026-10-19: students lost tests (no result) when a stray key was pressed mid-test.
test("a running typing test blocks Back/refresh/browser keys and never asks with the browser's OK/Cancel box", async () => {
  const exam = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.doesNotMatch(exam, /window\.confirm\(/);
  assert.doesNotMatch(exam, /window\.alert\(/);
  assert.match(exam, /<ExamGuard active=\{timerStarted && !finished\}/);
  const guard = await read("app/typing/_components/exam-guard.tsx");
  assert.match(guard, /if \(key === "F5" \|\| \(ctrl && \(key === "r" \|\| key === "R"\)\)\) return "Refresh \(F5 \/ Ctrl\+R\)";/);
  assert.match(guard, /window\.addEventListener\("popstate", onPop, true\);/);
  assert.match(guard, /<button type="button" tabIndex=\{-1\}/);
});

test("typing passages are justified like Word (straight right edge)", async () => {
  const exam = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(exam, /<p className="whitespace-pre-wrap text-justify text-slate-900">/);
  const lesson = await read("app/typing/_components/lesson-workspace.tsx");
  assert.match(lesson, /whitespace-pre-wrap rounded-xl bg-blue-50 p-5 text-justify text-slate-700/);
});
