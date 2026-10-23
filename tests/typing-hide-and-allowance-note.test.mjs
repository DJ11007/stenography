import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the typing exam header has a Hide/Show typed text button before the full screen button that blanks only the textarea text", async () => {
  const exam = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.ok(exam.indexOf("Hide typed text") > 0 && exam.indexOf("Hide typed text") < exam.indexOf("Enter full screen"));
  assert.match(exam, /hideTyping \? \{ color: "transparent", caretColor: "#0f172a" \} : \{\}/);
});

test("the Model Answer page has an arrow in the question series that hides the question text", async () => {
  const editor = await read("app/admin/word-efficiency-tests/[testId]/model-answer/model-answer-editor.tsx");
  assert.match(editor, /const \[showQuestion, setShowQuestion\] = useState\(true\);/);
  assert.match(editor, /\{active && showQuestion && \(/);
  assert.match(editor, /aria-label=\{showQuestion \? "Hide the question text" : "Show the question text"\}/);
});

test("results explain the mistake allowance, so Net = Gross with many listed mistakes is not a mystery", async () => {
  const results = await read("app/typing/_components/advanced-typing-results.tsx");
  assert.match(results, /function MistakeAllowanceNote/);
  assert.equal((results.match(/<MistakeAllowanceNote /g) ?? []).length, 2);
  assert.match(results, /that is why Net Speed equals Gross Speed/);
});
