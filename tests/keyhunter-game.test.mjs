import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { keyHunterWeakness, keyHunterPickNext, keyHunterRecord, KEYHUNTER_SESSION_LENGTH, KEYHUNTER_UNSEEN_WEIGHT } from "../lib/keyhunter-content.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("an unseen key is weighted as weak as KEYHUNTER_UNSEEN_WEIGHT -- new keys get introduced before an already-weak key is hammered further", () => {
  assert.equal(keyHunterWeakness(undefined), KEYHUNTER_UNSEEN_WEIGHT);
  assert.equal(keyHunterWeakness({ attempts: 0, correct: 0, totalMs: 0 }), KEYHUNTER_UNSEEN_WEIGHT);
});

test("a key with a worse error rate is weighted weaker than one that's merely slow", () => {
  const oftenWrong = keyHunterWeakness({ attempts: 10, correct: 2, totalMs: 2 * 300 }); // 80% error rate, fast when right
  const alwaysRightButSlow = keyHunterWeakness({ attempts: 10, correct: 10, totalMs: 10 * 1900 }); // 0% error rate, very slow
  assert.ok(oftenWrong > alwaysRightButSlow, "a mostly-wrong key must weigh more than a slow-but-always-right one");
  const perfect = keyHunterWeakness({ attempts: 10, correct: 10, totalMs: 10 * 200 }); // fast and always right
  assert.ok(alwaysRightButSlow > perfect, "a slow key still weighs more than a fast, accurate one");
});

test("keyHunterPickNext never repeats the excluded (just-shown) key when other candidates exist, and weighted picks favor weaker keys over many trials", () => {
  const pool = ["a", "b"];
  for (let i = 0; i < 20; i += 1) assert.equal(keyHunterPickNext(pool, {}, "a"), "b");

  // "a" is far weaker than "b" -- over many trials it should come up
  // noticeably more often (not asserting an exact ratio, just direction).
  const stats = { a: { attempts: 10, correct: 1, totalMs: 1 * 300 }, b: { attempts: 10, correct: 10, totalMs: 10 * 200 } };
  let aCount = 0;
  for (let i = 0; i < 500; i += 1) if (keyHunterPickNext(["a", "b"], stats) === "a") aCount += 1;
  assert.ok(aCount > 300, `expected "a" (the weak key) to be picked well over half the time, got ${aCount}/500`);
});

test("keyHunterRecord accumulates attempts/correct/totalMs per key without touching other keys", () => {
  let stats = {};
  stats = keyHunterRecord(stats, "a", true, 400);
  stats = keyHunterRecord(stats, "a", false, 999);
  stats = keyHunterRecord(stats, "b", true, 250);
  assert.deepEqual(stats.a, { attempts: 2, correct: 1, totalMs: 400 }); // the wrong attempt's time is NOT added
  assert.deepEqual(stats.b, { attempts: 1, correct: 1, totalMs: 250 });
});

// Real design intent (researched from Keybr): accuracy comes first -- a
// wrong press must be corrected before advancing, unlike Speed Race/Word
// Defender which let mistakes through.
test("Key Hunter requires a correct press to advance -- a wrong one flashes but doesn't move to the next key", async () => {
  const game = await read("app/typing/games/key-hunter/key-hunter-game.tsx");
  assert.match(game, /if \(correct\) \{/);
  assert.match(game, /setPromptIndex\(\(i\) => \{/);
  // the wrong-path branch must NOT touch promptIndex/currentKey
  const wrongBranch = game.slice(game.indexOf("} else {"), game.indexOf("} else {") + 200);
  assert.doesNotMatch(wrongBranch, /setPromptIndex|setCurrentKey/);
});

test("Key Hunter reuses the same GLYPH_KEYS pool WordTris's character mode uses, not a new hand-typed list", async () => {
  const game = await read("app/typing/games/key-hunter/key-hunter-game.tsx");
  assert.match(game, /GLYPH_KEYS as HINDI_GLYPH_KEYS \} from "@\/lib\/krutidev-tutor-content"/);
  assert.match(game, /GLYPH_KEYS as ENGLISH_GLYPH_KEYS \} from "@\/lib\/english-tutor-content"/);
});

test("a session is KEYHUNTER_SESSION_LENGTH keys long", async () => {
  assert.equal(KEYHUNTER_SESSION_LENGTH, 40);
  const game = await read("app/typing/games/key-hunter/key-hunter-game.tsx");
  assert.match(game, /if \(next >= KEYHUNTER_SESSION_LENGTH\) \{ setStep\("finished"\); return i; \}/);
});

test("Key Hunter has no server-gated action -- per-key stats are localStorage-only", async () => {
  const game = await read("app/typing/games/key-hunter/key-hunter-game.tsx");
  assert.doesNotMatch(game, /requireStudent/);
  assert.doesNotMatch(game, /"use server"/);
  assert.match(game, /localStorage\.setItem\(statsKey, JSON\.stringify\(updatedStats\)\);/);
});

// Real requested removal: the admin no longer wants the read-only
// "Preview: X" pages cluttering the admin dashboard (they test with a
// real student account instead), so every /admin/preview/* route was deleted.
test("Key Hunter is wired into the Typing Hub's games list, and its admin preview route is gone", async () => {
  const hub = await read("app/typing/games/page.tsx");
  assert.match(hub, /href: "\/typing\/games\/key-hunter"/);
  const admin = await read("app/admin/page.tsx");
  assert.doesNotMatch(admin, /admin\/preview\/key-hunter/);
});
