import { krutiDevToUnicode } from "./hindi-font-converter.ts";

export type TypingLanguage = "English" | "Hindi";
export type TypingScript = "Latin" | "Devanagari";
export type InputEncoding = "unicode" | "krutidev-legacy";

export type InputSystem = {
  id: string;
  label: string;
  language: TypingLanguage;
  script: TypingScript;
  inputEncoding: InputEncoding;
  fontLabel: string;
  fontStack: string;
  keyboardLayout: string;
  passageOverride?: string;
  requiredFontAsset?: string;
};

export type NormalizedTypingInput = {
  rawText: string;
  comparisonText: string;
  encodingMismatch: boolean;
};

export const KRUTI_DEV_FONT_ASSET = "/fonts/KrutiDev010.ttf";

export function segmentGraphemes(text: string) {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("hi", { granularity: "grapheme" });
    return [...segmenter.segment(text)].map((part) => part.segment);
  }
  return Array.from(text);
}

export function normalizeTypingInput(
  rawText: string,
  system: Pick<InputSystem, "inputEncoding" | "script">,
): NormalizedTypingInput {
  const lineNormalized = rawText.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
  if (system.inputEncoding === "krutidev-legacy") {
    // Kruti Dev's legacy bytes are still real Unicode codepoints (mostly
    // Latin-1 Supplement, e.g. \u00e7, \u00d9, \u00c5), and several of those have distinct
    // NFC/NFD forms that render identically but are NOT string-equal --
    // different OS/keyboard-driver installations of the Kruti Dev layout
    // can legitimately emit either form for the same keystroke. Without
    // normalizing, a student's genuinely correct word could be flagged
    // wrong here even though krutiDevToUnicode() (used to render results)
    // already normalizes and would show the exact same glyphs either way.
    // NFC never reorders or changes meaning -- it only collapses an
    // equivalent decomposed sequence into its single precomposed form.
    //
    // This stays in raw legacy form (not decoded to Unicode) because
    // comparisonText is also used to render the live on-screen passage
    // highlight and the "characters typed" counter through the Kruti Dev
    // *font* -- decoding it here would break that display. Scoring uses a
    // separate, decoded comparison (see getScoringText below), because
    // Kruti Dev also has genuine typist shortcuts (e.g. one key for what's
    // otherwise two separate keystrokes) that only krutiDevToUnicode()
    // reliably resolves to the same result either way.
    return {
      rawText,
      comparisonText: lineNormalized.normalize("NFC"),
      encodingMismatch: /\p{Script=Devanagari}/u.test(lineNormalized),
    };
  }

  const comparisonText = lineNormalized.normalize("NFC");
  const latinWords = comparisonText.match(/[A-Za-z]{3,}/g)?.length ?? 0;
  const devanagariCharacters = comparisonText.match(/\p{Script=Devanagari}/gu)?.length ?? 0;
  return {
    rawText,
    comparisonText,
    encodingMismatch:
      system.script === "Devanagari" &&
      latinWords > 0 &&
      devanagariCharacters === 0,
  };
}

export function getInputSystemPassage(system: InputSystem, presetPassage: string) {
  if (system.inputEncoding === "krutidev-legacy") {
    if (!system.passageOverride) {
      throw new Error("Kruti Dev input systems require a matching legacy-encoded passage.");
    }
    // Same reasoning as normalizeTypingInput above -- stays raw legacy
    // form, only NFC-normalized, because this is what's rendered on screen
    // through the Kruti Dev font.
    return system.passageOverride.normalize("NFC");
  }
  return presetPassage.normalize("NFC");
}

// The comparison text actually used to decide right/wrong. For Kruti Dev,
// this decodes through krutiDevToUnicode() -- the same conversion already
// used to render the results screen -- rather than comparing raw legacy
// bytes directly. Kruti Dev has genuine typist shortcuts where a single
// character stands in for what's otherwise two or more separate keystrokes
// (e.g. one key for "प्र" vs typing it as two ordinary keys), used purely
// for kerning; both spellings must score as equal, and only decoding both
// sides all the way through to Unicode reliably resolves every such case
// (a raw-byte alias table can't: some equivalences only exist because two
// *unrelated* keys happen to compose into the same result when typed
// together, not because any two spellings are registered as aliases of
// each other). This intentionally changes what "characters" means for a
// Kruti Dev test's final score (Devanagari graphemes, not raw legacy
// bytes) -- consistent with how every other Hindi input system already
// counts characters, just not with Kruti Dev's own live on-screen counter,
// which stays raw-byte based because it also positions the on-screen
// passage highlight (see comparisonText above).
export function getScoringText(text: string, system: Pick<InputSystem, "inputEncoding">) {
  return system.inputEncoding === "krutidev-legacy" ? krutiDevToUnicode(text) : text;
}
