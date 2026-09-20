import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported bug: AIIMS CRE LDC (and 23 of the other 24 exam categories)
// never actually had its real highlighting behavior researched/confirmed --
// examCategoryTypingRules() silently defaulted highlightMode to "character"
// for any category that didn't specify one, and that manufactured default
// then got LOCKED during the exam exactly like a genuine researched rule
// (e.g. RRB NTPC's confirmed "none"), with nothing distinguishing the two.
// User's explicit instruction: when a setting's real exam behavior isn't
// confirmed, don't guess and lock it -- unlock it so the student can set it
// themselves. Backspace/word-calculation stay locked regardless (they
// change the actual scoring math, unlike highlighting, which is purely
// visual), so this is deliberately scoped to highlightMode only.
test("AIIMS CRE LDC has no confirmed highlightMode, while RRB NTPC (a genuinely researched category) does", async () => {
  const source = await read("lib/exam-categories.ts");
  const aiims = source.slice(source.indexOf('slug: "aiims-cre-ldc"'), source.indexOf('slug: "aiims-cre-ldc"') + 400);
  assert.doesNotMatch(aiims, /highlightMode/);
  const ntpc = source.slice(source.indexOf('slug: "rrb-ntpc"'), source.indexOf('slug: "rrb-ntpc"') + 400);
  assert.match(ntpc, /highlightMode: "none"/);
});

test("configurable-typing-exam.tsx re-derives highlight confirmation from EXAM_CATEGORIES directly, not from the stored preset value, so an already-saved manufactured default can't fool it", async () => {
  const source = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(source, /import \{ EXAM_CATEGORIES \} from "@\/lib\/exam-categories";/);
  assert.match(source, /const categoryHighlightConfirmed = preset\.examCategorySlug\s*\n?\s*\? Boolean\(EXAM_CATEGORIES\.find\(\(category\) => category\.slug === preset\.examCategorySlug\)\?\.highlightMode\)\s*\n?\s*: Boolean\(preset\.highlightMode\);/);
  // Also gated on !manualUnlock -- a student can unlock highlighting along
  // with Backspace/Word calculation via the one shared unlock toggle, same
  // as the other two official-rule controls.
  assert.match(source, /const highlightLocked = rulesLocked && categoryHighlightConfirmed && !manualUnlock;/);
});

test("both places that force highlightMode onto the student's settings gate on highlightLocked, not the old blanket official/managed check", async () => {
  const source = await read("app/typing/_components/configurable-typing-exam.tsx");
  const matches = [...source.matchAll(/if \(highlightLocked\) resolved\.highlightMode = preset\.highlightMode as TypingSettings\["highlightMode"\];/g)];
  assert.equal(matches.length, 2, "expected the useEffect initializer and start() to both use highlightLocked");
  assert.doesNotMatch(source, /managedRulesLocked \|\| resolvedAttemptVariant === "official"\) && preset\.highlightMode/);
});

test("highlightLocked threads through ExamWorkspace's props and its reset button leaves highlighting alone when it isn't a confirmed rule", async () => {
  const source = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(source, /highlightLocked: boolean;/);
  assert.match(source, /rulesLocked, highlightLocked, backspaceLocked, wordMethodLocked, manualUnlock, onManualUnlockChange, typedText,/);
  assert.match(source, /rulesLocked=\{rulesLocked\} highlightLocked=\{highlightLocked\}/);
  assert.match(source, /update\(\{ \.\.\.\(highlightLocked \? \{\} : \{ highlightMode: DEFAULT_TYPING_SETTINGS\.highlightMode \}\), \.\.\.\(backspaceLocked \? \{\} : \{ backspaceMode: DEFAULT_TYPING_SETTINGS\.backspaceMode \}\), \.\.\.\(wordMethodLocked \? \{\} : \{ wordMethod: DEFAULT_TYPING_SETTINGS\.wordMethod \}\) \}\);/);
});

test("UniversalTypingSettings accepts an independent highlightLocked prop (defaulting to rulesLocked for callers that don't distinguish), and Word calculation gets the same treatment via wordMethodLocked", async () => {
  const source = await read("app/typing/_components/universal-typing-settings.tsx");
  assert.match(source, /highlightLocked\?: boolean;/);
  assert.match(source, /const highlightIsLocked = highlightLocked \?\? rulesLocked;/);
  assert.match(source, /label="Highlight" value=\{settings\.highlightMode\} disabled=\{highlightIsLocked\}/);
  assert.match(source, /label="Backspace" value=\{settings\.backspaceMode\} disabled=\{backspaceIsLocked\}/);
  assert.match(source, /label="Word calculation" value=\{settings\.wordMethod\} disabled=\{wordMethodIsLocked\}/);
});
