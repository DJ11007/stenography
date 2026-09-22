import test from "node:test";
import assert from "node:assert/strict";
import {
  WORDTRIS_START_WPM,
  WORDTRIS_MIN_WPM,
  WORDTRIS_MAX_WPM,
  WORDTRIS_CATCH_SPEEDUP_FACTOR,
  WORDTRIS_MISS_SLOWDOWN_FACTOR,
  wordtrisSpeedUpOnCatch,
  wordtrisSlowDownOnMiss,
} from "../lib/wordtris-content.ts";

// Real requested feature: an adaptive speed curve for WordTris -- +3% per
// catch, -12% per miss, bounded by a configurable min/start/max, applied
// only to the NEXT drop (never mid-fall, since these are one-shot event
// handlers between drops, not per-frame logic -- see onCatch/onMiss in
// wordtris-game.tsx). These tests exercise the exact sequences requested:
// repeated catches ramping up, a miss easing off (not resetting), catches
// after a miss climbing back, and clamping at both ends.

test("the configured constants match the requested curve shape (start 15, floor 10, ceiling 30, +3%/-12%)", () => {
  assert.equal(WORDTRIS_START_WPM, 15);
  assert.equal(WORDTRIS_MIN_WPM, 10);
  assert.equal(WORDTRIS_MAX_WPM, 30);
  assert.equal(WORDTRIS_CATCH_SPEEDUP_FACTOR, 1.03);
  assert.equal(WORDTRIS_MISS_SLOWDOWN_FACTOR, 0.88);
});

test("repeated catches gradually speed up -- each step is roughly +3%, strictly increasing, never a sudden jump", () => {
  let wpm = WORDTRIS_START_WPM;
  const history = [wpm];
  for (let i = 0; i < 5; i += 1) {
    const next = wordtrisSpeedUpOnCatch(wpm);
    assert.ok(next > wpm, `catch ${i + 1} must increase speed`);
    const ratio = next / wpm;
    assert.ok(Math.abs(ratio - WORDTRIS_CATCH_SPEEDUP_FACTOR) < 1e-9, `catch ${i + 1} must be exactly the configured +3% factor, not a bigger jump`);
    wpm = next;
    history.push(wpm);
  }
  // Strictly increasing across the whole run -- no plateau, no jump.
  for (let i = 1; i < history.length; i += 1) assert.ok(history[i] > history[i - 1]);
});

test("a miss slows the NEXT word down by the configured percentage -- it does not reset to the starting speed", () => {
  // Simulate a student who has already sped up a few catches first.
  let wpm = WORDTRIS_START_WPM;
  for (let i = 0; i < 4; i += 1) wpm = wordtrisSpeedUpOnCatch(wpm);
  const beforeMiss = wpm;
  assert.ok(beforeMiss > WORDTRIS_START_WPM, "sanity check: speed climbed above the start before the miss");

  const afterMiss = wordtrisSlowDownOnMiss(beforeMiss);
  assert.ok(afterMiss < beforeMiss, "a miss must reduce speed");
  const ratio = afterMiss / beforeMiss;
  assert.ok(Math.abs(ratio - WORDTRIS_MISS_SLOWDOWN_FACTOR) < 1e-9, "must be exactly the configured -12% factor");
  assert.notEqual(afterMiss, WORDTRIS_START_WPM, "must not reset to the starting speed");
  assert.ok(afterMiss > WORDTRIS_MIN_WPM, "a single miss from an elevated speed must not floor out immediately");
});

test("catches after a miss gradually speed up again, climbing back from wherever the miss left the speed (not from the start)", () => {
  let wpm = WORDTRIS_START_WPM;
  for (let i = 0; i < 5; i += 1) wpm = wordtrisSpeedUpOnCatch(wpm);
  const afterMiss = wordtrisSlowDownOnMiss(wpm);

  let recovering = afterMiss;
  const recoveryHistory = [recovering];
  for (let i = 0; i < 4; i += 1) {
    recovering = wordtrisSpeedUpOnCatch(recovering);
    recoveryHistory.push(recovering);
  }
  for (let i = 1; i < recoveryHistory.length; i += 1) assert.ok(recoveryHistory[i] > recoveryHistory[i - 1], "each recovery catch must keep increasing speed");
  assert.ok(recovering > afterMiss, "recovery must climb above where the miss left it");
});

test("speed never exceeds the configured maximum, even after a very long catch streak", () => {
  let wpm = WORDTRIS_START_WPM;
  for (let i = 0; i < 200; i += 1) wpm = wordtrisSpeedUpOnCatch(wpm);
  assert.equal(wpm, WORDTRIS_MAX_WPM);
});

test("speed never drops below the configured minimum, even after many consecutive misses", () => {
  let wpm = WORDTRIS_START_WPM;
  for (let i = 0; i < 200; i += 1) wpm = wordtrisSlowDownOnMiss(wpm);
  assert.equal(wpm, WORDTRIS_MIN_WPM);
});

// The remaining requested sequences (the sixth miss ends the round; a new
// game starts at the original speed; a completed word is never counted as
// a miss; a missed word is never counted twice) are component-state
// behavior, not pure-function behavior -- verified here at the source
// level (matching this test file's own established convention) and live
// in the browser (played a full round through six misses and a restart).
test("startRound resets speed (state + ref), miss count (lives), the active drop, and typed input -- a new game starts at the original speed", async () => {
  const { readFile } = await import("node:fs/promises");
  const game = await readFile(new URL("../app/typing/games/wordtris/wordtris-game.tsx", import.meta.url), "utf8");
  assert.match(game, /setLives\(WORDTRIS_STARTING_LIVES\);/);
  assert.match(game, /wpmRef\.current = WORDTRIS_START_WPM;\s*\n\s*setWpm\(WORDTRIS_START_WPM\);/);
  assert.match(game, /activeDropRef\.current = null;\s*\n\s*setActiveDrop\(null\);/);
  assert.match(game, /setTyped\(""\);\s*\n\s*setSubmitted\(false\);/);
});

test("the sixth miss (lives reaching 0) ends the round, guarded so a miss can never be double-counted for the same drop", async () => {
  const { readFile } = await import("node:fs/promises");
  const game = await readFile(new URL("../app/typing/games/wordtris/wordtris-game.tsx", import.meta.url), "utf8");
  assert.match(game, /const missed = activeDropRef\.current;\s*\n\s*if \(!missed \|\| missed\.id !== dropId\) return;/); // can't double-count the same miss
  assert.match(game, /setLives\(\(l\) => \{\s*\n\s*const left = l - 1;\s*\n\s*if \(left <= 0\) setStep\("gameover"\);/);
});

// Real bug found live while verifying the adaptive curve: the speed state
// is now a continuously-compounding float (15 * 1.03^n), not always a
// clean integer the way the old milestone ladder produced -- the HUD
// briefly showed "Speed 15.450000000000001 WPM". Rounded for display
// only; the underlying wpm/wpmRef stay full precision so repeated
// +3%/-12% adjustments keep compounding accurately.
test("the HUD rounds the displayed speed (Math.round), while the underlying wpm/wpmRef stay full-precision floats for accurate compounding", async () => {
  const { readFile } = await import("node:fs/promises");
  const game = await readFile(new URL("../app/typing/games/wordtris/wordtris-game.tsx", import.meta.url), "utf8");
  assert.match(game, /<b className="text-lg text-slate-950">\{Math\.round\(wpm\)\} WPM<\/b>/);
});
