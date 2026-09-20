import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real requested feature: a student sometimes has a genuine reason to
// deviate from an official/managed test's locked rules (e.g. practicing a
// passage without the real exam's harsh "no correction at all"
// restriction). An explicit unlock (rendered as a lock/unlock symbol) lets
// them override every official-rule control themselves "when necessary" --
// Highlight, Backspace, AND Word calculation together, not Backspace
// alone -- defaulting to locked, only available before typing starts. Word
// calculation's on-screen number can briefly desync from what a managed
// test's server-side rescore ultimately saves (recordManagedAttempt in
// app/tests/actions.ts always rescores using the test's own real
// wordMethod server-side regardless of the client's local setting), which
// is exactly why the warning shown alongside the toggle tells the student
// not to rely on the on-screen result while unlocked.
test("manualUnlock state exists, is only offered before the timer starts, and forces backspaceMode and wordMethod from the student's own preference when set", async () => {
  const source = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(source, /const \[manualUnlock, setManualUnlock\] = useState\(false\);/);
  assert.match(source, /const backspaceLocked = rulesLocked && !manualUnlock;/);
  assert.match(source, /const wordMethodLocked = rulesLocked && !manualUnlock;/);
  assert.match(source, /const highlightLocked = rulesLocked && categoryHighlightConfirmed && !manualUnlock;/);
  assert.match(source, /onManualUnlockChange=\{!timerStarted \? setManualUnlock : undefined\}/);
  const backspaceMatches = [...source.matchAll(/if \(manualUnlock\) resolved\.backspaceMode = preferences\.backspaceMode;/g)];
  assert.equal(backspaceMatches.length, 2, "expected the useEffect initializer and start() to both apply the manual unlock to backspaceMode");
  const wordMethodMatches = [...source.matchAll(/if \(manualUnlock\) resolved\.wordMethod = preferences\.wordMethod;/g)];
  assert.equal(wordMethodMatches.length, 2, "expected the useEffect initializer and start() to both apply the manual unlock to wordMethod");
});

test("backspaceLocked and wordMethodLocked (not the blanket rulesLocked) thread through ExamWorkspace to gate their own controls and the reset button", async () => {
  const source = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(source, /backspaceLocked: boolean; wordMethodLocked: boolean; manualUnlock: boolean; onManualUnlockChange\?: \(value: boolean\) => void;/);
  assert.match(source, /rulesLocked, highlightLocked, backspaceLocked, wordMethodLocked, manualUnlock, onManualUnlockChange, typedText,/);
  assert.match(source, /rulesLocked=\{rulesLocked\} highlightLocked=\{highlightLocked\} backspaceLocked=\{backspaceLocked\} wordMethodLocked=\{wordMethodLocked\} manualUnlock=\{manualUnlock\} onManualUnlockChange=\{onManualUnlockChange\}/);
  assert.match(source, /update\(\{ \.\.\.\(highlightLocked \? \{\} : \{ highlightMode: DEFAULT_TYPING_SETTINGS\.highlightMode \}\), \.\.\.\(backspaceLocked \? \{\} : \{ backspaceMode: DEFAULT_TYPING_SETTINGS\.backspaceMode \}\), \.\.\.\(wordMethodLocked \? \{\} : \{ wordMethod: DEFAULT_TYPING_SETTINGS\.wordMethod \}\) \}\);/);
});

test("UniversalTypingSettings renders one lock/unlock symbol button covering Highlight, Backspace, AND Word calculation, all gated on their own *Locked prop (defaulting to rulesLocked)", async () => {
  const source = await read("app/typing/_components/universal-typing-settings.tsx");
  assert.match(source, /backspaceLocked\?: boolean;/);
  assert.match(source, /wordMethodLocked\?: boolean;/);
  assert.match(source, /manualUnlock\?: boolean;/);
  assert.match(source, /onManualUnlockChange\?: \(value: boolean\) => void;/);
  assert.match(source, /const backspaceIsLocked = backspaceLocked \?\? rulesLocked;/);
  assert.match(source, /const wordMethodIsLocked = wordMethodLocked \?\? rulesLocked;/);
  assert.match(source, /label="Backspace" value=\{settings\.backspaceMode\} disabled=\{backspaceIsLocked\}/);
  assert.match(source, /label="Word calculation" value=\{settings\.wordMethod\} disabled=\{wordMethodIsLocked\}/);
  assert.match(source, /\{rulesLocked && onManualUnlockChange && <button/);
  assert.match(source, /\{manualUnlock \? "🔓" : "🔒"\}/);
  assert.match(source, /Unlock official rules for this attempt/);
  assert.match(source, /won't reflect genuine exam-readiness/);
});
