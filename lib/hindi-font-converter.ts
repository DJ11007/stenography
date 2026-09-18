import convertLegacy from "@anthro-ai/krutidev-unicode";
import legacyMapping from "@anthro-ai/krutidev-unicode/dictionary/main.js";

export type HindiTextFormat = "unicode" | "krutidev";
export type ConvertedHindiText = Readonly<{ text: string; encoding: HindiTextFormat }>;

const DEVANAGARI = /[\u0900-\u097f]/u;
const DEVANAGARI_GLOBAL = /[\u0900-\u097f]/gu;
// The trailing `?` on [dD][kZ]? was a bug: it made the second character
// optional, so this matched on a bare "d"/"D" alone -- degenerately common
// in ordinary English/transliterated text (e.g. any title containing the
// word "Hindi" itself), unlike every other alternative here, which all
// require a specific multi-character Kruti Dev garbage sequence. Real
// legacy-encoded text pairs "d"/"D" with "k" or "Z" (Devanagari half-forms
// rendered from those byte combinations); a lone "d" proves nothing.
export const LEGACY_SIGNAL = /(?:f['{kTtM<;]|O;fDr|vkSj|gS|\{kk|\.[k]|[dD][kZ])/;

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
// Found via a systematic audit of every key on the Kruti Dev 010 keyboard
// (checked at the user's request): a literal ".", ";", or "/" in a Hindi
// passage was previously passed straight through unconverted (the loop
// above only overrides characters whose DECODED meaning is Devanagari --
// plain ASCII punctuation was assumed to need no help). But in this font
// those exact raw bytes already draw Devanagari half-forms -- "." is ण्,
// ";" is य, "/" is ध् -- so a passage containing "डॉ." or "आई.ए.एस." or
// "एक; दो" or "पर/खिलाफ" would encode to legacy bytes that decode back to
// gibberish (डॅण्, आईण्एण्एसण्, एकय दो, परध्खिलाफ), not the original text
// -- confirmed by round-tripping through krutiDevToUnicode. Each of these
// three has a genuinely safe target: the ordinary "-", "(", and "@" keys
// decode to exactly "." / ";" / "/" and nothing else, so claiming them
// here doesn't touch any existing mapping, and all three are already
// typeable on the plain keyboard with no Alt-code needed. Other collided
// punctuation (":", '"', "&", "%", "@", parentheses, ...) has no such safe
// keyboard byte in this dictionary at all -- a real limitation of Kruti
// Dev 010 itself, not something a byte substitution here can fix.
preferredLegacy.set(".", "-");
preferredLegacy.set(";", "(");
preferredLegacy.set("/", "@");
// Real reported bug: an admin's pasted passage (from Word/Docs, which
// auto-corrects "--" into a real en dash) used "–" for date ranges and
// word-joining ("1894–95", "चीन–जापान") -- but in this font the raw "–"
// byte already draws दृ (द + the vocalic-R vowel sign), so it rendered as
// "1894दृ95"/"चीनदृजापान" instead of a dash, confirmed by round-tripping
// through krutiDevToUnicode exactly as for the "." ";" "/" collisions
// above. No legacy byte in this dictionary decodes back to a literal en
// dash at all (unlike those three), so there's no way to preserve it as
// its own character -- the safe fix is the same one already used for a
// plain "-": a Kruti Dev keyboard has no dedicated en-dash key anyway, so
// a student typing this passage would type an ordinary hyphen for it
// regardless of which dash the source document happened to use.
preferredLegacy.set("–", "&");
// Found via a systematic key-by-key audit of the number row against the
// teacher's own official Kruti Dev 010 keyboard chart: pressing Shift+4
// (raw byte "$") draws a plain "+" glyph in the bundled font -- a pure
// font-rendering remap the @anthro-ai dictionary doesn't document at all
// (it has no entry for "$", so krutiDevToUnicode left it decoding as
// literal "$" -- wrong -- confirmed by rendering "$" directly in the
// bundled webfont). Meanwhile legacy byte "+" itself is already the
// dedicated nukta mark (used in ड़/ढ़/ज़ etc.), so a literal Unicode "+"
// character passed straight through (as the general loop above would,
// since "+" isn't Devanagari) would silently encode as invisible nukta
// instead of a visible plus sign. "$" is the safe, correct target instead.
preferredLegacy.set("+", "$");
// Same collision, same audit: legacy byte "=" is already the unshifted
// key's own meaning (त्र, confirmed against the keyboard chart above), so
// a literal Unicode "=" character passed straight through would silently
// collide with that conjunct instead of showing an equals sign. "¾" is
// the dictionary's only (unambiguous) legacy byte that decodes to a
// literal "=" and nothing else, confirmed rendering as a proper "=" glyph
// in the bundled font.
preferredLegacy.set("=", "¾");
// Real reported bug: an admin's word-set drill wrapped every word in
// typographic quotes ('कमल' 'कलम' ...), and the Kruti Dev preview showed
// garbage glyphs around each word instead of quote marks. These curly
// quotes aren't Devanagari, so the general loop above (which only keeps
// entries whose *decoded* side contains a Devanagari character) never
// mapped them, and unicodeToKrutiDev passed the raw ' '/' ' Unicode code
// points straight through -- codepoints the bundled Kruti Dev 010 font has
// no sensible glyph for. The @anthro-ai dictionary confirms the correct
// legacy bytes: krutiDevToUnicode("^") decodes to '‘' and
// krutiDevToUnicode("*") decodes to '’', and both are already
// ordinary keyboard keys, needing no further Alt-code folding.
preferredLegacy.set("‘", "^");
preferredLegacy.set("’", "*");
// Real reported bug: कृषि converted to "d`f\"k" -- the @anthro-ai
// dictionary's own iteration order happened to pick "—" (em dash) as the
// shortest legacy byte for कृ, which the KEYBOARD_KEY_SEQUENCES fold below
// then turned into the keyboard-typeable "d`" (क + the standalone ृ
// matra). Confirmed live in the bundled Kruti Dev 010 webfont
// (/admin/font-converter) against "Ñf\"k" (the OTHER single-byte legacy
// form the same dictionary also maps to कृ): both decode to the identical
// कृषि, but the admin/teacher reported "d`" as visibly wrong on screen
// where "Ñ" reads correctly -- "—"/"Ñ" are used for nothing else in the
// whole dictionary (grep confirmed), so preferring Ñ here is a fully
// isolated change with no effect on any other word.
preferredLegacy.set("कृ", "Ñ");
// Real reported bug, this time via a full hand-typed reference passage
// (385 words) an admin/teacher supplied and compared word-by-word against
// our own output: a vowel-sign-plus-anusvara pair (ें/ों/ाँ) always came
// out with the anusvara BEFORE the vowel sign -- "में" as "eas" instead of
// "esa", every "...ों" word (वर्षों, शहरों, नागरिकों, ...) as "...kas"
// instead of "...ksa", "जाँचना" as "t¡kpuk" instead of "tk¡puk". The
// @anthro-ai dictionary's own compound entries for these three pairs
// ("as", "kas", "¡k") happen to store the reversed order -- both orders
// decode to the identical Unicode (confirmed via krutiDevToUnicode), so
// this was invisible to round-trip tests, but only the natural
// sequential order (vowel sign, then anusvara -- exactly Unicode's own
// storage order, and what a real Kruti Dev keyboard actually produces
// typing them in that order) renders correctly and matches what the
// admin/teacher hand-typed. Confirmed these three combinations are used
// for nothing else in the dictionary, so this is isolated to exactly
// these three vowel-sign+anusvara pairs.
preferredLegacy.set("ें", "sa");
preferredLegacy.set("ों", "ksa");
preferredLegacy.set("ाँ", "k¡");
// Real reported bug, same reference-passage comparison: "शीघ्र" converted
// to "'kh?j" -- घ्र (gha + halant + subjoined-र) has no dedicated ligature
// byte in the @anthro-ai dictionary (unlike प्र/ग्र/त्र/श्र/क्र, which all
// do), so the tokenizer fell back to greedily matching the precomposed
// half-form "घ्" ("?") first and then plain "र" ("j") after it, relying on
// the font to visually kern "?" immediately followed by "j" into the
// subjoined-र tail -- the same class of kerning trick already documented
// above for Ø, except this one doesn't render correctly. Matching घ्र as
// its own 3-character token (longer than "घ्" alone, so it's tried first)
// forces the explicit, always-correct "kz" spelling for the subjoined-र
// instead.
preferredLegacy.set("घ्र", "?kz");
// Real reported bug, from an official Kruti Dev 010 Alt-code reference
// chart (Samradhi Classes' own teaching material) cross-checked word by
// word against this converter: ट्ट has two same-length dictionary entries
// (ê, Í), and this loop's first-found tie-break happened to pick ê, which
// KEYBOARD_KEY_SEQUENCES then folded to the keyboard-typeable "V~V" --
// confirmed by rendering "खट्टा" in the bundled font that "V~V" leaves a
// visible gap between the two ट (the doubled-consonant conjunct doesn't
// join), while "Í" (the chart's own Alt+0205, example word "खट्टा") joins
// cleanly. Overriding directly to Í makes ê (and its now-dead V~V fold)
// unreachable, the same treatment as the कृ/Ñ override above.
preferredLegacy.set("ट्ट", "Í");
// Same reference chart also lists द्म as Alt+0249 ("ù", example word
// "पद्मश्री"), which renders slightly more cleanly than the compositional
// "n~e" this converter builds today (द्म has no dictionary entry at all) --
// but unlike every fix above, "ù" has NO reverse-decode entry anywhere in
// the @anthro-ai dictionary: krutiDevToUnicode("ù") passes it through
// unchanged instead of turning it into "द्म" (confirmed directly). Using
// it here would silently break SCORING -- a student who correctly typed
// द्म would decode to gibberish and be marked wrong -- so this one stays
// on the compositional "n~e" form despite the chart, until a decode path
// for "ù" exists.
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
// Real reported bug, follow-up: unlike è/ä/®/È above (all confirmed
// via this exact rendering technique to genuinely mis-render as their raw
// ligature and NEED their fold), Ø (क्र) and ª (the रीक्ष root) were
// folded the WRONG direction -- the admin/teacher's hand-typed reference
// used the raw ligatures ("jk\"Vªh;", "dk;ZØe", "pØokr") where this file
// produced their folds ("jk\"Vzh;", "dk;Zdze", "pdzokr"), and rendering both
// side by side in the bundled Kruti Dev 010 webfont confirms it: Ø folded
// to "dz" visibly drops the ्र (क्रम renders as just कम), in EVERY position --
// not only after "f" as an earlier, incomplete investigation concluded.
// Both are now left unfolded entirely, the same as Ùk above. Scoring is
// unaffected either way: both forms decode to the identical Unicode.
// — (em dash, the dictionary's other single-byte legacy form for कृ) is
// deliberately NOT in this table any more -- preferredLegacy.set("कृ", "Ñ")
// above means unicodeToKrutiDev never produces it in the first place, so
// folding it would be dead code. See that override's comment for why Ñ
// was chosen over both — and the keyboard-sequence "d`" this table used
// to fold — instead.
// A ‚ (U+201A) -> "kW" fold briefly lived here, added on an unverified
// claim that "kW" was the keyboard-typeable form of ॉ (candra-O, e.g.
// "ऑनलाइन"/"कॉल") with "scoring unaffected either way it's stored". Found
// wrong by a later systematic audit of the whole keyboard: krutiDevToUnicode
// ("kW") decodes to ॅ (candra-E, U+0945) -- a DIFFERENT character from ॉ --
// so any student correctly typing ॉ via its real, already-documented
// Alt+0130 (see ALT_CODES in the Kruti Dev tutor, same as चन्द्रबिंदु/ँ,
// also Alt-code-only with no keyboard form) would decode to ॉ while the
// "kW"-folded passage decoded to ॅ, silently marking a correct answer
// wrong. Left unfolded entirely, same treatment as Ùk below.
// Real reported bug, follow-up: unlike ‚ above, "Ùk" -> "Rr" (त्त, e.g.
// "वित्तीय") was folded the WRONG direction -- the admin/teacher confirmed
// "Ù" itself is what their real Kruti Dev keyboard produces and renders
// correctly for this conjunct (their hand-typed reference used "foÙkh;",
// not our then-output "foRrh;"), so this fold was removed entirely rather
// than assumed to need one like the genuine alt-code ligatures below.
const KEYBOARD_KEY_SEQUENCES: Array<[RegExp, string]> = [
  [/Ò/g, "Hk"], [/è/g, "/k"], [/Ä/g, "?k"], [/Ã/g, "bZ"],
  [/ç/g, "iz"], [/æ/g, "nz"],
  [/ä/g, "Dr"], [/®/g, "Sa"], [/È/g, "ha"],
  [/î/g, "~;"],
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
  // Shift+4 (raw byte "$") draws a plain "+" glyph in the bundled Kruti Dev
  // 010 font (confirmed by direct rendering) -- a pure font remap the
  // @anthro-ai dictionary has no entry for at all, so convertLegacy() left
  // it decoding as literal "$", not "+". Completes the round trip for the
  // matching unicodeToKrutiDev("+") -> "$" override just above.
  ["$", "+"],
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
  return repairDecodedWord(output);
}

// Repairs applied to each decoded token. Every rule below only rewrites a
// token that is ALREADY impossible in Devanagari -- two stacked vowel
// signs, a word that opens with a मात्रा, an independent vowel carrying a
// मात्रा -- so it can never disturb a well-formed word; it only mends, or
// at worst re-mangles, a token that came in broken. The patterns are from
// auditing the Rajasthan LDC Hindi chapters, hand-typed in Kruti Dev with
// a recurring set of slips: a stray "aa" keystroke stacking two signs
// ("धीरे" -> धाीरे, "अधिकार" -> अधिाकार), the k key one keystroke early
// ("कार्य" -> ाकर्य), the s/l mirror-swap at a word start ("समाज" -> ेमाज),
// and f + m for f + e ("मिल" -> the impossible उि).
function repairDecodedWord(word: string) {
  return word
    // "ा" wedged before another vowel sign (è+k+h -> धाी).
    .replace(/ा(?=[ि-ौ])/gu, "")
    // doubled "ा" (/k + extra k -> धाा).
    .replace(/ा{2,}/gu, "ा")
    // A word cannot begin with a मात्रा. The Kruti Dev "ा" key (k) pressed
    // one keystroke early lands before its consonant -- "कार्य" stored as
    // k + d + ... decodes with a leading ा; move it after the consonant.
    .replace(/^ा([क-हक़-य़])/u, "$1ा")
    // Nor with "े". Kruti Dev स is the l key and े the mirror-image s key;
    // typing s for l at a word start is the most common slip in these
    // chapters ("सभी" -> ेभी, "समाज" -> ेमाज, "सुरक्षा" -> ेुरक्षा). Restore स.
    .replace(/^े/u, "स")
    // The pre-base ि marker (the f key) then उ (m) instead of म (e): ि
    // cannot ride an independent vowel, so it renders as the impossible
    // उ + ि -- every observed case is मिलना / मिलकर / मिला.
    .replace(/उि/gu, "मि")
    // A nukta letter directly followed by "यि" -- the @anthro-ai decoder
    // misplaces the pre-base ि onto य for ड़ि / ढ़ि / क़ि clusters, so
    // "सीढ़ियों" comes back as सीढ़यिों and "पीढ़ियों" as पीढ़यिों. The ि
    // belongs on the nukta letter; put it there. (matches ़ decomposed or
    // a pre-composed क़-य़.)
    .replace(/([़क़-य़])यि/gu, "$1िय")
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
  // Real reported bug: a drill wrapped every word in plain straight
  // apostrophes ('कमल' 'कलम' ...) -- what a student actually gets by
  // pressing the ' key, since typing a genuine curly opening/closing pair
  // needs an input method nobody here uses. A straight apostrophe can't
  // tell open from close by itself, but its position can: one right after
  // whitespace/start-of-text is opening (Shift+6, "^"), one right before
  // whitespace/end-of-text is closing (Shift+8, "*") -- the same rule a
  // smart-quotes autocorrect uses. Normalize to the curly equivalents
  // first so the existing ‘/’ legacy mapping below does the rest.
  working = working.replace(/(^|\s)'/gu, "$1‘").replace(/'(?=\s|$)/gu, "’");
  // Kruti Dev stores reph after the complete orthographic syllable --
  // but BEFORE any trailing anusvara/visarga/chandrabindu, not after.
  // Real reported bug: वर्षों converted to "o"kksaZ" (reph Z placed
  // after the ों anusvara) instead of the correct "o"kksZa" (reph
  // between the ो matra and the ं anusvara), confirmed against a
  // hand-typed reference passage. Excluding ंःँ from this capture
  // group stops them being swept up before the reph marker is inserted.
  working = working.replace(/र्([क-हक़-य़](?:्[क-हक़-य़])*(?:[ािीुूृॄेैोौॅॉ]*)?)/gu, "$1Z");
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
