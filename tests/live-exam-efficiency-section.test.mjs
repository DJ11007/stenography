import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Live Exam Center step 3c: Word and Excel parts run inside the exam page — the attempt starts (or carries on after a
// refresh) when the part opens, its timer never runs past the part's end, there is no Exit, and after submitting the
// attempt is linked to the part instead of opening the result page.
const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

test("a part's Word / Excel attempt is started only while the part is open, and a refresh carries on with it", async () => {
  const actions = await read("app/live-exam/actions.ts");
  assert.match(actions, /if \(!slot \|\| now < Date\.parse\(slot\.starts_at\)\) return \{ error: "This part has not started yet\." \} as const;/);
  assert.match(actions, /\.eq\("student_id", user\.id\)\.eq\("test_id", testId\)\.gte\("started_at", open\.startsAt\)/, "the attempt already started in this part is reused");
  assert.match(actions, /prepare_word_efficiency_attempt", \{ p_test_id: testId, p_duration_seconds: duration, p_delivery: delivery, p_live: false \}/);
  assert.match(actions, /prepare_excel_efficiency_attempt", \{ p_test_id: testId, p_duration_seconds: duration, p_show_questions: true, p_live: false \}/);
  assert.match(actions, /const remainingSeconds = Math\.min\(ownLeft, open\.secondsLeft\);/, "never past the part's end");
  assert.match(actions, /return sorted\.find\(\(value\) => value >= secondsLeft\) \?\? sorted\[sorted\.length - 1\] \?\? null;/);
});

test("the Word and Excel screens in exam mode: no Exit, and submitting hands back to the exam", async () => {
  const word = await read("app/typing/word-efficiency/[language]/[testId]/workspace/word-workspace.tsx");
  assert.match(word, /\{!liveExam&&<BackButton href=\{catalogueHref\} label="Exit"/);
  assert.match(word, /afterSubmit=\{liveExam\?\.onSubmitted\}/);
  const excel = await read("app/typing/excel-efficiency/[language]/[testId]/workspace/excel-workspace.tsx");
  assert.match(excel, /\{!liveExam && <BackButton href=\{catalogueHref\} label="Exit"/);
  assert.match(excel, /<RichSheetEditor afterSubmit=\{liveExam\?\.onSubmitted\}/);
  const docEditor = await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.equal(docEditor.split("(afterSubmit?afterSubmit():router.push(`/typing/word-efficiency/results/${attemptId}`))").length - 1, 2);
  const sheetEditor = await read("app/typing/excel-efficiency/[language]/[testId]/workspace/rich-sheet-editor.tsx");
  assert.equal(sheetEditor.split("if (afterSubmit) afterSubmit(); else router.push(`/typing/excel-efficiency/results/${attemptId}`);").length - 1, 2);
});

test("the exam room opens Word / Excel parts, links them when submitted, and an admin preview shows a card", async () => {
  const room = await read("app/live-exam/[examId]/live-exam-room.tsx");
  assert.match(room, /const workspaceOpen = phase\.kind === "section" && !phase\.section\.submitted && \(phase\.section\.kind === "typing" \|\| !preview\);/);
  assert.match(room, /const onSubmitted = \(\) => \{ void recordLiveExamEfficiency\(section\.id, loaded\.attemptId\)\.finally\(onSaved\); \};/);
  assert.match(room, /Admin preview: students get the \$\{phase\.section\.label\} test here/);
});
