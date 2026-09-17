import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported bug: "half error and full calculation is not correct in
// total" (checked for both Hindi and English). The list-page "Errors" tiles
// (/student/results, the admin per-test results table) always read the
// fullErrors/halfErrors saved on the attempt at submission -- frozen
// forever, per this project's own convention. But both attempt-review pages
// used to reconstruct their own `score` by re-running calculateTypingScore
// against the frozen snapshot passage/typedText with whatever scoring logic
// happens to be live *at view time*. Those two numbers only ever agreed by
// coincidence: any later change to analyzeTyping/managedVersionToPreset
// (half-error categories, RSSB marks-method fixes, category-flag changes --
// all things this project has actually done) silently made every
// already-submitted attempt's detailed breakdown disagree with its own
// list-page total. The fix stores the already-computed score (plus the
// exact resolved passage/typed text it was computed against) at submission
// and has both review pages use it verbatim, so nothing is ever recomputed
// with newer code against older data.

test("recordManagedAttempt saves the full computed score and the exact resolved passage/typed text it was scored against, not just scalar summaries", async () => {
  const actions = await read("app/tests/actions.ts");
  assert.match(actions, /const result = \{[^}]*\bscore,\s*resolvedPassage: effectivePassage,\s*comparisonText: normalized\.comparisonText\s*\};/s);
});

for (const page of ["app/admin/students/attempts/[attemptId]/page.tsx", "app/typing/attempts/[attemptId]/page.tsx"]) {
  test(`${page} prefers the frozen saved score over recomputing, falling back only for attempts saved before this field existed`, async () => {
    const content = await read(page);
    assert.match(content, /if \(result\.score && typeof result\.score === "object" && typeof result\.resolvedPassage === "string" && typeof result\.comparisonText === "string"\) \{/);
    assert.match(content, /score: result\.score as ReturnType<typeof calculateTypingScore>/);
    // The recompute path must still exist, for attempts recorded before this fix.
    assert.match(content, /const score = calculateTypingScore\(\{/);
  });
}
