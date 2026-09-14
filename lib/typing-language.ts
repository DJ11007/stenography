import { krutiDevToUnicode } from "./hindi-font-converter.ts";

// Real bug reported live: an admin-authored/pasted passage used a curly
// apostrophe (’ U+2019, "smart quotes") in a possessive like "India's" --
// no physical keyboard can type that exact codepoint, only a straight
// apostrophe ('  U+0027), so that single word was permanently unscoreable
// as correct for every student, forever, no matter how perfectly they
// typed it. Straightening both the passage and what the student typed to
// the same plain-ASCII equivalents before comparison fixes every existing
// passage immediately (no re-save needed) and any future one, for every
// caller of getInputSystemPassage/normalizeTypingInput below -- every
// hardcoded exam category, every admin-managed test in any mode, both
// client display and server-side authoritative re-scoring (recordManagedAttempt
// in app/tests/actions.ts) -- so this exact class of typographic-character
// mismatch is prevented by construction, not just patched for one passage.
// Also widened to em/en dashes and the ellipsis character -- the same
// "Word/Google Docs/AI-generated text produces it, no physical key types
// it" failure mode, just for different punctuation. Kruti Dev passages are
// untouched -- that's a legacy byte encoding where these codepoints don't
// carry the same meaning, and it already has its own, separate
// normalization path (see the krutidev-legacy branches below).
function straightenTypography(text: string) {
  return text
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...");
}

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

// Constructing Intl.Segmenter loads locale data and is genuinely expensive
// -- this used to happen on every call, and callers like editDistance() run
// it per word-pair inside O(passage-length x typed-length) alignment grids,
// so a single test submission could construct it hundreds of thousands of
// times (a 700-word batch test took 40+ seconds to grade because of this
// alone). The segmenter itself is stateless w.r.t. the text being
// segmented, so one shared instance is safe to reuse for every call.
const graphemeSegmenter = typeof Intl !== "undefined" && "Segmenter" in Intl
  ? new Intl.Segmenter("hi", { granularity: "grapheme" })
  : null;

// The same handful of words get segmented over and over -- editDistance()
// (used for half-error/minor-spelling comparisons) calls this once per word
// for EVERY cell of an alignment grid, so a 700-word test re-segments the
// same ~1,300 words hundreds of thousands of times. Caching by exact text is
// safe (segmentation is a pure function of the string) and doesn't change
// any result, only how often it's recomputed. Only short strings (single
// words) are cached -- full passages/typed text are segmented once anyway
// and aren't worth holding onto.
const graphemeCache = new Map<string, string[]>();
const GRAPHEME_CACHE_MAX_ENTRIES = 5000;
const GRAPHEME_CACHE_MAX_KEY_LENGTH = 64;

export function segmentGraphemes(text: string) {
  if (!graphemeSegmenter) return Array.from(text);
  if (text.length > GRAPHEME_CACHE_MAX_KEY_LENGTH) {
    return [...graphemeSegmenter.segment(text)].map((part) => part.segment);
  }
  const cached = graphemeCache.get(text);
  if (cached) return cached;
  const segments = [...graphemeSegmenter.segment(text)].map((part) => part.segment);
  if (graphemeCache.size >= GRAPHEME_CACHE_MAX_ENTRIES) graphemeCache.clear();
  graphemeCache.set(text, segments);
  return segments;
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

  const comparisonText = straightenTypography(lineNormalized.normalize("NFC"));
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
  return straightenTypography(presetPassage.normalize("NFC"));
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
