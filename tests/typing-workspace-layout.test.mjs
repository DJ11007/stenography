import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../app/typing/_components/configurable-typing-exam.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../app/typing/_components/universal-typing-settings.tsx", import.meta.url), "utf8");

test("active workspace puts the toolbar in the top header, ahead of the original passage and typing area", () => {
  const controls = workspace.indexOf('aria-label="Typing controls"');
  const original = workspace.indexOf('id="original-passage-title"');
  const typing = workspace.indexOf('id="typing-passage-title"');
  assert.ok(controls >= 0 && controls < original && original < typing);
  assert.match(workspace, /grid-rows-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/);
  for (const label of ["Original Passage", "Type Here", "Submit", "Pause", "Settings"]) assert.ok(workspace.includes(label));
  assert.doesNotMatch(workspace, />Duration <strong>/);
  assert.match(workspace, /aria-label=\{`\$\{formatTime\(timeLeft\)\} remaining`\}/);
});

test("when a preset carries dictation audio, the workspace shows neither the passage nor an audio panel -- the dedicated dictation gate (a separate screen, before typing is unlocked) owns the audio player now, and the workspace itself never regains it", () => {
  assert.doesNotMatch(workspace, /function DictationAudioPanel/);
  assert.doesNotMatch(workspace, /const DICTATION_SPEEDS/);
  assert.match(workspace, /\{!preset\.audioUrl && !printoutMode && <section className="flex min-h-0 flex-col bg-white" aria-labelledby="original-passage-title">/);
  assert.match(workspace, /import \{ DictationGate \} from "\.\/dictation-gate"/);
});

test("the toolbar header also exposes a back button and a full screen toggle with a distinct exit state", () => {
  assert.match(workspace, /<BackButton dark label="Back" href=\{backHref\}\/>/);
  assert.match(workspace, /requestFullscreen/);
  assert.match(workspace, /exitFullscreen/);
  assert.match(workspace, /isFullscreen \? "Exit full screen" : "Enter full screen"/);
  assert.match(workspace, /fullscreenchange/);
});

test("workspace is viewport constrained with independently scrollable min-height-zero panels", () => {
  assert.match(workspace, /h-\[100dvh\] min-h-0 flex-col overflow-hidden/);
  assert.match(workspace, /min-h-0 w-full max-w-\[1800px\] flex-1 overflow-hidden/);
  assert.doesNotMatch(workspace, /min-h-\[40rem\]/);
  assert.match(workspace, /className="min-h-0 flex-1 p-4/);
  assert.match(workspace, /className="min-h-0 w-full flex-1 resize-none overflow-y-auto/);
});

test("original and typing panels use equal remaining-viewport grid tracks including their headings -- except for a dictation test or Printout Mode, either of which drops to a single full-height typing panel since there's no passage to show", () => {
  assert.match(workspace, /grid h-full min-h-0 overflow-hidden rounded-2xl border border-blue-300 bg-blue-100 shadow-xl \$\{preset\.audioUrl \|\| printoutMode \? "" : "grid-rows-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]"\}/);
  assert.equal(workspace.match(/minmax\(0,1fr\)/g)?.length, 2);
  assert.match(workspace, /<section className="flex min-h-0 flex-col bg-white" aria-labelledby="original-passage-title">/);
  assert.match(workspace, /<section className="flex min-h-0 flex-col border-t-2 border-blue-300 bg-white" aria-labelledby="typing-passage-title">/);
});

test("auto-scroll writes only the two panel scroll positions and never scrolls the page", () => {
  assert.match(workspace, /if \(!autoScroll \|\| paused\)/);
  assert.match(workspace, /original\.scrollTop = originalTarget/);
  assert.match(workspace, /typing\.scrollTop = typingTarget/);
  assert.doesNotMatch(workspace, /scrollIntoView|window\.scroll|document\.documentElement\.scroll|document\.body\.scroll/);
});

test("locked passage scrolling restores manual movement and cleans up every listener", () => {
  assert.match(workspace, /lockedPassageScrollTop\.current/);
  for (const event of ["scroll", "wheel", "touchmove", "keydown"]) {
    assert.match(workspace, new RegExp(`original\\.addEventListener\\("${event}"`));
    assert.match(workspace, new RegExp(`original\\.removeEventListener\\("${event}"`));
  }
  assert.match(workspace, /\[autoScroll, paused\]/);
});

test("pause stops movement and input while resume restores the active position", () => {
  assert.match(workspace, /if \(!started \|\| finished \|\| paused \|\| !endTimestamp\) return/);
  assert.match(workspace, /disabled=\{fontAvailable !== true \|\| paused\}/);
  assert.match(workspace, /setEndTimestamp\(Date\.now\(\) \+ timeLeft \* 1000\); setPaused\(false\)/);
  assert.match(workspace, /if \(!autoScroll \|\| paused\) \{ lastActiveLine\.current = null; return; \}/);
});

test("selected English, Hindi Unicode, and Kruti Dev fonts and language metadata remain active", () => {
  assert.equal(workspace.match(/fontFamily: inputSystem\.fontStack/g)?.length, 2);
  // 2 in the on-screen panels (original passage, typing textarea) + 1 in the
  // Print / PDF window's own lang attribute.
  assert.equal(workspace.match(/inputSystem\.language === "Hindi" \? "hi" : "en"/g)?.length, 3);
  assert.match(workspace, /normalizeTypingInput\(typedText, inputSystem\)/);
  assert.match(workspace, /getInputSystemPassage\(inputSystem, preset\.passage\)/);
});

test("shared English and Hindi exam timers wait for the first typing input", () => {
  assert.match(workspace, /setEndTimestamp\(null\); setTimerStarted\(false\)/);
  assert.match(workspace, /onFirstTypingInput=\{beginTiming\}/);
  assert.match(workspace, /if \(value !== typedText\) onFirstTypingInput\(\)/);
  assert.doesNotMatch(workspace, /Timer starts on your first keystroke/);
});

test("header toolbar contains only submit pause timer settings and full-screen controls", () => {
  const start = workspace.indexOf('aria-label="Typing controls"');
  const end = workspace.indexOf('</header>', start);
  const toolbar = workspace.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(toolbar, />Submit</);
  assert.match(toolbar, /\{paused \? "Resume" : "Pause"\}/);
  assert.match(toolbar, /role="timer"/);
  assert.match(toolbar, /aria-label=\{showSettings \? "Close Settings" : "Settings"\}/);
  for (const removed of ["preset.title", "Timer starts on your first keystroke", "Font-size controls", "A−", "A+", "Auto Scroll:", "Show Scrollbar"]) assert.ok(!toolbar.includes(removed));
});

test("font scrolling scoring and reset options remain in the floating settings popup", () => {
  for (const option of ["FontSizeControls", "Auto Scroll", "Show Scrollbar", "Highlight", "Backspace", "Word calculation", "Reset settings"]) assert.ok(settings.includes(option));
  assert.match(workspace, /showScrollbar=\{showScrollbar\}/);
  assert.match(workspace, /onScrollbarChange=\{setShowScrollbar\}/);
  assert.match(workspace, /onReset=\{resetSettings\}/);
  assert.match(workspace, /wordMethodLocked \? \{\} :/);
});
