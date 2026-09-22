import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Regression guard for a real requested removal: the "Official Preset /
// Custom Simulation" choice was removed from every exam category (not
// just one), both the pre-start toggle and the always-visible workspace
// toolbar badge that showed it for every mode (exam and practice).
// attemptVariant itself is untouched internally -- it still drives whether
// rules/duration/settings are locked to the preset -- students simply no
// longer see or choose it.
test("the exam pre-start screen no longer offers a Simulation rules / Custom Simulation toggle", async () => {
  const workspace = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.doesNotMatch(workspace, /Simulation rules/);
  assert.doesNotMatch(workspace, /aria-pressed=\{attemptVariant === "custom"\}/);
  assert.doesNotMatch(workspace, /onAttemptVariantChange/);
  assert.doesNotMatch(workspace, />Custom Simulation<\/button>/);
});

test("the workspace toolbar no longer shows an Official Preset / Custom Simulation badge, for any mode", async () => {
  const workspace = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.doesNotMatch(workspace, /attemptVariant === "official" \? "Official Preset" : "Custom Simulation"/);
  assert.doesNotMatch(workspace, /bg-amber-100 text-amber-950.*Official Preset/);
});

test("attemptVariant still exists and still governs rule-locking internally -- only the visible toggle/badge were removed, not the underlying behavior", async () => {
  const workspace = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(workspace, /const \[attemptVariant\] = useState<AttemptVariant>\(mode === "practice" \|\| customPreset \? "custom" : "official"\);/);
  assert.match(workspace, /const durationLocked = \(\(attemptVariant === "official"/);
  // rulesLocked is now hoisted into its own named const (reused by the new
  // passage-word-count feature's lock computation too) instead of being
  // computed inline at the ExamWorkspace call site -- same expression, same
  // behavior, just no longer duplicated.
  assert.match(workspace, /const rulesLocked = attemptVariant === "official" \|\| managedRulesLocked \|\| \(customPreset && !managedTest\);/);
  assert.match(workspace, /rulesLocked=\{rulesLocked\}/);
});
