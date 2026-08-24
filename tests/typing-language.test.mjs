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
