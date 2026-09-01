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
    // Same reasoning as normalizeTypingInput above -- keep the reference
    // side on the same canonical NFC form as the comparison side, so an
    // already-NFC passage (the normal case) is untouched but a passage
    // that somehow entered storage NFD-decomposed still compares correctly.
    return system.passageOverride.normalize("NFC");
  }
  return presetPassage.normalize("NFC");
}
