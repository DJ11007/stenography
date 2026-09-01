import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const EXAM = "app/typing/_components/configurable-typing-exam.tsx";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Print / PDF opens a print-ready window of the exact passage (no new dependency -- uses the browser's own print-to-PDF)", async () => {
  const exam = await read(EXAM);
  assert.match(exam, /const printPassage = \(\) => \{/);
  assert.match(exam, /window\.open\("", "_blank", "noopener,noreferrer"\)/);
  assert.match(exam, /printWindow\.onload = \(\) => \{ printWindow\.focus\(\); printWindow\.print\(\); \};/);
  // Uses the exact same passage the student is scored against, not a
  // separately-maintained copy.
  assert.match(exam, /escapeHtmlForPrint\(passage\)/);
  // Guards against XSS via a title/passage containing HTML.
  assert.match(exam, /const escapeHtmlForPrint = \(value: string\) => value\.replace\(\/&\/g, "&amp;"\)\.replace\(\/</);
});

test("Printout Mode requires confirmation, then hides the Original Passage panel and expands typing to full height, without touching scoring", async () => {
  const exam = await read(EXAM);
  assert.match(exam, /const \[printoutMode, setPrintoutMode\] = useState\(false\);/);
  assert.match(exam, /const \[showPrintoutConfirm, setShowPrintoutConfirm\] = useState\(false\);/);
  // Toggling on goes through a confirmation dialog, not a direct toggle.
  assert.match(exam, /onClick=\{\(\) => \(printoutMode \? setPrintoutMode\(false\) : setShowPrintoutConfirm\(true\)\)\}/);
  // Locked once the timer has actually started -- can't be toggled mid-attempt.
  assert.match(exam, /disabled=\{timerStarted\} aria-pressed=\{printoutMode\}/);
  // The passage panel and the two-row grid layout both react to it, exactly
  // like they already do for dictation (audio) tests.
  assert.match(exam, /\{preset\.audioUrl \|\| printoutMode \? "" : "grid-rows-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]"\}/);
  assert.match(exam, /\{!preset\.audioUrl && !printoutMode && <section className="flex min-h-0 flex-col bg-white" aria-labelledby="original-passage-title">/);
  assert.match(exam, /placeholder=\{printoutMode \? "Type here from the printed passage you downloaded/);
});

test("both buttons are hidden for dictation (audio) tests, which have no on-screen passage to print or hide in the first place", async () => {
  const exam = await read(EXAM);
  assert.match(exam, /\{!preset\.audioUrl && <button type="button" onClick=\{printPassage\}/);
  assert.match(exam, /\{!preset\.audioUrl && <button type="button" disabled=\{timerStarted\} aria-pressed=\{printoutMode\}/);
});
