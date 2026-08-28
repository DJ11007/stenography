import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Regression coverage for a real bug: autosave/submit fire on every debounced
// edit during a live attempt. requireStudent() does a live auth.getUser()
// revalidation plus a profiles lookup, purely to redirect("/login") if
// either fails -- a transient hiccup in either call under load bounced a
// mid-exam student straight to the sign-in page (a false "logout"), and
// added two unnecessary round trips to the hottest path in the app.
// Ownership/role are already enforced inside the RPCs themselves
// (student_id=auth.uid(), is_active_word_efficiency_student()), which
// return a normal {ok:false} error instead of redirecting.

test("Word Efficiency's autosave and submit actions do not call requireStudent(), but the one-time prepare/start actions still do", async () => {
  const actions = await read("app/typing/word-efficiency/actions.ts");
  const autosaveBody = actions.slice(actions.indexOf("export async function autosaveWordDocument"), actions.indexOf("export async function submitWordDocument"));
  const submitBody = actions.slice(actions.indexOf("export async function submitWordDocument"), actions.indexOf("function submissionError"));
  assert.doesNotMatch(autosaveBody, /requireStudent\(\)/);
  assert.doesNotMatch(submitBody, /requireStudent\(\)/);
  const prepareBody = actions.slice(actions.indexOf("export async function prepareWordAttempt"), actions.indexOf("export async function startWordAttempt"));
  const startBody = actions.slice(actions.indexOf("export async function startWordAttempt"), actions.indexOf("export async function autosaveWordDocument"));
  assert.match(prepareBody, /requireStudent\(\)/);
  assert.match(startBody, /requireStudent\(\)/);
});

test("Excel Efficiency's autosave and submit actions do not call requireStudent(), but the one-time prepare action still does", async () => {
  const actions = await read("app/typing/excel-efficiency/actions.ts");
  const prepareBody = actions.slice(actions.indexOf("export async function prepareExcelAttempt"), actions.indexOf("export async function autosaveExcelDocument"));
  const autosaveBody = actions.slice(actions.indexOf("export async function autosaveExcelDocument"), actions.indexOf("export async function submitExcelDocument"));
  const submitBody = actions.slice(actions.indexOf("export async function submitExcelDocument"));
  assert.match(prepareBody, /requireStudent\(\)/);
  assert.doesNotMatch(autosaveBody, /requireStudent\(\)/);
  assert.doesNotMatch(submitBody, /requireStudent\(\)/);
});
