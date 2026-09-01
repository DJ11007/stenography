import test from "node:test";
import assert from "node:assert/strict";
import { calculateTypingScore } from "../lib/typing-test.ts";
import { HINDI_KRUTI_DEV, HINDI_UNICODE_INSCRIPT } from "../lib/typing-curriculum.ts";
import { getInputSystemPassage, normalizeTypingInput, segmentGraphemes } from "../lib/typing-language.ts";

test("segments Hindi matras and conjuncts as grapheme clusters", () => {
  assert.equal(segmentGraphemes("कि").length, 1);
  assert.equal(segmentGraphemes("क्ष").length, 1);
  const score = calculateTypingScore({ typedText: "कक्षा", passage: "कक्षा", elapsedSeconds: 60, wordMethod: "characters" });
  assert.equal(score.totalCharacters, segmentGraphemes("कक्षा").length);
  assert.equal(score.accuracy, 100);
});

test("normalizes canonical Unicode Hindi while retaining raw input", () => {
  const rawText = "क\u093c";
  const normalized = normalizeTypingInput(rawText, HINDI_UNICODE_INSCRIPT);
  assert.equal(normalized.rawText, rawText);
  assert.equal(normalized.comparisonText, rawText.normalize("NFC"));
  assert.equal(normalized.encodingMismatch, false);
});

test("preserves Kruti Dev legacy input and uses its matching legacy passage", () => {
  const rawText = "f'k{kk\r\nO;fDr";
  const normalized = normalizeTypingInput(rawText, HINDI_KRUTI_DEV);
  assert.equal(normalized.rawText, rawText);
  assert.equal(normalized.comparisonText, "f'k{kk\nO;fDr");
  assert.equal(getInputSystemPassage(HINDI_KRUTI_DEV, "Unicode ignored"), HINDI_KRUTI_DEV.passageOverride);
});

test("detects mismatched Hindi encodings", () => {
  assert.equal(normalizeTypingInput("शिक्षा", HINDI_KRUTI_DEV).encodingMismatch, true);
  assert.equal(normalizeTypingInput("f'k{kk O;fDr", HINDI_UNICODE_INSCRIPT).encodingMismatch, true);
});

// Real-world repro: a live Kruti Dev practice test's passage contains the
// word "çkIr" (renders as प्राप्त). Different Kruti Dev keyboard-driver
// installations can legitimately emit ç either precomposed (NFC, one
// codepoint) or decomposed (NFD, "c" + a combining cedilla) for the exact
// same keystroke -- both look identical once rendered in the Kruti Dev
// font, and krutiDevToUnicode() (used to draw the results screen) already
// normalizes before converting, so a student would see the same "प्राप्त"
// on both sides of a diff yet have it marked wrong. This is the bug
// reported live: a correct word shown flagged next to its own bracketed
// "correct" form, both visually identical.
test("Kruti Dev comparison text is NFC-normalized, so an NFD-decomposed keystroke sequence still matches its NFC-precomposed reference", () => {
  const nfc = "çkIr";
  const nfd = nfc.normalize("NFD");
  assert.notEqual(nfd, nfc); // sanity: these really are different code-point sequences
  assert.equal(normalizeTypingInput(nfd, HINDI_KRUTI_DEV).comparisonText, nfc);
  assert.equal(normalizeTypingInput(nfc, HINDI_KRUTI_DEV).comparisonText, nfc);
});

test("getInputSystemPassage NFC-normalizes a Kruti Dev passageOverride too, so an NFD-decomposed reference passage still compares consistently", () => {
  const decomposedSystem = { ...HINDI_KRUTI_DEV, passageOverride: "çkIr".normalize("NFD") };
  assert.equal(getInputSystemPassage(decomposedSystem, "ignored"), "çkIr");
});
