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
  | "minorSpelling";

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
};

export const DEFAULT_SCORING_PROFILE: ScoringProfile = {
  fullErrorPenalty: 1,
  halfErrorPenalty: 0.5,
  minorSpellingMaxDistance: 1,
  passNetWpm: 35,
  passAccuracy: 90,
};

export type ErrorCategoryCounts = {
  missing: number;
  extra: number;
  repeated: number;
  substituted: number;
  capitalization: number;
  punctuation: number;
  spacing: number;
  minorSpelling: number;
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

function halfErrorCategories(
  original: WordToken,
  typed: WordToken,
  profile: ScoringProfile,
): HalfErrorCategory[] {
  const categories: HalfErrorCategory[] = [];
  if (original.normalizedCore === typed.normalizedCore) {
    if (profile.capitalizationErrors !== false && original.core !== typed.core) categories.push("capitalization");
    if (original.punctuation !== typed.punctuation) categories.push("punctuation");
    return categories;
  }
  if (
    editDistance(original.normalizedCore, typed.normalizedCore) <=
    profile.minorSpellingMaxDistance
  ) {
    categories.push("minorSpelling");
    if (original.core !== typed.core && original.core.toLocaleLowerCase("en") === typed.core.toLocaleLowerCase("en")) {
      if (profile.capitalizationErrors !== false) categories.push("capitalization");
    }
    if (original.punctuation !== typed.punctuation) categories.push("punctuation");
  }
  return categories;
}

function substitutionCost(
  original: WordToken,
  typed: WordToken,
  profile: ScoringProfile,
) {
  if (original.raw === typed.raw) return 0;
  return halfErrorCategories(original, typed, profile).length > 0 ? 0.45 : 1;
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
      entries.push({
        id: `o${original.index}-t${typed.index}`,
        status: original.raw === typed.raw ? "correct" : categories.length ? "half-error" : "substituted",
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
      originalWords[entry.originalIndex].separatorAfter !== typedWords[entry.typedIndex].separatorAfter
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
  const categoryCounts: ErrorCategoryCounts = { missing: 0, extra: 0, repeated: 0, substituted: 0, capitalization: 0, punctuation: 0, spacing: 0, minorSpelling: 0 };
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
  const halfErrors = categoryCounts.capitalization + categoryCounts.punctuation + categoryCounts.spacing + categoryCounts.minorSpelling;
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
