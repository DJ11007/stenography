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
  const keys = await read("lib/exam-blocked-keys.ts");
  assert.match(guard, /import \{ blockedKeyName \} from "@\/lib\/exam-blocked-keys";/);
  assert.match(keys, /if \(key === "F5" \|\| \(ctrl && \(key === "r" \|\| key === "R"\)\)\) return "Refresh \(F5 \/ Ctrl\+R\)";/);
  assert.match(guard, /window\.addEventListener\("popstate", onPop, true\);/);
  assert.match(guard, /window\.addEventListener\("contextmenu", onContextMenu, true\);/);
  assert.match(guard, /<button type="button" tabIndex=\{-1\}/);
});

// Reported 2026-10-21: a student pressed some key mid-test and a "coding page" (the browser's Developer
// Tools) opened on the right side of the test.
test("a running typing test blocks Developer Tools and other browser-only keys, but never a typing key", async () => {
  const { blockedKeyName } = await import("../lib/exam-blocked-keys.ts");
  const press = (key, mods = {}) => blockedKeyName({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });
  // Developer Tools: F12, Ctrl+Shift+I / J / C / K.
  assert.ok(press("F12"));
  for (const key of ["I", "J", "C", "K"]) assert.ok(press(key, { ctrlKey: true, shiftKey: true }), `Ctrl+Shift+${key}`);
  assert.ok(press("Delete", { ctrlKey: true, shiftKey: true }), "clear browsing data");
  for (const key of ["F1", "F2", "F3", "F4", "F6", "F7", "F8", "F9", "F10"]) assert.ok(press(key), key);
  assert.equal(press("F11"), null, "full screen does not harm the test");
  assert.ok(press("d", { altKey: true }), "Alt+D (address bar)");
  assert.ok(press("PageDown", { ctrlKey: true }), "switch tab");
  assert.ok(press("e", { ctrlKey: true }), "Ctrl+E (search)");
  // Typing keys -- English, Kruti Dev (Shift+letters and symbols), AltGr, Alt+number-pad codes -- still type.
  for (const key of ["a", "Z", "1", ";", "'", " ", "Enter", "Backspace", "ArrowLeft", "Shift"]) assert.equal(press(key), null, key);
  for (const key of ["K", "A", "\"", "~", "{"]) assert.equal(press(key, { shiftKey: true }), null, `Shift+${key}`);
  assert.equal(press("e", { ctrlKey: true, altKey: true }), null, "AltGr");
  assert.equal(press("0", { altKey: true }), null, "Alt+number-pad code");
  assert.equal(press("Alt", { altKey: true }), null);
});

test("typing passages are justified like Word (straight right edge)", async () => {
  const exam = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(exam, /<p className="whitespace-pre-wrap text-justify text-slate-900">/);
  const lesson = await read("app/typing/_components/lesson-workspace.tsx");
  assert.match(lesson, /whitespace-pre-wrap rounded-xl bg-blue-50 p-5 text-justify text-slate-700/);
});
