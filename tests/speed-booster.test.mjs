import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BURST_LEVELS, COMMON_EXAM_WORDS, RHYTHM_PASSAGES, WEAK_KEY_WORD_BANK, commonWordsDrill, keyStatsFrom, levelPassed, mergeKeyStats,
  practiceStreak, repeatWordsDrill, rhythmScore, scoreTyping, weakKeyDrill, weakestKeys, weeklyProgress,
} from "../lib/speed-booster.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Speed Booster (owner's request, 23 Nov 2026): the "stuck at 35-40 WPM, how to reach 50+" advice as practice tools.

test("five burst levels of 8 sentences, ASCII only; level 2 sentences use every letter", () => {
  assert.equal(BURST_LEVELS.length, 5);
  for (const level of BURST_LEVELS) {
    assert.equal(level.sentences.length, 8);
    for (const sentence of level.sentences) assert.match(sentence, /^[\x20-\x7e]+$/);
  }
  for (const sentence of BURST_LEVELS[1].sentences) {
    const letters = new Set(sentence.toLowerCase().replace(/[^a-z]/g, ""));
    assert.equal(letters.size, 26, sentence);
  }
});

test("word banks cover every letter and the common list has no repeats", () => {
  const letters = new Set(WEAK_KEY_WORD_BANK.join("").replace(/[^a-z]/g, ""));
  assert.equal(letters.size, 26);
  assert.equal(new Set(COMMON_EXAM_WORDS).size, COMMON_EXAM_WORDS.length);
  assert.ok(COMMON_EXAM_WORDS.length >= 100);
  assert.ok(RHYTHM_PASSAGES.every((passage) => /^[\x20-\x7e]+$/.test(passage)));
});

test("scoreTyping counts wrong words and speed by 5 characters per word", () => {
  const target = "the cat sat on the mat";
  const perfect = scoreTyping(target, "the cat sat on the mat", 60000);
  assert.equal(perfect.mistakes, 0);
  assert.equal(perfect.accuracy, 100);
  assert.equal(perfect.grossWpm, Math.round(23 / 5)); // 17 letters + 6 spaces
  const wrong = scoreTyping(target, "the cta sat on teh mat", 60000);
  assert.equal(wrong.mistakes, 2);
  assert.ok(wrong.netWpm < wrong.grossWpm);
});

test("key stats: the first wrong letter of a wrong word is a miss; weakest keys need enough presses", () => {
  const stats = keyStatsFrom("box box box box box", "box bix box bix box");
  assert.equal(stats.o.misses, 2);
  assert.equal(stats.b.misses, 0);
  assert.equal(weakestKeys(stats, 3, 5)[0].key, "o");
  const merged = mergeKeyStats(stats, { o: { hits: 1, misses: 0 } });
  assert.equal(merged.o.hits, stats.o.hits + 1);
});

test("drills: weak-key words contain a chosen letter; repeats; common words", () => {
  const drill = weakKeyDrill(["q"], 20, () => 0.5).split(" ");
  assert.equal(drill.length, 20);
  assert.ok(drill.every((word) => word.includes("q")));
  assert.equal(repeatWordsDrill(["which", "the"], 2), "which which the the");
  assert.ok(commonWordsDrill(30).split(" ").every((word) => COMMON_EXAM_WORDS.includes(word)));
});

test("rhythm score: an even beat scores 100, an uneven one lower", () => {
  assert.equal(rhythmScore([500, 500, 500, 500]), 100);
  assert.ok(rhythmScore([200, 900, 300, 1200]) < 50);
});

test("weekly progress groups by Monday-start weeks; streak counts back from today", () => {
  const sessions = [
    { date: "2026-11-23", kind: "burst", wpm: 50, accuracy: 100 },
    { date: "2026-11-22", kind: "burst", wpm: 40, accuracy: 100 },
    { date: "2026-11-21", kind: "words", wpm: 44, accuracy: 98 },
  ];
  const weeks = weeklyProgress(sessions);
  assert.equal(weeks[0].weekStart, "2026-11-23");
  assert.equal(weeks[1].weekStart, "2026-11-16");
  assert.equal(weeks[1].averageWpm, 42);
  assert.equal(practiceStreak(sessions, "2026-11-23"), 3);
  assert.equal(practiceStreak(sessions, "2026-11-25"), 0);
});

test("a level is passed only when every sentence reached the target with no mistakes", () => {
  const level = BURST_LEVELS[0];
  const all = Object.fromEntries(level.sentences.map((sentence) => [sentence, 56]));
  assert.equal(levelPassed(level, all), true);
  assert.equal(levelPassed(level, { ...all, [level.sentences[0]]: 50 }), false);
});

test("the page has the five tabs and the hub links to it", async () => {
  const page = await read("app/typing/speed-booster/speed-booster.tsx");
  for (const label of ["Plan & Tips", "Burst Training", "Common Words", "Weak Keys", "Rhythm & Read-ahead"]) assert.ok(page.includes(label), label);
  const hub = await read("app/typing/page.tsx");
  assert.match(hub, /href: "\/typing\/speed-booster"/);
});

// 24 Nov 2026: the Hindi side.
import { HINDI_BURST_LEVELS, HINDI_COMMON_WORDS, HINDI_DRILL_WORDS, HINDI_FEATURES, HINDI_RHYTHM_PASSAGES, featureStatsFrom, hindiFeatureDrill, weakestFeatures } from "../lib/speed-booster-hindi.ts";
import { krutiDevToUnicode, unicodeToKrutiDev } from "../lib/hindi-font-converter.ts";

test("every Hindi line survives Unicode -> Kruti Dev -> Unicode with the same words (Kruti Dev typists are checked right)", () => {
  const all = [...HINDI_BURST_LEVELS.flatMap((level) => level.sentences), ...HINDI_COMMON_WORDS, ...HINDI_DRILL_WORDS, ...HINDI_RHYTHM_PASSAGES];
  const count = (text) => text.trim().split(/\s+/u).length;
  for (const text of all) {
    const kruti = unicodeToKrutiDev(text);
    assert.equal(krutiDevToUnicode(kruti).normalize("NFC"), text.normalize("NFC"), text);
    assert.equal(count(kruti), count(text), text);
  }
});

test("five Hindi burst levels of 8; no % (it is the visarga key in Kruti Dev); every weak-area group has drill words", () => {
  assert.equal(HINDI_BURST_LEVELS.length, 5);
  for (const level of HINDI_BURST_LEVELS) assert.equal(level.sentences.length, 8);
  assert.ok(!HINDI_BURST_LEVELS.flatMap((level) => level.sentences).some((sentence) => sentence.includes("%")));
  for (const feature of HINDI_FEATURES) assert.ok(HINDI_DRILL_WORDS.filter((word) => feature.pattern.test(word.normalize("NFC"))).length >= 10, feature.id);
  assert.equal(new Set(HINDI_COMMON_WORDS).size, HINDI_COMMON_WORDS.length);
});

test("Hindi weak areas: a wrong word counts against every group it belongs to", () => {
  const stats = featureStatsFrom("किसान क्षेत्र किसान क्षेत्र", "कसान क्षेत्र कसान क्षेत्र");
  assert.equal(stats["i-matra"].misses, 2);
  assert.equal(stats.conjunct.hits, 2);
  assert.equal(weakestFeatures(stats, 1, 2)[0].id, "i-matra");
  assert.ok(hindiFeatureDrill(["conjunct"], 15, () => 0.3).split(" ").every((word) => /क्ष|त्र|ज्ञ|श्र|द्ध|द्व|द्य/u.test(word)));
});

test("the page offers English / Hindi and Unicode / Kruti Dev, and checks Kruti Dev by decoding", async () => {
  const page = await read("app/typing/speed-booster/speed-booster.tsx");
  assert.match(page, /हिन्दी \(Hindi\)/);
  assert.match(page, /"Kruti Dev 010"/);
  assert.match(page, /decode: input === "kruti" \? \(text\) => krutiDevToUnicode\(text\)\.normalize\("NFC"\)/);
  assert.match(page, /function HindiWeakTab/);
});
