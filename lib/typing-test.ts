import { segmentGraphemes } from "./typing-language.ts";

export type BackspaceMode = "full" | "word" | "disabled";
export type HighlightMode = "character" | "word" | "none";
export type WordMethod = "characters" | "spaces";

export type TypingSettings = {
  backspaceMode: BackspaceMode;
  highlightMode: HighlightMode;
  wordMethod: WordMethod;
  minWords: number;
  maxWords: number;
};

export const DEFAULT_TYPING_SETTINGS: TypingSettings = {
  backspaceMode: "full",
  highlightMode: "character",
  wordMethod: "characters",
  minWords: 150,
  maxWords: 1500,
};

// The duration choices offered to a student picking their own practice
// duration: every minute from 1-25, then 5-minute steps up to 70. Admin-set
// exam/learn/stenography durations are unaffected -- this only backs the
// student-facing picker for tests where duration isn't locked.
export const PRACTICE_DURATION_MINUTES: readonly number[] = [
  ...Array.from({ length: 25 }, (_, index) => index + 1),
  30, 35, 40, 45, 50, 55, 60, 65, 70,
];

const isBackspaceMode = (value: unknown): value is BackspaceMode =>
  value === "full" || value === "word" || value === "disabled";

const isHighlightMode = (value: unknown): value is HighlightMode =>
  value === "character" || value === "word" || value === "none";

const isWordMethod = (value: unknown): value is WordMethod =>
  value === "characters" || value === "spaces";

function readWordLimit(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= 150 && value <= 1500
    ? value
    : fallback;
}

export function parseTypingSettings(value: unknown): TypingSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_TYPING_SETTINGS;
  }

  const data = value as Record<string, unknown>;
  const minWords = readWordLimit(data.minWords, DEFAULT_TYPING_SETTINGS.minWords);
  const maxWords = readWordLimit(data.maxWords, DEFAULT_TYPING_SETTINGS.maxWords);

  return {
    backspaceMode: isBackspaceMode(data.backspaceMode)
      ? data.backspaceMode
      : DEFAULT_TYPING_SETTINGS.backspaceMode,
    highlightMode: isHighlightMode(data.highlightMode)
      ? data.highlightMode
      : data.highlightMode === "highlight" ? "character"
      : DEFAULT_TYPING_SETTINGS.highlightMode,
    wordMethod: isWordMethod(data.wordMethod)
      ? data.wordMethod
      : DEFAULT_TYPING_SETTINGS.wordMethod,
    minWords: minWords < maxWords ? minWords : DEFAULT_TYPING_SETTINGS.minWords,
    maxWords: minWords < maxWords ? maxWords : DEFAULT_TYPING_SETTINGS.maxWords,
  };
}

export function loadTypingSettings(storageKey: string): TypingSettings {
  if (typeof window === "undefined") {
    return DEFAULT_TYPING_SETTINGS;
  }

  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved ? parseTypingSettings(JSON.parse(saved)) : DEFAULT_TYPING_SETTINGS;
  } catch {
    return DEFAULT_TYPING_SETTINGS;
  }
}

export function countSpaceWords(text: string) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export type WordEntryStatus =
  | "correct"
  | "substituted"
  | "missing"
  | "remaining"
  | "extra"
  | "repeated"
  | "half-error";

export type HalfErrorCategory =
  | "capitalization"
  | "punctuation"
  | "spacing"
  | "minorSpelling"
  | "matra"
  | "halant"
  | "gender"
  | "vachan";

export type WordAnalysisEntry = {
  id: string;
  status: WordEntryStatus;
  original?: string;
  typed?: string;
  originalIndex?: number;
  typedIndex?: number;
  halfErrorCategories: HalfErrorCategory[];
  separatorAfter?: string;
};

export type ScoringProfile = {
  fullErrorPenalty: number;
  halfErrorPenalty: number;
  minorSpellingMaxDistance: number;
  passNetWpm: number;
  passAccuracy: number;
  capitalizationErrors?: boolean;
  punctuationErrors?: boolean;
  spacingErrors?: boolean;
  minorSpellingErrors?: boolean;
  // matra/gender/vachan have no toggle here on purpose -- see
  // ALL_HALF_ERROR_CATEGORIES's comment below.
  halantErrors?: boolean;
};

export const DEFAULT_SCORING_PROFILE: ScoringProfile = {
  fullErrorPenalty: 1,
  halfErrorPenalty: 0.5,
  minorSpellingMaxDistance: 1,
  passNetWpm: 35,
  passAccuracy: 90,
};

// The half-error categories a stenography dictation attempt lets the
// student choose to have graded (missing/extra/repeated/substituted "full"
// word errors are never optional -- a wrong word is always wrong). Shared
// between the student-facing selection UI, the server-side re-scoring in
// app/tests/actions.ts, and the results-page "graded for this attempt"
// banner, so all three always agree on the same names/labels.
//
// matra/gender/vachan are deliberately NOT in this list -- they're always
// computed and always shown in results, never a pre-test checkbox. Real
// Hindi grammatical gender/number agreement depends on a word's
// relationship to the rest of the sentence, which this word-by-word
// comparison against a fixed reference passage can't see; gender/vachan
// here are an honest, narrower signal (a typed word's ending matches a
// well-known Hindi gender/number swap pattern against the reference word),
// not real grammar-checking, so they're never presented as something a
// student can choose to switch off -- there's no meaningful "off" state
// for an informational label like that.
export const ALL_HALF_ERROR_CATEGORIES: HalfErrorCategory[] = ["capitalization", "punctuation", "spacing", "minorSpelling", "halant"];
export const HALF_ERROR_CATEGORY_LABELS: Record<HalfErrorCategory, string> = { capitalization: "Capitalization", punctuation: "Punctuation", spacing: "Spacing", minorSpelling: "Minor spelling", matra: "Matra (vowel sign)", halant: "Halant (viram)", gender: "Gender", vachan: "Vachan (number)" };

export function scoringProfileWithSelectedCategories(base: ScoringProfile, selected: HalfErrorCategory[]): ScoringProfile {
  return { ...base, capitalizationErrors: selected.includes("capitalization"), punctuationErrors: selected.includes("punctuation"), spacingErrors: selected.includes("spacing"), minorSpellingErrors: selected.includes("minorSpelling"), halantErrors: selected.includes("halant") };
}

// Defaults to every category (today's unrestricted-grading behavior) for
// any missing/malformed input -- the safe fallback for every existing
// caller that has never heard of this selection, and for a tampered or
// stale client payload.
export function sanitizeSelectedCategories(value: unknown): HalfErrorCategory[] {
  if (!Array.isArray(value)) return [...ALL_HALF_ERROR_CATEGORIES];
  const set = new Set(value.filter((item): item is HalfErrorCategory => (ALL_HALF_ERROR_CATEGORIES as string[]).includes(item as string)));
  return ALL_HALF_ERROR_CATEGORIES.filter((category) => set.has(category));
}

export function activeHalfErrorCategories(profile: ScoringProfile): HalfErrorCategory[] {
  const flags: Record<HalfErrorCategory, boolean | undefined> = { capitalization: profile.capitalizationErrors, punctuation: profile.punctuationErrors, spacing: profile.spacingErrors, minorSpelling: profile.minorSpellingErrors, halant: profile.halantErrors, matra: undefined, gender: undefined, vachan: undefined };
  return ALL_HALF_ERROR_CATEGORIES.filter((category) => flags[category] !== false);
}

export type ErrorCategoryCounts = {
  missing: number;
  extra: number;
  repeated: number;
  substituted: number;
  capitalization: number;
  punctuation: number;
  spacing: number;
  minorSpelling: number;
  matra: number;
  halant: number;
  gender: number;
  vachan: number;
};

export type RepeatedMistake = {
  label: string;
  count: number;
};

export type TypingAnalysis = {
  entries: WordAnalysisEntry[];
  counts: {
    correct: number;
    substituted: number;
    missing: number;
    remaining: number;
    extra: number;
    repeated: number;
    halfError: number;
  };
  categoryCounts: ErrorCategoryCounts;
  fullErrors: number;
  halfErrors: number;
  totalPenalty: number;
  remainingWords: number;
  remainingCharacters: number;
  topRepeatedMistakes: RepeatedMistake[];
};

type WordToken = {
  raw: string;
  core: string;
  normalizedCore: string;
  punctuation: string;
  index: number;
  separatorAfter: string;
};

// Real bug reported live: the passage's own paragraph breaks are stored as
// a blank line (two newlines, "\n\n" -- what pasting from Word/Docs
// naturally produces), but a student reasonably presses Enter exactly
// once per paragraph, producing a single "\n". That exact-string
// separator comparison flagged the last word of every single paragraph in
// every passage as a "spacing" mistake -- not a real typing error, just a
// mismatch between how many blank lines the source document happened to
// have and how many times a normal typist presses Enter. Two separators
// that both represent "a line break" (any amount of surrounding
// whitespace, any number of newlines) are treated as equivalent here --
// this still catches a *genuine* spacing mistake: a missing/extra space
// between two words on the same line (no newline on either side), or a
// student running two paragraphs together without pressing Enter at all
// (a newline on one side but not the other).
function separatorsEquivalent(original: string, typed: string) {
  if (original === typed) return true;
  const originalHasBreak = /\n/.test(original);
  const typedHasBreak = /\n/.test(typed);
  return originalHasBreak && typedHasBreak;
}

function tokenizeWords(text: string): WordToken[] {
  const matches = [...text.matchAll(/\S+/g)];
  return matches.map((match, index) => {
    const raw = match[0];
    const start = match.index ?? 0;
    const end = start + raw.length;
    const nextStart = matches[index + 1]?.index ?? text.length;
    const separatorAfter = text.slice(end, nextStart);
    const core = raw.replace(/^\p{P}+|\p{P}+$/gu, "");
    const punctuation = raw.slice(0, raw.indexOf(core) < 0 ? 0 : raw.indexOf(core)) +
      raw.slice((raw.indexOf(core) < 0 ? 0 : raw.indexOf(core)) + core.length);
    return {
      raw,
      core: core || raw,
      normalizedCore: (core || raw).toLocaleLowerCase("en"),
      punctuation,
      index,
      separatorAfter,
    };
  });
}

function editDistance(left: string, right: string) {
  const leftUnits = segmentGraphemes(left);
  const rightUnits = segmentGraphemes(right);
  let previous = Array.from({ length: rightUnits.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= leftUnits.length; leftIndex += 1) {
    const current = new Array<number>(rightUnits.length + 1);
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= rightUnits.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] +
          (leftUnits[leftIndex - 1] === rightUnits[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[rightUnits.length];
}

// Whether a word-pair belongs to the "half-error" family at all -- same
// normalized core, within the minor-spelling edit-distance threshold, or
// recognized by the Devanagari-specific matra/halant/gender/vachan
// classifier below -- independent of which of its specific differences
// (capitalization, punctuation, ...) are actually being graded right now.
// Used to tell "this word has no differences in a graded category, so
// it's simply correct" apart from "this word is a real full-error
// substitution" -- see halfErrorCategories()'s doc comment for why that
// distinction matters.
//
// The Devanagari classifier check is not redundant with the edit-distance
// check above it: a halant difference typically changes how many
// grapheme clusters the word has at all (it merges or splits a
// conjunct), so the generic grapheme-based edit distance between two
// halant-different words can easily exceed maxDistance even though
// classifyDevanagariDifference() correctly recognizes them as a single,
// forgivable halant difference -- without this, toggling halant grading
// off would wrongly escalate a halant mistake to a full "substituted"
// error instead of forgiving it.
function isWithinHalfErrorFamily(original: WordToken, typed: WordToken, maxDistance: number) {
  return original.normalizedCore === typed.normalizedCore
    || editDistance(original.normalizedCore, typed.normalizedCore) <= maxDistance
    || classifyDevanagariDifference(original, typed) !== null;
}

const isDevanagariWord = (text: string) => /\p{Script=Devanagari}/u.test(text);
const DEVANAGARI_HALANT = "्"; // halant/virama -- joins consonants into a conjunct, or suppresses the inherent vowel
// The full set of Devanagari dependent vowel signs (matra) -- everything
// that can attach to a consonant to change which vowel sound it carries.
// Deliberately excludes the halant (handled as its own case) and marks
// like anusvara/visarga/nukta, which aren't vowel signs.
const DEVANAGARI_VOWEL_SIGNS = new Set([..."ािीुूृॄॅॆेैॉॊोौॕॖॗ"]);
// Word-final swaps (removed codepoints on the left of "|", inserted
// codepoints on the right) that most commonly mark Hindi grammatical
// gender agreement (masculine <-> feminine adjective/verb endings) or
// number/vachan agreement (singular <-> plural) -- the empty string on one
// side of the anusvara entries is the anusvara added for a plural verb
// form (e.g. is/are). This is a small, curated heuristic on the word's
// ending only -- not real morphological analysis, and it can't know
// whether the reference passage's own grammar was "correct"; it just
// flags when a typed word's ending matches one of these well-known swap
// patterns against the reference word, checked BEFORE the generic matra
// case so a recognized pair gets the more specific label. Deliberately
// not exhaustive.
const GENDER_SWAP_PAIRS = new Set(["ा|ी", "ी|ा", "आ|ई", "ई|आ"]); // aa-matra|ii-matra, ii-matra|aa-matra, AA|II, II|AA
const VACHAN_SWAP_PAIRS = new Set(["ा|े", "े|ा", "|ं", "ं|"]); // aa-matra|e-matra, e-matra|aa-matra, (nothing)|anusvara, anusvara|(nothing)

// Trims the common prefix/suffix off two codepoint arrays and returns just
// the differing middle region from each side -- a minimal, dependency-free
// diff (not a full edit-distance alignment) that's enough to answer "is
// the *entire* difference between these two words a single removed and/or
// inserted codepoint", which is exactly the shape a matra or halant
// mistake takes. Also reports whether that differing region reaches the
// end of the word (needed for the gender/vachan word-final check).
function trimCodepoints(a: string[], b: string[]) {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length, endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA -= 1; endB -= 1; }
  return { removed: a.slice(start, endA), inserted: b.slice(start, endB), wordFinal: endA === a.length && endB === b.length };
}

// The core of this feature: reduces the difference between two Devanagari
// words to "what codepoints were removed, and what were inserted" (via
// trimCodepoints above), then checks that reduced difference against
// halant/gender/vachan/matra shapes, in that priority order. Deliberately
// does NOT reuse segmentGraphemes()'s grapheme clusters here -- a halant
// difference typically changes how many graphemes the word even has (it
// merges or splits a conjunct), so comparing cluster-by-cluster would miss
// almost every real halant mistake; comparing raw codepoints after
// trimming the identical prefix/suffix catches it regardless of how the
// surrounding text re-clusters. Runs only when both words contain
// Devanagari script; English-script word pairs never reach this function,
// so English scoring is completely unaffected by any of this.
function classifyDevanagariDifference(original: WordToken, typed: WordToken): "matra" | "halant" | "gender" | "vachan" | null {
  if (!isDevanagariWord(original.core) || !isDevanagariWord(typed.core)) return null;
  const a = [...original.core.normalize("NFC")];
  const b = [...typed.core.normalize("NFC")];
  const { removed, inserted, wordFinal } = trimCodepoints(a, b);
  if (removed.length === 0 && inserted.length === 0) return null;
  if (removed.length === 1 && inserted.length === 0 && removed[0] === DEVANAGARI_HALANT) return "halant";
  if (inserted.length === 1 && removed.length === 0 && inserted[0] === DEVANAGARI_HALANT) return "halant";
  if (wordFinal) {
    const key = `${removed.join("")}|${inserted.join("")}`;
    if (GENDER_SWAP_PAIRS.has(key)) return "gender";
    if (VACHAN_SWAP_PAIRS.has(key)) return "vachan";
  }
  const isVowelSignOrEmpty = (codepoints: string[]) => codepoints.length <= 1 && codepoints.every((codepoint) => DEVANAGARI_VOWEL_SIGNS.has(codepoint));
  if (isVowelSignOrEmpty(removed) && isVowelSignOrEmpty(inserted)) return "matra";
  return null;
}

// Returns only the categories that are BOTH actually present as a
// difference AND currently graded (profile.<category>Errors !== false --
// except matra/gender/vachan, which are always graded, see
// ALL_HALF_ERROR_CATEGORIES's comment). A category being toggled off must
// mean "forgive this difference", not "this difference doesn't count as
// this category but still counts as something else" -- callers combine
// this with isWithinHalfErrorFamily() to tell "no graded difference"
// (forgiven, status "correct") apart from "genuinely a different word"
// (status "substituted").
function halfErrorCategories(
  original: WordToken,
  typed: WordToken,
  profile: ScoringProfile,
): HalfErrorCategory[] {
  const categories: HalfErrorCategory[] = [];
  if (original.normalizedCore === typed.normalizedCore) {
    if (profile.capitalizationErrors !== false && original.core !== typed.core) categories.push("capitalization");
    if (profile.punctuationErrors !== false && original.punctuation !== typed.punctuation) categories.push("punctuation");
    return categories;
  }
  const devanagariCategory = classifyDevanagariDifference(original, typed);
  if (devanagariCategory === "halant") {
    if (profile.halantErrors !== false) categories.push("halant");
    if (profile.punctuationErrors !== false && original.punctuation !== typed.punctuation) categories.push("punctuation");
    return categories;
  }
  if (devanagariCategory) {
    categories.push(devanagariCategory);
    if (profile.punctuationErrors !== false && original.punctuation !== typed.punctuation) categories.push("punctuation");
    return categories;
  }
  if (
    editDistance(original.normalizedCore, typed.normalizedCore) <=
    profile.minorSpellingMaxDistance
  ) {
    if (profile.minorSpellingErrors !== false) categories.push("minorSpelling");
    if (original.core !== typed.core && original.core.toLocaleLowerCase("en") === typed.core.toLocaleLowerCase("en")) {
      if (profile.capitalizationErrors !== false) categories.push("capitalization");
    }
    if (profile.punctuationErrors !== false && original.punctuation !== typed.punctuation) categories.push("punctuation");
  }
  return categories;
}

function substitutionCost(
  original: WordToken,
  typed: WordToken,
  profile: ScoringProfile,
) {
  if (original.raw === typed.raw) return 0;
  if (halfErrorCategories(original, typed, profile).length > 0) return 0.45;
  // A word within the half-error family but with no *graded* category
  // difference (every applicable category was toggled off) is forgiven --
  // it must align as a cheap "pair" match (cost 0), not fall through to
  // the full substitution cost, or a toggled-off category would silently
  // make that word MORE wrong instead of not counting at all.
  return isWithinHalfErrorFamily(original, typed, profile.minorSpellingMaxDistance) ? 0 : 1;
}

function classifyRepeatedEntries(entries: WordAnalysisEntry[], originalWords: WordToken[]) {
  for (let start = 0; start < entries.length;) {
    if (entries[start].status !== "extra") { start += 1; continue; }
    let end = start + 1;
    while (end < entries.length && entries[end].status === "extra") end += 1;

    const insertionPoint = entries.slice(0, start).reduce((last, entry) =>
      entry.originalIndex === undefined ? last : Math.max(last, entry.originalIndex + 1), 0);
    const runLength = end - start;
    const following = entries.slice(end, end + runLength);
    if (following.length === runLength && following.every((entry, index) =>
      entry.originalIndex === insertionPoint + index &&
      entry.typed === entries[start + index].typed && entry.original === entry.typed
    )) {
      for (let index = 0; index < runLength; index += 1) {
        const extra = entries[start + index];
        const aligned = following[index];
        extra.status = "correct";
        extra.original = aligned.original;
        extra.originalIndex = aligned.originalIndex;
        extra.separatorAfter = aligned.separatorAfter;
        aligned.status = "repeated";
        aligned.original = undefined;
        aligned.originalIndex = undefined;
      }
      start = end + runLength;
      continue;
    }
    let offset = 0;
    while (offset < end - start) {
      let matchedLength = 0;
      const remaining = end - start - offset;
      const earliestNearby = Math.max(0, insertionPoint - 64);
      for (let length = remaining; length >= 1 && !matchedLength; length -= 1) {
        const typedSequence = entries.slice(start + offset, start + offset + length).map((entry) => entry.typed);
        for (let candidate = insertionPoint - length; candidate >= earliestNearby; candidate -= 1) {
          if (typedSequence.every((word, index) => word === originalWords[candidate + index]?.raw)) {
            matchedLength = length;
            break;
          }
        }
      }
      if (!matchedLength) { offset += 1; continue; }
      for (let index = 0; index < matchedLength; index += 1) entries[start + offset + index].status = "repeated";
      offset += matchedLength;
    }
    start = end;
  }
}

export function alignWords(
  passage: string,
  typedText: string,
  profile: ScoringProfile = DEFAULT_SCORING_PROFILE,
  includeUntypedWords = true,
): WordAnalysisEntry[] {
  const originalWords = tokenizeWords(passage);
  const typedWords = tokenizeWords(typedText);
  const rows = typedWords.length + 1;
  const columns = originalWords.length + 1;
  const costs = Array.from({ length: rows }, () => new Array<number>(columns));
  const exactMatches = Array.from({ length: rows }, () => new Array<number>(columns).fill(0));
  const moves = Array.from({ length: rows }, () => new Array<"pair" | "missing" | "extra" | "start">(columns));

  costs[0][0] = 0;
  moves[0][0] = "start";
  for (let originalIndex = 1; originalIndex < columns; originalIndex += 1) {
    costs[0][originalIndex] = originalIndex;
    moves[0][originalIndex] = "missing";
  }
  for (let typedIndex = 1; typedIndex < rows; typedIndex += 1) {
    costs[typedIndex][0] = typedIndex;
    moves[typedIndex][0] = "extra";
  }

  for (let typedIndex = 1; typedIndex < rows; typedIndex += 1) {
    for (let originalIndex = 1; originalIndex < columns; originalIndex += 1) {
      const pairCost =
        costs[typedIndex - 1][originalIndex - 1] +
        substitutionCost(originalWords[originalIndex - 1], typedWords[typedIndex - 1], profile);
      const missingCost = costs[typedIndex][originalIndex - 1] + 1;
      const extraCost = costs[typedIndex - 1][originalIndex] + 1;
      const best = Math.min(pairCost, missingCost, extraCost);
      costs[typedIndex][originalIndex] = best;
      const pairMatches = exactMatches[typedIndex - 1][originalIndex - 1] + (originalWords[originalIndex - 1].raw === typedWords[typedIndex - 1].raw ? 1 : 0);
      const missingMatches = exactMatches[typedIndex][originalIndex - 1];
      const extraMatches = exactMatches[typedIndex - 1][originalIndex];
      const mostMatches = Math.max(pairCost === best ? pairMatches : -1, missingCost === best ? missingMatches : -1, extraCost === best ? extraMatches : -1);
      const pairEligible = pairCost === best && pairMatches === mostMatches;
      const missingEligible = missingCost === best && missingMatches === mostMatches;
      const extraEligible = extraCost === best && extraMatches === mostMatches;
      const repeatsPrevious = originalIndex > 1 &&
        typedWords[typedIndex - 1].raw === originalWords[originalIndex - 2].raw;
      const canAlignEarlier = originalWords.slice(0, originalIndex - 1).some((word) =>
        word.raw === typedWords[typedIndex - 1].raw);
      moves[typedIndex][originalIndex] =
        repeatsPrevious && extraEligible ? "extra" :
        canAlignEarlier && missingEligible ? "missing" :
        pairEligible ? "pair" : missingEligible ? "missing" : "extra";
      exactMatches[typedIndex][originalIndex] = moves[typedIndex][originalIndex] === "pair" ? pairMatches : moves[typedIndex][originalIndex] === "missing" ? missingMatches : extraMatches;
    }
  }

  let typedIndex = typedWords.length;
  let originalIndex = 0;
  for (let candidate = 1; candidate < columns; candidate += 1) {
    if (
      exactMatches[typedIndex][candidate] > exactMatches[typedIndex][originalIndex] ||
      (exactMatches[typedIndex][candidate] === exactMatches[typedIndex][originalIndex] && costs[typedIndex][candidate] < costs[typedIndex][originalIndex]) ||
      (exactMatches[typedIndex][candidate] === exactMatches[typedIndex][originalIndex] && costs[typedIndex][candidate] === costs[typedIndex][originalIndex])
    ) {
      originalIndex = candidate;
    }
  }
  const attemptedOriginalEnd = originalIndex;

  const entries: WordAnalysisEntry[] = [];
  while (typedIndex > 0 || originalIndex > 0) {
    const move = moves[typedIndex][originalIndex];
    if (move === "pair") {
      const original = originalWords[originalIndex - 1];
      const typed = typedWords[typedIndex - 1];
      const categories = halfErrorCategories(original, typed, profile);
      // A toggled-off category difference (categories.length === 0, but
      // still within the half-error family) is forgiven as "correct", not
      // escalated to "substituted" -- see halfErrorCategories()'s comment.
      const withinFamily = isWithinHalfErrorFamily(original, typed, profile.minorSpellingMaxDistance);
      entries.push({
        id: `o${original.index}-t${typed.index}`,
        status: original.raw === typed.raw ? "correct" : categories.length ? "half-error" : withinFamily ? "correct" : "substituted",
        original: original.raw,
        typed: typed.raw,
        originalIndex: original.index,
        typedIndex: typed.index,
        halfErrorCategories: categories,
        separatorAfter: original.separatorAfter,
      });
      typedIndex -= 1;
      originalIndex -= 1;
    } else if (move === "missing") {
      const original = originalWords[originalIndex - 1];
      entries.push({ id: `o${original.index}-missing`, status: "missing", original: original.raw, originalIndex: original.index, halfErrorCategories: [], separatorAfter: original.separatorAfter });
      originalIndex -= 1;
    } else {
      const typed = typedWords[typedIndex - 1];
      entries.push({ id: `extra-t${typed.index}`, status: "extra", typed: typed.raw, typedIndex: typed.index, halfErrorCategories: [], separatorAfter: typed.separatorAfter });
      typedIndex -= 1;
    }
  }

  entries.reverse();
  classifyRepeatedEntries(entries, originalWords);
  for (let index = 0; index < entries.length - 1; index += 1) {
    const entry = entries[index];
    const next = entries[index + 1];
    if (
      entry.originalIndex !== undefined && entry.typedIndex !== undefined &&
      next.originalIndex === entry.originalIndex + 1 &&
      next.typedIndex === entry.typedIndex + 1 &&
      !separatorsEquivalent(originalWords[entry.originalIndex].separatorAfter, typedWords[entry.typedIndex].separatorAfter) &&
      profile.spacingErrors !== false
    ) {
      entry.halfErrorCategories = [...entry.halfErrorCategories, "spacing"];
      if (entry.status === "correct") entry.status = "half-error";
    }
  }
  if (includeUntypedWords) {
    for (let index = attemptedOriginalEnd; index < originalWords.length; index += 1) {
      const original = originalWords[index];
      entries.push({ id: `o${original.index}-remaining`, status: "remaining", original: original.raw, originalIndex: original.index, halfErrorCategories: [], separatorAfter: original.separatorAfter });
    }
  }
  return entries;
}

export function analyzeTyping(
  passage: string,
  typedText: string,
  profile: ScoringProfile = DEFAULT_SCORING_PROFILE,
  includeUntypedWords = true,
): TypingAnalysis {
  const entries = alignWords(passage, typedText, profile, includeUntypedWords);
  const categoryCounts: ErrorCategoryCounts = { missing: 0, extra: 0, repeated: 0, substituted: 0, capitalization: 0, punctuation: 0, spacing: 0, minorSpelling: 0, matra: 0, halant: 0, gender: 0, vachan: 0 };
  const counts = { correct: 0, substituted: 0, missing: 0, remaining: 0, extra: 0, repeated: 0, halfError: 0 };
  const repeated = new Map<string, number>();

  for (const entry of entries) {
    if (entry.status === "correct") counts.correct += 1;
    if (entry.status === "missing") { counts.missing += 1; categoryCounts.missing += 1; }
    if (entry.status === "remaining") counts.remaining += 1;
    if (entry.status === "extra") { counts.extra += 1; categoryCounts.extra += 1; }
    if (entry.status === "repeated") { counts.repeated += 1; categoryCounts.repeated += 1; }
    if (entry.status === "substituted") { counts.substituted += 1; categoryCounts.substituted += 1; }
    if (entry.status === "half-error") counts.halfError += 1;
    for (const category of entry.halfErrorCategories) categoryCounts[category] += 1;
    if (entry.status !== "correct" && entry.status !== "remaining") {
      const label = entry.status === "missing" ? `Missing: ${entry.original}` : entry.status === "extra" ? `Extra: ${entry.typed}` : entry.status === "repeated" ? `Repeated: ${entry.typed}` : `${entry.original} → ${entry.typed}`;
      repeated.set(label, (repeated.get(label) ?? 0) + 1);
    }
  }

  const fullErrors = counts.missing + counts.extra + counts.repeated + counts.substituted;
  const halfErrors = categoryCounts.capitalization + categoryCounts.punctuation + categoryCounts.spacing + categoryCounts.minorSpelling + categoryCounts.matra + categoryCounts.halant + categoryCounts.gender + categoryCounts.vachan;
  const remainingEntries = entries.filter((entry) => entry.status === "remaining");
  return {
    entries,
    counts,
    categoryCounts,
    fullErrors,
    halfErrors,
    totalPenalty: fullErrors * profile.fullErrorPenalty + halfErrors * profile.halfErrorPenalty,
    remainingWords: remainingEntries.length,
    remainingCharacters: segmentGraphemes(remainingEntries.map((entry) => `${entry.original ?? ""}${entry.separatorAfter ?? ""}`).join("")).length,
    topRepeatedMistakes: [...repeated.entries()].map(([label, count]) => ({ label, count })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)).slice(0, 5),
  };
}

export type TypingScore = {
  totalCharacters: number;
  correctCharacters: number;
  incorrectCharacters: number;
  accuracy: number;
  fiveCharacterWords: number;
  spaceWords: number;
  grossWpm: number;
  netWpm: number;
  efficiency: number;
  correctWords: number;
  elapsedSeconds: number;
  analysis: TypingAnalysis;
  passed: boolean;
};

/**
 * Aligns the typed text to any prefix of the passage. The untyped suffix is
 * intentionally free, so live results do not count text the student has not
 * had a chance to type. Insertions, omissions, and substitutions each count
 * as one error without shifting the rest of the passage out of alignment.
 */
export function getAlignment(typedText: string, passage: string) {
  const typedUnits = segmentGraphemes(typedText);
  const targetUnits = segmentGraphemes(passage);
  const typedLength = typedUnits.length;
  const targetLength = targetUnits.length;
  let previousCosts = new Array<number>(targetLength + 1);
  let previousMatches = new Array<number>(targetLength + 1);

  for (let index = 0; index <= targetLength; index += 1) {
    previousCosts[index] = index;
    previousMatches[index] = 0;
  }

  for (let typedIndex = 1; typedIndex <= typedLength; typedIndex += 1) {
    const costs = new Array<number>(targetLength + 1);
    const matches = new Array<number>(targetLength + 1);
    costs[0] = typedIndex;
    matches[0] = 0;

    for (let targetIndex = 1; targetIndex <= targetLength; targetIndex += 1) {
      const sameCharacter = typedUnits[typedIndex - 1] === targetUnits[targetIndex - 1];
      let cost = previousCosts[targetIndex - 1] + (sameCharacter ? 0 : 1);
      let matchCount = previousMatches[targetIndex - 1] + (sameCharacter ? 1 : 0);
      const insertedCost = previousCosts[targetIndex] + 1;
      const insertedMatches = previousMatches[targetIndex];
      const omittedCost = costs[targetIndex - 1] + 1;
      const omittedMatches = matches[targetIndex - 1];

      if (insertedCost < cost || (insertedCost === cost && insertedMatches > matchCount)) {
        cost = insertedCost;
        matchCount = insertedMatches;
      }
      if (omittedCost < cost || (omittedCost === cost && omittedMatches > matchCount)) {
        cost = omittedCost;
        matchCount = omittedMatches;
      }

      costs[targetIndex] = cost;
      matches[targetIndex] = matchCount;
    }

    previousCosts = costs;
    previousMatches = matches;
  }

  let errorCount = previousCosts[0];
  let correctCharacters = previousMatches[0];
  for (let index = 1; index <= targetLength; index += 1) {
    if (
      previousCosts[index] < errorCount ||
      (previousCosts[index] === errorCount && previousMatches[index] > correctCharacters)
    ) {
      errorCount = previousCosts[index];
      correctCharacters = previousMatches[index];
    }
  }

  return { correctCharacters, errorCount };
}

export function calculateTypingScore({
  typedText,
  passage,
  elapsedSeconds,
  wordMethod,
  scoringProfile = DEFAULT_SCORING_PROFILE,
  includeUntypedWords = false,
}: {
  typedText: string;
  passage: string;
  elapsedSeconds: number;
  wordMethod: WordMethod;
  scoringProfile?: ScoringProfile;
  includeUntypedWords?: boolean;
}): TypingScore {
  const totalCharacters = segmentGraphemes(typedText).length;
  const { correctCharacters } = getAlignment(typedText, passage);
  const incorrectCharacters = Math.max(0, totalCharacters - correctCharacters);
  const elapsedMinutes = Math.max(elapsedSeconds / 60, 1 / 60);
  const spaceWords = countSpaceWords(typedText);
  const fiveCharacterWords = Math.floor(totalCharacters / 5);
  const grossWordCount = wordMethod === "characters" ? totalCharacters / 5 : spaceWords;
  const grossWpm = Math.round(grossWordCount / elapsedMinutes);
  const analysis = analyzeTyping(passage, typedText, scoringProfile, includeUntypedWords);
  const netWpm = Math.max(Math.round(grossWpm - analysis.totalPenalty / elapsedMinutes), 0);
  const efficiency = grossWpm > 0 ? Math.min(100, Math.round((netWpm / grossWpm) * 100)) : 100;
  const accuracy = totalCharacters > 0
    ? Math.round((correctCharacters / (correctCharacters + incorrectCharacters)) * 100)
    : 100;
  const safeAccuracy = Number.isFinite(accuracy) ? accuracy : 0;

  return {
    totalCharacters,
    correctCharacters,
    incorrectCharacters,
    accuracy: safeAccuracy,
    fiveCharacterWords,
    spaceWords,
    grossWpm,
    netWpm,
    efficiency,
    correctWords: analysis.counts.correct,
    elapsedSeconds,
    analysis,
    passed: netWpm >= scoringProfile.passNetWpm && safeAccuracy >= scoringProfile.passAccuracy,
  };
}

export function isAllowedTypingEdit({
  previousValue,
  nextValue,
  selectionStart,
  selectionEnd,
  mode,
  maximumLength,
}: {
  previousValue: string;
  nextValue: string;
  selectionStart: number;
  selectionEnd: number;
  mode: BackspaceMode;
  maximumLength: number;
}) {
  if (nextValue.length > maximumLength) {
    return false;
  }

  const removedText = previousValue.slice(selectionStart, selectionEnd);
  if (!removedText) {
    return true;
  }
  if (mode === "full") {
    return true;
  }
  if (mode === "disabled") {
    return false;
  }

  return !/\s/.test(removedText);
}
