import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Regression guard for a real reported gap: after finishing any test, the
// results screen's only way back ("Return to Tests") always linked to
// /typing/exams (Exam Simulators) no matter what kind of test was actually
// taken -- wrong for the far more common Practice/Learn/Stenography paths,
// e.g. finishing a Practice Test would send you to the unrelated Exam
// Simulators catalogue instead of back to Practice Tests.
test("the results screen's return link is computed from which kind of test was actually taken, not hardcoded to Exam Simulators", async () => {
  const workspace = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(workspace, /managedTest\.mode === "practice" \? `\/typing\/practice\/\$\{inputSystem\.language === "Hindi" \? "hindi" : "english"\}`/);
  assert.match(workspace, /managedTest\.mode === "learn" \? `\/typing\/learn\/\$\{inputSystem\.language === "Hindi" \? "hindi" : "english"\}`/);
  assert.match(workspace, /managedTest\.mode === "stenography" \? "\/typing\/practice\/stenography"/);
  assert.match(workspace, /returnHref=\{returnHref\} returnLabel=\{returnLabel\}/);
});

test("AdvancedTypingResults accepts an optional returnHref/returnLabel, defaulting to the previous Exam Simulators behavior for callers that don't pass one", async () => {
  const results = await read("app/typing/_components/advanced-typing-results.tsx");
  assert.match(results, /returnHref\?: string; returnLabel\?: string/);
  assert.match(results, /returnHref = "\/typing\/exams", returnLabel = "Return to Tests"/);
  assert.match(results, /<Link href=\{returnHref\}[^>]*>\{returnLabel\}<\/Link>/);
});
