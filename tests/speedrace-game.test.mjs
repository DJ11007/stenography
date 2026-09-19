import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildSpeedRacePassage, speedRaceProgressAtElapsed, speedRaceNetWpm, speedRaceAccuracy, SPEEDRACE_WORDS_PER_RACE, SPEEDRACE_BOOSTS_PER_RACE } from "../lib/speedrace-content.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("buildSpeedRacePassage joins exactly SPEEDRACE_WORDS_PER_RACE words with single spaces, even from a small word pool", () => {
  const smallPool = ["cat", "dog", "sun"];
  const passage = buildSpeedRacePassage(smallPool);
  const parts = passage.split(" ");
  assert.equal(parts.length, SPEEDRACE_WORDS_PER_RACE);
  for (const word of parts) assert.ok(smallPool.includes(word));
  assert.equal(buildSpeedRacePassage([]), "");
});

// Real intent: the pace car and personal-best ghost must move in real
// time from the same standard WPM definition (1 word = 5 characters) the
// rest of the codebase already uses (see wordtrisFallMs).
test("speedRaceProgressAtElapsed reaches 1 exactly when elapsed time matches the standard WPM definition, and never exceeds 1", () => {
  const passageLength = 100; // 20 "words" at 5 chars each
  const wpm = 20;
  const totalMs = (passageLength / 5 / wpm) * 60000;
  assert.equal(speedRaceProgressAtElapsed(wpm, 0, passageLength), 0);
  assert.ok(Math.abs(speedRaceProgressAtElapsed(wpm, totalMs, passageLength) - 1) < 1e-9);
  assert.equal(speedRaceProgressAtElapsed(wpm, totalMs * 2, passageLength), 1); // clamped, never overshoots
  assert.equal(speedRaceProgressAtElapsed(wpm, 5000, 0), 0); // no passage yet -- no division by zero
});

test("speedRaceNetWpm only rewards correctly typed characters, and speedRaceAccuracy is a plain correct/typed percentage", () => {
  // 25 correct characters (5 "words") typed in exactly 1 minute = 5 WPM.
  assert.equal(Math.round(speedRaceNetWpm(25, 60000)), 5);
  assert.equal(speedRaceNetWpm(25, 0), 0); // no time elapsed -- no division by zero
  assert.equal(speedRaceAccuracy(18, 20), 90);
  assert.equal(speedRaceAccuracy(0, 0), 100); // nothing typed yet -- not a 0% score
});

test("the Speed Race game reuses WordTris's own admin-editable word banks as vocabulary, not a new hand-typed list", async () => {
  const page = await read("app/typing/games/speed-race/page.tsx");
  assert.match(page, /getWordtrisWords/);
  const game = await read("app/typing/games/speed-race/speed-race-game.tsx");
  assert.match(game, /from "@\/lib\/wordtris-content"/);
});

// Real design intent: unlike WordTris's isolated-word catch, a passage
// racer must let mistakes through (that's what accuracy measures) rather
// than rejecting invalid keystrokes outright.
test("Speed Race never rejects a keystroke -- mistakes are shown, not blocked, so accuracy is a real measurement", async () => {
  const game = await read("app/typing/games/speed-race/speed-race-game.tsx");
  assert.doesNotMatch(game, /isValidPrefix/);
  assert.match(game, /const clipped = value\.length > passage\.length \? value\.slice\(0, passage\.length\) : value;/);
});

test("one boost per race instantly completes the current word (Tab key or button), matching SPEEDRACE_BOOSTS_PER_RACE", async () => {
  assert.equal(SPEEDRACE_BOOSTS_PER_RACE, 1);
  const game = await read("app/typing/games/speed-race/speed-race-game.tsx");
  assert.match(game, /if \(boostsLeft <= 0 \|\| step !== "racing"\) return;/);
  assert.match(game, /if \(event\.key !== "Tab"\) return;/);
});

test("Speed Race's own solo score is localStorage-only, independent of the Live Classroom Race multiplayer feature", async () => {
  const game = await read("app/typing/games/speed-race/speed-race-game.tsx");
  assert.doesNotMatch(game, /"use server"/);
  assert.match(game, /localStorage\.setItem\(bestKey, String\(wpm\)\);/);
});

// Real reported bug, live-tested: getMyJoinedRoom (called unconditionally
// on mount to recover an in-progress joined room after a refresh) is
// gated by requireStudent() -- calling it from the admin-only preview
// session (which is an admin, not a real student) redirected the admin
// straight out of the page the instant the component mounted. The exact
// same bug class already fixed once for WordTris's own admin preview.
// previewMode skips the whole multiplayer recovery/join path.
test("previewMode skips the requireStudent()-gated multiplayer recovery effect and hides the join box, so the admin preview is never redirected out of Speed Race", async () => {
  const game = await read("app/typing/games/speed-race/speed-race-game.tsx");
  assert.match(game, /type Props = \{ words: Record<WordtrisLanguage, Record<WordtrisCategory, string\[\]>>; previewMode\?: boolean \};/);
  assert.match(game, /export function SpeedRaceGame\(\{ words, previewMode = false \}: Props\)/);
  assert.match(game, /useEffect\(\(\) => \{\s*\n\s*if \(previewMode\) return;\s*\n\s*\(async \(\) => \{\s*\n\s*const joined = await getMyJoinedRoom\(\);/);
  assert.match(game, /if \(previewMode\) return;\s*\n\s*const trimmed = joinCode\.trim\(\)\.toUpperCase\(\);/); // handleJoin
  assert.match(game, /\{!previewMode && \(\s*\n\s*<div className="mt-5 rounded-2xl border border-dashed border-amber-300/); // the join box itself
  const preview = await read("app/admin/preview/speed-race/page.tsx");
  assert.match(preview, /await requireAdmin\(\);/);
  assert.match(preview, /<SpeedRaceGame words=\{words\} previewMode \/>/);
});

test("Speed Race is wired into the Typing Hub's games list and the admin dashboard nav", async () => {
  const hub = await read("app/typing/games/page.tsx");
  assert.match(hub, /href: "\/typing\/games\/speed-race"/);
  const admin = await read("app/admin/page.tsx");
  assert.match(admin, /\/admin\/preview\/speed-race/);
});
