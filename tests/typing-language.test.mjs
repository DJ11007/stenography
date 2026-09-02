import test from "node:test";
import assert from "node:assert/strict";
import { calculateTypingScore } from "../lib/typing-test.ts";
import { HINDI_KRUTI_DEV, HINDI_UNICODE_INSCRIPT } from "../lib/typing-curriculum.ts";
import { getInputSystemPassage, getScoringText, normalizeTypingInput, segmentGraphemes } from "../lib/typing-language.ts";

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

// Real-world repro #2, confirmed live: a Kruti Dev admin passage spelled
// "प्राप्त" as "çkIr" (a single-key typist shortcut for "प्र") while a
// student typing on an ordinary keyboard produced "izkIr" (the same
// content as two separate keystrokes, "i"=प + "z"=्र). These are NOT
// registered as aliases of each other in the legacy dictionary -- "ç" only
// equals "iz" because "i" and "z" independently decode to "प" and "्र" and
// happen to concatenate into the same result. No raw-byte alias table can
// discover that; only a full decode through krutiDevToUnicode() can.
test("getScoringText resolves a Kruti Dev shortcut spelling and its literal multi-key equivalent to the same score-comparison text", () => {
  assert.equal(getScoringText("çkIr", HINDI_KRUTI_DEV), getScoringText("izkIr", HINDI_KRUTI_DEV));
  assert.equal(getScoringText("çkIr", HINDI_KRUTI_DEV), "प्राप्त");
  // Same passage's other reported word: प्रयास, spelled "ç;kl" in storage.
  assert.equal(getScoringText("ç;kl", HINDI_KRUTI_DEV), getScoringText("iz;kl", HINDI_KRUTI_DEV));
  assert.equal(getScoringText("ç;kl", HINDI_KRUTI_DEV), "प्रयास");
});

test("getScoringText still tells a genuinely different Kruti Dev word apart -- this is not a blanket everything-matches fix", () => {
  assert.notEqual(getScoringText("çkIr", HINDI_KRUTI_DEV), getScoringText("çkl", HINDI_KRUTI_DEV));
});

test("getScoringText passes non-Kruti-Dev text through unchanged", () => {
  assert.equal(getScoringText("hello world", HINDI_UNICODE_INSCRIPT), "hello world");
  assert.equal(getScoringText("भारत", HINDI_UNICODE_INSCRIPT), "भारत");
});

// Real bug reported live on an admin-managed exam test: the passage read
// "India’s admired scientist-president" (a curly "smart quote"
// apostrophe, ’ -- what pasting from Word/Docs or AI-generated text
// commonly produces), but no physical keyboard can type that exact
// codepoint; every keyboard's apostrophe key produces '. That one word
// was therefore permanently unscoreable as correct, no matter how
// perfectly a student typed it. Fixed by straightening both the resolved
// passage and the student's typed input to the same plain-ASCII quote
// characters before comparison -- this repairs every already-published
// passage immediately (no re-save needed), not just future ones.
test("getInputSystemPassage straightens curly quotes/apostrophes to their plain-ASCII keyboard equivalents", () => {
  assert.equal(getInputSystemPassage(HINDI_UNICODE_INSCRIPT, "India’s “great” journey"), "India's \"great\" journey");
});

test("normalizeTypingInput straightens curly quotes/apostrophes in what the student typed too, so a device's own autocorrect can't cause a false mismatch", () => {
  assert.equal(normalizeTypingInput("India’s “great” journey", HINDI_UNICODE_INSCRIPT).comparisonText, "India's \"great\" journey");
});

test("a passage with a curly apostrophe and a plainly-typed straight one now score as an exact match, end to end", () => {
  const passage = getInputSystemPassage(HINDI_UNICODE_INSCRIPT, "India’s admired scientist-president.");
  const typed = normalizeTypingInput("India's admired scientist-president.", HINDI_UNICODE_INSCRIPT).comparisonText;
  const score = calculateTypingScore({ typedText: typed, passage, elapsedSeconds: 60, wordMethod: "characters" });
  assert.equal(score.accuracy, 100);
  assert.equal(score.analysis.entries.every((entry) => entry.status === "correct"), true);
});
