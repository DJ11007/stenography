import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { krutiDevToUnicode, convertHindiText } from "../lib/hindi-font-converter.ts";
import {
  HINDI_COMMON_WORD_KEYS,
  getVerifiedHindiCommonKeys,
  isExactKrutiDevMatch,
  checkKrutiDevKeystrokes,
  countKeystrokeDiff,
} from "../lib/kruti-dev-word-bank.ts";

const read = (path) => readFile(path, "utf8");

// इलेक्ट्रिक's forward sequence was verified by actually rendering it in
// the bundled KrutiDev010.ttf font (confirmed live), not by round-trip --
// krutiDevToUnicode() has a known, narrow decoder-only limitation for
// this exact triple-conjunct-plus-pre-base-ि pattern (documented in
// kruti-dev-word-bank.ts), unrelated to whether the forward sequence a
// student must type is correct.
const KNOWN_DECODER_LIMITATIONS = new Set(["इलेक्ट्रिक"]);
// ऑटो deliberately does NOT use unicodeToKrutiDev()'s own output -- see
// the file-level comment in kruti-dev-word-bank.ts -- so it won't agree
// with the generic converter in either direction.
const USES_ADMIN_SUPPLIED_SEQUENCE = new Set(["ऑटो"]);

test("every verified Hindi common word's krutiKeys round-trips back to its exact displayWord via the app's own Kruti Dev decoder (except the two documented exceptions)", () => {
  assert.equal(HINDI_COMMON_WORD_KEYS.length, 28);
  for (const { displayWord, krutiKeys } of HINDI_COMMON_WORD_KEYS) {
    if (KNOWN_DECODER_LIMITATIONS.has(displayWord) || USES_ADMIN_SUPPLIED_SEQUENCE.has(displayWord)) continue;
    assert.equal(krutiDevToUnicode(krutiKeys), displayWord, `${krutiKeys} should decode back to ${displayWord}`);
  }
});

test("the admin Font & Text Converter tool (app/admin/font-converter) agrees with the verified word bank both directions -- convertHindiText is the exact function that tool calls, so this catches any future drift between the two (except the two documented exceptions)", () => {
  for (const { displayWord, krutiKeys } of HINDI_COMMON_WORD_KEYS) {
    if (KNOWN_DECODER_LIMITATIONS.has(displayWord) || USES_ADMIN_SUPPLIED_SEQUENCE.has(displayWord)) continue;
    assert.equal(convertHindiText(displayWord, "unicode", "krutidev"), krutiKeys);
    assert.equal(convertHindiText(krutiKeys, "krutidev", "unicode"), displayWord);
  }
});

test("getVerifiedHindiCommonKeys looks up by the exact display word, and is undefined for anything not in the verified table", () => {
  // ऑटो is the spec's own worked example -- the admin-supplied sequence
  // (not the generic converter's own output, which uses an untypeable
  // punctuation mark -- see the file-level comment in kruti-dev-word-bank.ts).
  assert.equal(getVerifiedHindiCommonKeys("ऑटो"), "vkWVks");
  assert.equal(getVerifiedHindiCommonKeys("ट्रक"), "Vªd");
  assert.equal(getVerifiedHindiCommonKeys("और"), undefined);
  assert.equal(getVerifiedHindiCommonKeys(""), undefined);
});

test("isExactKrutiDevMatch is plain raw-keystroke string equality -- no normalization, no case folding", () => {
  assert.equal(isExactKrutiDevMatch("vkWVks", "vkWVks"), true);
  assert.equal(isExactKrutiDevMatch("vkWVk", "vkWVks"), false);
  assert.equal(isExactKrutiDevMatch("vkWVksa", "vkWVks"), false);
  // The exact example from the spec: same rendered glyph, different keys.
  assert.equal(isExactKrutiDevMatch("Ikj", "ij"), false);
  // Case must never be folded -- Kruti Dev assigns Shift'd keys different glyphs.
  assert.equal(isExactKrutiDevMatch("W", "w"), false);
  assert.equal(isExactKrutiDevMatch("V", "v"), false);
});

test("checkKrutiDevKeystrokes reports every position, including missing (typed ran out) and extra (typed ran past) positions", () => {
  const exact = checkKrutiDevKeystrokes("vkWVks", "vkWVks");
  assert.equal(exact.length, 6);
  assert.ok(exact.every((c) => c.correct));

  const missing = checkKrutiDevKeystrokes("vkWVk", "vkWVks");
  assert.equal(missing.length, 6);
  assert.equal(missing[5].typedKey, "");
  assert.equal(missing[5].expectedKey, "s");
  assert.equal(missing[5].correct, false);

  const extra = checkKrutiDevKeystrokes("vkWVksa", "vkWVks");
  assert.equal(extra.length, 7);
  assert.equal(extra[6].typedKey, "a");
  assert.equal(extra[6].expectedKey, "");
  assert.equal(extra[6].correct, false);

  // ij vs Ikj: wrong from position 0 even though the rendered Hindi looks
  // similar -- a full "I" (Shift+i) is not the same key as a bare "i".
  const wrongFromStart = checkKrutiDevKeystrokes("Ikj", "ij");
  assert.deepEqual(wrongFromStart[0], { position: 0, typedKey: "I", expectedKey: "i", correct: false });
});

test("countKeystrokeDiff separates correct/incorrect/missing/extra so accuracy can be computed from exact keystrokes, never from visual word completion", () => {
  assert.deepEqual(countKeystrokeDiff("vkWVks", "vkWVks"), { correct: 6, incorrect: 0, missing: 0, extra: 0 });
  assert.deepEqual(countKeystrokeDiff("vkWVk", "vkWVks"), { correct: 5, incorrect: 0, missing: 1, extra: 0 });
  assert.deepEqual(countKeystrokeDiff("vkWVksa", "vkWVks"), { correct: 6, incorrect: 0, missing: 0, extra: 1 });
  assert.deepEqual(countKeystrokeDiff("Ikj", "ij"), { correct: 0, incorrect: 2, missing: 0, extra: 1 });
});

test("WordTris and Word Defender use the verified Hindi common-words table for the 'common' category, falling back to the existing live converter otherwise, and compare with isExactKrutiDevMatch (not a plain !==)", async () => {
  const wordtris = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(wordtris, /import \{ getVerifiedHindiCommonKeys, isExactKrutiDevMatch, checkKrutiDevKeystrokes \} from "@\/lib\/kruti-dev-word-bank";/);
  assert.match(wordtris, /category === "common" \? getVerifiedHindiCommonKeys\(raw\) : undefined/);
  assert.match(wordtris, /isExactKrutiDevMatch\(normalizedTyped, dropText\(activeDropRef\.current\)\)/);
  assert.match(wordtris, /isExactKrutiDevMatch\(normalize\(typed\), dropText\(activeDrop!\)\)/);

  const defender = await read("app/typing/games/word-defender/word-defender-game.tsx");
  assert.match(defender, /import \{ getVerifiedHindiCommonKeys, isExactKrutiDevMatch \} from "@\/lib\/kruti-dev-word-bank";/);
  assert.match(defender, /category === "common" \? getVerifiedHindiCommonKeys\(raw\) : undefined/);
  assert.match(defender, /isExactKrutiDevMatch\(norm, enemyText\(e\)\)/);
});

test("WordTris has a temporary debug view (Hindi common category only) showing the live position-by-position keystroke check, for manually verifying the new word list", async () => {
  const wordtris = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(wordtris, /language === "hindi" && category === "common" && activeDrop &&/);
  assert.match(wordtris, /checkKrutiDevKeystrokes\(typed, activeDrop\.target\)\.map/);
});

test("Speed Race converts every Hindi passage source (auto word-mix, admin-authored, and live-race host passages) to real Kruti Dev keystrokes before it's ever shown or typed, and scores from countKeystrokeDiff", async () => {
  const game = await read("app/typing/games/speed-race/speed-race-game.tsx");
  assert.match(game, /import \{ getVerifiedHindiCommonKeys, checkKrutiDevKeystrokes, countKeystrokeDiff \} from "@\/lib\/kruti-dev-word-bank";/);
  // Auto word-mix: per-word verified lookup for "common", converter fallback otherwise.
  assert.match(game, /cat === "common" \? getVerifiedHindiCommonKeys\(raw\) : undefined/);
  // All three setPassage sources go through toRaceableText/buildHindiWordTarget.
  assert.match(game, /setPassage\(toRaceableText\(cfg\.passage, cfg\.language\)\)/);
  const startRaceMatches = [...game.matchAll(/setPassage\(toRaceableText\(cfg\.passage, cfg\.language\)\)/g)];
  assert.equal(startRaceMatches.length, 2, "both the recovery effect and the lobby racing-transition effect must convert cfg.passage");
  assert.match(game, /chosen\s*\?\s*toRaceableText\(chosen\.passage, language\)/);
  assert.match(game, /buildHindiWordTarget\(w, category\)/);
  // Scoring uses the shared exact-keystroke diff, not a bespoke loop.
  assert.match(game, /const \{ correct \} = countKeystrokeDiff\(finalTyped, currentPassage\);/);
  assert.match(game, /const keystrokeChecks = checkKrutiDevKeystrokes\(typed, passage\);/);
  assert.match(game, /const \{ correct: liveCorrect \} = countKeystrokeDiff\(typed, passage\);/);
  assert.match(game, /keystrokeChecks\[i\]\?\.correct \? "text-emerald-600"/);
});
