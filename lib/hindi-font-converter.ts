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
  return output;
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
