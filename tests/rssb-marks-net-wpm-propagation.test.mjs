import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported bug: RSMSSB (Rajasthan LDC/DEO) has no negative marking and
// no WPM pass threshold at all -- its real Net WPM is correctWords/time and
// its real qualification is correctWords x marksPerCorrectWord >=
// minimumPassingMarks (see calculateConfiguredRssbMarks). The student's own
// results screen was already fixed to show these real figures (see
// buildResultCalculations' marksMethod support), but recordManagedAttempt
// only ever stored the generic penalty-based netWpm, and every dashboard
// that reads a stored attempt row (the admin per-test leaderboard, a
// student's admin Track page, the student's own Results page, and the
// legacy no-detailed-record fallback on the attempt review page) compared
// that wrong number against the version's requiredWpm -- itself the
// full-marks pace (e.g. Hindi's 40 WPM), not the ~14.4-18 WPM needed to
// merely pass -- silently misjudging both the displayed speed and Pass/Fail
// for every Rajasthan LDC/DEO attempt on every one of those surfaces.

test("recordManagedAttempt stores RSSB's real, marks-based Net WPM/qualification alongside (never replacing) the generic penalty-based fields, for every other exam left untouched", async () => {
  const actions = await read("app/tests/actions.ts");
  assert.match(actions, /import \{ calculateConfiguredRssbMarks \} from "@\/lib\/typing-results";/);
  assert.match(actions, /const marksResult = preset\.marksMethod \? calculateConfiguredRssbMarks\(score, preset\.marksMethod\) : null;/);
  assert.match(actions, /const marksNetWpm = marksResult \? Math\.round\(score\.correctWords \/ Math\.max\(score\.elapsedSeconds \/ 60, 1 \/ 60\)\) : null;/);
  assert.match(actions, /marksNetWpm, marksQualified: marksResult \? marksResult\.qualified : null, marksObtained: marksResult \? marksResult\.marksObtained : null \};/);
  // never replaces the generic fields every other exam and every
  // already-recorded attempt still relies on
  assert.match(actions, /netWpm: score\.netWpm,/);
});

test("the admin per-test results leaderboard prefers the stored marksNetWpm/marksQualified over the generic netWpm/WPM-threshold check", async () => {
  const page = await read("app/admin/tests/[testId]/results/page.tsx");
  assert.match(page, /const netWpm = Number\(result\.marksNetWpm \?\? result\.netWpm \?\? 0\);/);
  assert.match(page, /const passed = result\.marksQualified != null \? result\.marksQualified : requiredWpm != null && requiredAccuracy != null \? netWpm >= requiredWpm && accuracy >= requiredAccuracy : null;/);
});

test("a student's admin Track page and their own Results page both prefer marksNetWpm for display, falling back to the generic netWpm for every non-RSSB attempt", async () => {
  const track = await read("app/admin/track/[id]/page.tsx");
  assert.match(track, /const netWpm = result\?\.marksNetWpm \?\? result\?\.netWpm;/);
  const studentResults = await read("app/student/results/page.tsx");
  assert.match(studentResults, /attempt\.result\?\.marksNetWpm \?\? attempt\.result\?\.netWpm \?\? 0/);
});

test("the admin attempt-review page's legacy (no saved typedText) fallback also prefers marksNetWpm", async () => {
  const page = await read("app/admin/students/attempts/[attemptId]/page.tsx");
  assert.match(page, /value=\{String\(result\.marksNetWpm \?\? result\.netWpm \?\? "—"\)\}/);
});
