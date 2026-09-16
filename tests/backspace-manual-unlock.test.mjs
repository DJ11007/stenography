import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real requested feature: a student sometimes has a genuine reason to
// deviate from an official/managed test's locked Backspace rule (e.g.
// practicing a passage without the real exam's harsh "no correction at
// all" restriction). An explicit unlock (rendered as a lock/unlock symbol)
// lets them override it themselves "when necessary", defaulting to
// locked, only available before typing starts. Deliberately scoped to
// Backspace only -- Word calculation is excluded because
// recordManagedAttempt (app/tests/actions.ts) always rescores using the
// test's own real wordMethod server-side regardless of the client's local
// setting, so exposing it as unlockable would desync the live on-screen
// number from the actually-saved score.
test("manualUnlock state exists, is only offered before the timer starts, and forces backspaceMode from the student's own preference when set", async () => {
  const source = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(source, /const \[manualUnlock, setManualUnlock\] = useState\(false\);/);
  assert.match(source, /const backspaceLocked = rulesLocked && !manualUnlock;/);
  assert.match(source, /onManualUnlockChange=\{!timerStarted \? setManualUnlock : undefined\}/);
  const matches = [...source.matchAll(/if \(manualUnlock\) resolved\.backspaceMode = preferences\.backspaceMode;/g)];
  assert.equal(matches.length, 2, "expected the useEffect initializer and start() to both apply the manual unlock");
});

test("backspaceLocked (not the blanket rulesLocked) threads through ExamWorkspace to gate the Backspace control and the reset button", async () => {
  const source = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(source, /backspaceLocked: boolean; manualUnlock: boolean; onManualUnlockChange\?: \(value: boolean\) => void;/);
  assert.match(source, /rulesLocked, highlightLocked, backspaceLocked, manualUnlock, onManualUnlockChange, typedText,/);
  assert.match(source, /rulesLocked=\{rulesLocked\} highlightLocked=\{highlightLocked\} backspaceLocked=\{backspaceLocked\} manualUnlock=\{manualUnlock\} onManualUnlockChange=\{onManualUnlockChange\}/);
  assert.match(source, /update\(\{ \.\.\.\(highlightLocked \? \{\} : \{ highlightMode: DEFAULT_TYPING_SETTINGS\.highlightMode \}\), \.\.\.\(backspaceLocked \? \{\} : \{ backspaceMode: DEFAULT_TYPING_SETTINGS\.backspaceMode \}\), \.\.\.\(rulesLocked \? \{\} : \{ wordMethod: DEFAULT_TYPING_SETTINGS\.wordMethod \}\) \}\);/);
});

test("UniversalTypingSettings renders a lock/unlock symbol button that only appears when there's something locked to unlock, and Word calculation stays tied to the blanket rulesLocked", async () => {
  const source = await read("app/typing/_components/universal-typing-settings.tsx");
  assert.match(source, /backspaceLocked\?: boolean;/);
  assert.match(source, /manualUnlock\?: boolean;/);
  assert.match(source, /onManualUnlockChange\?: \(value: boolean\) => void;/);
  assert.match(source, /const backspaceIsLocked = backspaceLocked \?\? rulesLocked;/);
  assert.match(source, /label="Backspace" value=\{settings\.backspaceMode\} disabled=\{backspaceIsLocked\}/);
  assert.match(source, /label="Word calculation" value=\{settings\.wordMethod\} disabled=\{rulesLocked\}/);
  assert.match(source, /\{rulesLocked && onManualUnlockChange && <button/);
  assert.match(source, /\{manualUnlock \? "🔓" : "🔒"\}/);
  assert.match(source, /won't reflect genuine exam-readiness for that setting/);
});
