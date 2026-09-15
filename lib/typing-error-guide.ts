import type { HalfErrorCategory, ScoringProfile, WordAnalysisEntry, WordEntryStatus } from "./typing-test.ts";

export type ErrorGuideKind = "full" | "half";
export type ErrorGuideKey = WordEntryStatus | HalfErrorCategory;

export type ErrorGuideDefinition = Readonly<{
  key: ErrorGuideKey;
  label: string;
  explanation: string;
  kind: ErrorGuideKind;
  penalty: number;
  example: Readonly<{ typed?: string; expected?: string; decoration: "bracket" | "pair" | "strike" | "repeat" }>;
}>;

const FULL_DEFINITIONS = [
  { key: "missing", label: "Omission error", explanation: "A word or figure from the original passage was not typed.", decoration: "bracket", typed: undefined, expected: "original word" },
  { key: "substituted", label: "Substitution error", explanation: "A different word or figure was typed instead of the original.", decoration: "pair", typed: "typed word", expected: "expected word" },
  { key: "extra", label: "Addition error", explanation: "A word or figure was typed that does not exist at that position in the original passage.", decoration: "strike", typed: "extra word", expected: undefined },
  { key: "repeated", label: "Repeated word error", explanation: "A word or phrase was typed unnecessarily more than once.", decoration: "repeat", typed: "repeated word", expected: undefined },
] as const;

const HALF_DEFINITIONS = [
  { key: "minorSpelling", label: "Minor spelling error", explanation: "One minor letter, matra, punctuation, transposition, addition, omission, or substitution occurred inside a word, according to the configured spelling tolerance.", decoration: "pair", typed: "typed spelling", expected: "correct spelling" },
  { key: "capitalization", label: "Capitalization error", explanation: "An incorrect capital or lowercase letter was typed.", decoration: "pair", typed: "Typed", expected: "typed" },
  { key: "spacing", label: "Spacing error", explanation: "A required space is missing, or an unnecessary space splits a word.", decoration: "pair", typed: "Ihope", expected: "I hope" },
  { key: "punctuation", label: "Punctuation error", explanation: "Punctuation was omitted, added, or substituted.", decoration: "pair", typed: "word", expected: "word," },
  { key: "matra", label: "Matra error", explanation: "The vowel sign (matra) attached to a consonant was typed incorrectly -- the rest of the word matches.", decoration: "pair", typed: "कि", expected: "की" },
  { key: "halant", label: "Halant (viram) error", explanation: "A halant (् , which joins consonants into a conjunct or suppresses the inherent vowel) was added or omitted.", decoration: "pair", typed: "करता", expected: "कर्ता" },
  { key: "gender", label: "Gender error", explanation: "The word's ending matches a well-known Hindi masculine/feminine agreement swap against the reference word. This flags the pattern, not full grammatical agreement -- it can't verify whether the reference passage's own grammar applies here.", decoration: "pair", typed: "अच्छा", expected: "अच्छी" },
  { key: "vachan", label: "Vachan (number) error", explanation: "The word's ending matches a well-known Hindi singular/plural agreement swap against the reference word. Same caveat as gender: this flags the pattern, not full grammatical agreement.", decoration: "pair", typed: "लड़का", expected: "लड़के" },
] as const;

// Whether this profile actually grades a given Devanagari-specific
// category -- these are the same three-state opt-in flags
// halfErrorCategories() reads (undefined = not a stenography context at
// all), so the guide only lists a category when it's genuinely possible
// to see it in this test's results, instead of showing it for any Hindi
// content regardless of mode.
const isDevanagariCategoryGraded = (profile: ScoringProfile, key: string) =>
  key === "matra" ? Boolean(profile.matraErrors)
  : key === "halant" ? Boolean(profile.halantErrors)
  : key === "gender" ? Boolean(profile.genderErrors)
  : key === "vachan" ? Boolean(profile.vachanErrors)
  : true;

export function buildErrorGuide(profile: ScoringProfile, language: "en" | "hi") {
  const full = FULL_DEFINITIONS.map(({key,label,explanation,...example}): ErrorGuideDefinition => ({ key,label,explanation,example,kind: "full", penalty: profile.fullErrorPenalty }));
  const half = HALF_DEFINITIONS
    .filter((definition) => language === "en" || definition.key !== "capitalization")
    .filter((definition) => isDevanagariCategoryGraded(profile, definition.key))
    .map(({key,label,explanation,...example}): ErrorGuideDefinition => ({
      key,label,example,
      kind: key === "minorSpelling" && profile.minorSpellingMaxDistance < 1 ? "full" : "half",
      penalty: key === "minorSpelling" && profile.minorSpellingMaxDistance < 1 ? profile.fullErrorPenalty : profile.halfErrorPenalty,
      explanation: key === "minorSpelling" && profile.minorSpellingMaxDistance < 1
        ? `${explanation} Minor spelling tolerance is disabled for this test, so it is scored as a substitution.`
        : explanation,
    }));
  return [...full, ...half];
}

export function errorDefinitionForEntry(entry: WordAnalysisEntry, profile: ScoringProfile, language: "en" | "hi") {
  const definitions = buildErrorGuide(profile, language);
  const key = entry.status === "half-error" ? entry.halfErrorCategories[0] : entry.status;
  return definitions.find((definition) => definition.key === key);
}

export function guidePenaltyTotal(entries: WordAnalysisEntry[], profile: ScoringProfile, language: "en" | "hi") {
  return entries.reduce((total, entry) => {
    if (entry.status === "correct" || entry.status === "remaining") return total;
    if (entry.status === "half-error") {
      return total + entry.halfErrorCategories.reduce((sum, category) => sum + (buildErrorGuide(profile, language).find((item) => item.key === category)?.penalty ?? 0), 0);
    }
    return total + (errorDefinitionForEntry(entry, profile, language)?.penalty ?? 0);
  }, 0);
}
