import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { worddefenderFallMs, worddefenderSpawnMs, WORDDEFENDER_STARTING_HEALTH, WORDDEFENDER_LANES, WORDDEFENDER_KILLS_PER_WAVE, WORDDEFENDER_STARTING_WPM, WORDDEFENDER_WAVE_WPM_STEP } from "../lib/worddefender-content.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("worddefenderFallMs speeds up with each wave, floored so it never becomes unfair", () => {
  const wave1 = worddefenderFallMs("cat", 1);
  const wave5 = worddefenderFallMs("cat", 5);
  assert.ok(wave5 < wave1, "later waves must fall faster than wave 1");
  assert.ok(worddefenderFallMs("cat", 1000) >= 1400); // floored at WORDDEFENDER_MIN_FALL_MS regardless of how high the wave climbs
});

test("worddefenderSpawnMs shortens each wave, floored at 500ms", () => {
  assert.ok(worddefenderSpawnMs(5) < worddefenderSpawnMs(1));
  assert.equal(worddefenderSpawnMs(1000), 500);
});

test("the wave-scaling constants exist and are sane", () => {
  assert.equal(WORDDEFENDER_STARTING_HEALTH, 5);
  assert.equal(WORDDEFENDER_LANES, 4);
  assert.equal(WORDDEFENDER_KILLS_PER_WAVE, 6);
  assert.equal(WORDDEFENDER_STARTING_WPM, 18);
  assert.equal(WORDDEFENDER_WAVE_WPM_STEP, 3);
});

// Real design intent (researched from ZType/Typing Attack): a shooter
// fires the instant a word is finished, unlike WordTris's deliberate
// Space-confirm -- confirm the game never waits for a submit keystroke.
test("Word Defender destroys an enemy the instant its word is fully typed -- no space-confirm, unlike WordTris", async () => {
  const game = await read("app/typing/games/word-defender/word-defender-game.tsx");
  assert.doesNotMatch(game, /handleTypedKeyDown/);
  assert.doesNotMatch(game, /key !== " "/);
  assert.match(game, /const killed = enemiesRef\.current\.find\(\(e\) => enemyText\(e\) === norm\);/);
  assert.match(game, /if \(killed\) onKill\(killed\);/);
});

// Real design intent (researched from ZType's auto-target-lock): once
// typed letters match one or more falling enemies, a stray keystroke that
// only belongs to a different one must not register -- the same
// prefix-lock discipline WordTris uses, just across several concurrent
// enemies instead of one.
test("a stray keystroke that doesn't continue any currently falling enemy's word is rejected", async () => {
  const game = await read("app/typing/games/word-defender/word-defender-game.tsx");
  assert.match(game, /if \(!isShrinking && norm && !enemiesRef\.current\.some\(\(e\) => enemyText\(e\)\.startsWith\(norm\)\)\) return;/);
});

// Real reported request precedent (WordTris): multiple enemies falling at
// once, each in its own lane, up to a fixed cap -- unlike WordTris's later
// single-lane redesign, a wave-based shooter genuinely needs concurrency.
test("up to WORDDEFENDER_LANES enemies fall at once, each in its own free lane", async () => {
  const game = await read("app/typing/games/word-defender/word-defender-game.tsx");
  assert.match(game, /const LANE_POSITIONS = Array\.from\(\{ length: WORDDEFENDER_LANES \}/);
  assert.match(game, /if \(enemiesRef\.current\.length >= WORDDEFENDER_LANES\) return;/);
  assert.match(game, /const freeLanes = Array\.from\(\{ length: WORDDEFENDER_LANES \}, \(_, i\) => i\)\.filter\(\(i\) => !used\.has\(i\)\);/);
});

test("Word Defender reuses WordTris's own admin-editable word banks as vocabulary, not a new hand-typed list", async () => {
  const page = await read("app/typing/games/word-defender/page.tsx");
  assert.match(page, /getWordtrisWords/);
});

test("Word Defender has no server-gated score action to redirect an admin preview out of the game -- personal best is localStorage-only", async () => {
  const game = await read("app/typing/games/word-defender/word-defender-game.tsx");
  assert.doesNotMatch(game, /requireStudent/);
  assert.doesNotMatch(game, /"use server"/);
  assert.match(game, /localStorage\.setItem\(bestKey, String\(scoreRef\.current\)\);/);
  const preview = await read("app/admin/preview/word-defender/page.tsx");
  assert.match(preview, /await requireAdmin\(\);/);
});

test("Word Defender is wired into the Typing Hub's games list and the admin dashboard nav", async () => {
  const hub = await read("app/typing/games/page.tsx");
  assert.match(hub, /href: "\/typing\/games\/word-defender"/);
  const admin = await read("app/admin/page.tsx");
  assert.match(admin, /\/admin\/preview\/word-defender/);
});
