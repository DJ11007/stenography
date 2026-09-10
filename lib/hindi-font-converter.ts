import convertLegacy from "@anthro-ai/krutidev-unicode";
import legacyMapping from "@anthro-ai/krutidev-unicode/dictionary/main.js";

export type HindiTextFormat = "unicode" | "krutidev";
export type ConvertedHindiText = Readonly<{ text: string; encoding: HindiTextFormat }>;

const DEVANAGARI = /[\u0900-\u097f]/u;
const DEVANAGARI_GLOBAL = /[\u0900-\u097f]/gu;
const LEGACY_SIGNAL = /(?:f['{kTtM<;]|O;fDr|vkSj|gS|\{kk|\.[k]|[dD][kZ]?)/;

const preferredLegacy = new Map<string, string>();
for (const [legacy, unicode] of legacyMapping) {
  if (!DEVANAGARI.test(unicode) || !legacy || unicode.includes("f")) continue;
  const current = preferredLegacy.get(unicode);
  if (!current || legacy.length < current.length) preferredLegacy.set(unicode, legacy);
}
preferredLegacy.set("ः", "%");
preferredLegacy.set(",", "]");
preferredLegacy.set("?", "\\");
preferredLegacy.set("-", "&");
const unicodeTokens = [...preferredLegacy].sort(([a], [b]) => b.length - a.length);

// The @anthro-ai dictionary optimises for the shortest byte sequence,
// which for a number of consonants and clusters is a single Latin-1
// "ligature" byte: Ò for भ, è for ध, ç for प्र, Ä for घ, Ã for ई, ª for
// the ट-cluster rakar, ® for ैं ... A student types Hindi on the Kruti
// Dev / Remington keyboard, where those forms are ordinary key sequences
// (Hk, /k, iz, ?k, bZ, z, Sa ...) -- the ligature bytes need Alt codes,
// and some (®) do not even have a glyph in the bundled KrutiDev010 font,
// so a passage stored with them both mis-renders and can never be matched
// by a correctly-typed answer. unicodeToKrutiDev folds every ligature to
// its keyboard sequence as its last step; each pair is verified to decode
// back to the same Unicode through krutiDevToUnicode.
const KEYBOARD_KEY_SEQUENCES: Array<[RegExp, string]> = [
  [/Ùk/g, "Rr"], [/Ò/g, "Hk"], [/è/g, "/k"], [/Ä/g, "?k"], [/Ã/g, "bZ"],
  [/ç/g, "iz"], [/æ/g, "nz"], [/Ø/g, "dz"], [/—/g, "d`"],
  [/ä/g, "Dr"], [/®/g, "Sa"], [/È/g, "ha"], [/ª/g, "z"],
  [/ê/g, "V~V"], [/î/g, "~;"],
];

// Retained name -- unicodeToKrutiDev now always produces keyboard-typeable
// output, so this is a straight alias for callers that asked for it by
// intent (the Kruti Dev learn simulator).
export function toTypeableKrutiDev(unicode: string) {
  return unicodeToKrutiDev(unicode);
}

// The dependency searches globally and then replaces the first matching text,
// so one word can accidentally mutate a later word in a long passage. Decode
// lexical tokens independently. Keep verified non-injective spellings explicit:
// round-tripping alone cannot distinguish their correct Unicode ordering.
const legacyDecodeOverrides = new Map<string, string>([
  ["f[kykM+f;kas", "खिलाड़ियों"],
]);
const legacyOverrideTokens = [...legacyDecodeOverrides].sort(([a], [b]) => b.length - a.length);

function decodeLegacyWord(rawWord: string) {
  let output = "";
  for (let index = 0; index < rawWord.length;) {
    const override = legacyOverrideTokens.find(([legacy]) => rawWord.startsWith(legacy, index));
    if (override) {
      output += override[1];
      index += override[0].length;
      continue;
    }
    let nextOverride = rawWord.length;
    for (const [legacy] of legacyOverrideTokens) {
      const candidate = rawWord.indexOf(legacy, index + 1);
      if (candidate >= 0 && candidate < nextOverride) nextOverride = candidate;
    }
    output += convertLegacy(rawWord.slice(index, nextOverride).replaceAll("%", "\uE000")).replaceAll("\uE000", "ः");
    index = nextOverride;
  }
  return repairStackedMatras(output);
}

// A Devanagari consonant carries at most one vowel sign (मात्रा). Legacy
// Kruti Dev passages that were hand-typed or machine-converted with a
// stray "aa" keystroke decode to an impossible stack of two vowel signs:
// "धीरे" typed as è + k + h decodes to धाीरे, "अनुसंधान" (/k + an extra k)
// to अनुसंधाान, "अधिकार" to अधिाकार, "अवधि" to अवधिा. The stray sign is
// always आ-matra (ा); drop it wherever it stacks on another vowel sign --
// wedged before one, doubled, or trailing one (optionally then anusvara /
// visarga). None of those is possible in correct Devanagari, so
// well-formed text is untouched and scoring a Kruti Dev test now treats
// such a stored passage and a cleanly typed answer as the same word.
function repairStackedMatras(word: string) {
  return word
    // "ा" wedged before another vowel sign (è+k+h -> धाी).
    .replace(/ा(?=[ि-ौ])/gu, "")
    // doubled "ा" (/k + extra k -> धाा).
    .replace(/ा{2,}/gu, "ा")
    // "ा" trailing another vowel sign, before a consonant (अधिाकार) or at a
    // word / clause boundary (अवधिा), optionally with anusvara/visarga on
    // it. Chandrabindu (ँ) is deliberately NOT a boundary here: it keeps a
    // real "...ि" + "याँ" (already mis-joined upstream for nukta letters)
    // from losing its "ाँ".
    .replace(/(?<=[ि-ौ])ा(?=[ंः]?(?:[क-हक़-य़\s।,;:!?)"'-]|$))/gu, "");
}

export function detectHindiTextFormat(text: string): HindiTextFormat | "empty" | "mixed" | "unknown" {
  if (!text.trim()) return "empty";
  const unicode = DEVANAGARI.test(text);
  const legacy = LEGACY_SIGNAL.test(text);
  if (unicode && legacy) return "mixed";
  if (unicode) return "unicode";
  if (legacy) return "krutidev";
  return "unknown";
}

export function normalizeUnicodeHindi(text: string) {
  return text.replace(/\r\n?/g, "\n").normalize("NFC");
}

export function krutiDevToUnicode(text: string) {
  if (!text) return "";
  return text
    .replace(/\r\n?/g, "\n")
    .split(/(\s+)/u)
    .map((token) => (/^\s+$/u.test(token) ? token : decodeLegacyWord(token)))
    .join("")
    .normalize("NFC");
}

export function unicodeToKrutiDev(text: string) {
  let working = normalizeUnicodeHindi(text);
  // Kruti Dev stores reph after the complete orthographic syllable.
  working = working.replace(/र्([क-हक़-य़](?:्[क-हक़-य़])*(?:[ािीुूृॄेैोौॅॉंःँ]*)?)/gu, "$1Z");
  // Its pre-base i-matra marker is stored before the consonant cluster.
  working = working.replace(/([क-हक़-य़](?:्[क-हक़-य़])*)ि/gu, "ि$1");
  let output = "";
  for (let index = 0; index < working.length;) {
    if (working[index] === "ि") { output += "f"; index += 1; continue; }
    let matched = false;
    for (const [unicode, legacy] of unicodeTokens) {
      if (working.startsWith(unicode, index)) { output += legacy; index += unicode.length; matched = true; break; }
    }
    if (!matched) {
      const char = working[index];
      if (DEVANAGARI.test(char)) throw new Error(`This Devanagari sign is not supported by Kruti Dev 010: ${char}`);
      output += char; index += 1;
    }
  }
  for (const [ligature, keys] of KEYBOARD_KEY_SEQUENCES) output = output.replace(ligature, keys);
  return output;
}

export function convertHindiText(text: string, source: HindiTextFormat, output: HindiTextFormat) {
  if (source === output) return source === "unicode" ? normalizeUnicodeHindi(text) : text.replace(/\r\n?/g, "\n");
  return source === "unicode" ? unicodeToKrutiDev(text) : krutiDevToUnicode(text);
}

export function convertHindiTextWithMarker(text: string, source: HindiTextFormat, output: HindiTextFormat): ConvertedHindiText {
  return Object.freeze({ text: convertHindiText(text,source,output), encoding: output });
}

export function encodingValidationMessage(text: string, expected: HindiTextFormat) {
  const detected = detectHindiTextFormat(text);
  if (detected === "empty" || detected === "unknown") return null;
  if (expected === "krutidev" && (detected === "unicode" || detected === "mixed")) return "Convert to Kruti Dev before saving.";
  if (expected === "unicode" && (detected === "krutidev" || detected === "mixed")) return "Convert to Unicode before saving.";
  return null;
}

export function countHindiText(text: string) {
  return { characters: [...text].length, words: text.trim() ? text.trim().split(/\s+/u).length : 0, devanagariCharacters: text.match(DEVANAGARI_GLOBAL)?.length ?? 0 };
}
