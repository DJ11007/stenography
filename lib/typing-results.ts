import { countSpaceWords, calculateTypingScore, type ScoringProfile, type TypingScore, type WordAnalysisEntry, type WordMethod } from "./typing-test.ts";
import { segmentGraphemes } from "./typing-language.ts";

export type ResultCalculation = {
  method: WordMethod;
  label: string;
  availableWords: number;
  typedWords: number;
  correctWords: number;
  incorrectWords: number;
  score: TypingScore;
  qualified: boolean;
};

export function comparisonWordDisplay(entry: WordAnalysisEntry) {
  return {
    text: entry.status === "missing" ? "" : entry.status === "remaining" ? entry.original ?? "" : entry.typed ?? entry.original ?? "",
    expected: entry.status === "missing" || entry.status === "substituted" || entry.status === "half-error" ? entry.original : undefined,
  };
}

export function buildResultSummary(passage: string, score: TypingScore, backspaces: number) {
  const { counts, categoryCounts } = score.analysis;
  const elapsedMinutes = Math.max(score.elapsedSeconds / 60, 1 / 60);
  const totalWordsTyped = counts.correct + counts.substituted + counts.extra + counts.repeated + counts.halfError;
  return {
    totalCharacters: segmentGraphemes(passage).length,
    typedCharacters: score.totalCharacters,
    rightCharacters: score.correctCharacters,
    wrongCharacters: score.incorrectCharacters,
    accuracy: score.accuracy,
    errorPercentage: Math.min(100, Math.max(0, 100 - score.accuracy)),
    passageWords: countSpaceWords(passage),
    totalWordsTyped,
    correctWordsTyped: counts.correct,
    incorrectWordsTyped: counts.substituted + counts.extra + counts.repeated,
    substitutedWords: counts.substituted,
    addedWords: counts.extra,
    repeatedWords: counts.repeated,
    halfMistakeWords: counts.halfError,
    omittedWords: counts.missing,
    grossWpm: score.grossWpm,
    netWpm: score.netWpm,
    backspaces,
    fullMistakes: score.analysis.fullErrors,
    halfMistakes: score.analysis.halfErrors,
    fullCategories: { omissions: counts.missing, substitutions: counts.substituted, additions: counts.extra, repetitions: counts.repeated },
    halfCategories: { capitalization: categoryCounts.capitalization, punctuation: categoryCounts.punctuation, spacing: categoryCounts.spacing, spelling: categoryCounts.minorSpelling, matra: categoryCounts.matra, halant: categoryCounts.halant, gender: categoryCounts.gender, vachan: categoryCounts.vachan },
    remainingWords: score.analysis.remainingWords,
    remainingCharacters: score.analysis.remainingCharacters,
    passed: score.passed,
    elapsedSeconds: score.elapsedSeconds,
    grossWordsPerMinute: totalWordsTyped / elapsedMinutes,
    grossCharactersPerMinute: score.totalCharacters / elapsedMinutes,
    grossKeystrokesPerHour: score.totalCharacters / elapsedMinutes * 60,
    netWordsPerMinute: counts.correct / elapsedMinutes,
    netCharactersPerMinute: score.correctCharacters / elapsedMinutes,
    netKeystrokesPerHour: score.correctCharacters / elapsedMinutes * 60,
    penaltyAdjustedNetWpm: score.netWpm,
  };
}

export function calculateConfiguredRssbMarks(score: TypingScore, method: NonNullable<import("./typing-curriculum.ts").ExamPreset["marksMethod"]>) {
  const durationMatches = score.elapsedSeconds === method.requiredDurationSeconds;
  const marksObtained = Math.min(method.maximumMarks, score.analysis.counts.correct * method.marksPerCorrectWord);
  return {
    durationMatches,
    maximumMarks: method.maximumMarks,
    minimumPassingMarks: method.minimumPassingMarks,
    marksPerCorrectWord: method.marksPerCorrectWord,
    correctWords: score.analysis.counts.correct,
    marksObtained: Math.round(marksObtained * 100) / 100,
    qualified: marksObtained >= method.minimumPassingMarks,
    durationWarning: durationMatches ? null : `This marks calculation is designed for a 10-minute configured typing test. This attempt used ${formatElapsedDuration(score.elapsedSeconds)}, so compare it cautiously.`,
  };
}

function formatElapsedDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function buildResultCalculations(args: {
  passage: string;
  typedText: string;
  elapsedSeconds: number;
  scoringProfile: ScoringProfile;
}) {
  return (["characters", "spaces"] as WordMethod[]).map((method): ResultCalculation => {
    const score = calculateTypingScore({ ...args, wordMethod: method, includeUntypedWords: true });
    return {
      method,
      label: method === "characters" ? "Character-based calculation (5 characters = 1 word)" : "Space-separated word calculation",
      availableWords: method === "characters" ? segmentGraphemes(args.passage).length / 5 : countSpaceWords(args.passage),
      typedWords: method === "characters" ? score.totalCharacters / 5 : score.spaceWords,
      correctWords: score.correctWords,
      incorrectWords: score.analysis.counts.substituted + score.analysis.counts.extra + score.analysis.counts.repeated,
      score,
      qualified: score.netWpm >= args.scoringProfile.passNetWpm && score.accuracy >= args.scoringProfile.passAccuracy,
    };
  });
}

export function buildRequirementResults(score: TypingScore, requiredWpm: number, requiredAccuracy: number) {
  return [
    { key: "speed", label: "Net speed", actual: score.netWpm, required: requiredWpm, unit: "WPM", passed: score.netWpm >= requiredWpm },
    { key: "accuracy", label: "Accuracy", actual: score.accuracy, required: requiredAccuracy, unit: "%", passed: score.accuracy >= requiredAccuracy },
  ];
}

export function resultCategoryTotals(score: TypingScore, backspaces: number, profile: ScoringProfile) {
  const { counts, categoryCounts } = score.analysis;
  return [
    { key: "correct", label: "Correct", count: counts.correct, penalty: 0, tone: "green" },
    { key: "substitution", label: "Substitution", count: counts.substituted, penalty: counts.substituted * profile.fullErrorPenalty, tone: "red" },
    { key: "missing", label: "Missing", count: counts.missing, penalty: counts.missing * profile.fullErrorPenalty, tone: "orange" },
    { key: "repeated", label: "Repeated", count: counts.repeated, penalty: counts.repeated * profile.fullErrorPenalty, tone: "rose" },
    { key: "extra", label: "Extra", count: counts.extra, penalty: counts.extra * profile.fullErrorPenalty, tone: "blue" },
    { key: "full", label: "Full error", count: score.analysis.fullErrors, penalty: score.analysis.fullErrors * profile.fullErrorPenalty, tone: "red" },
    { key: "half", label: "Half error", count: score.analysis.halfErrors, penalty: score.analysis.halfErrors * profile.halfErrorPenalty, tone: "purple" },
    { key: "capitalization", label: "Capitalization", count: categoryCounts.capitalization, penalty: categoryCounts.capitalization * profile.halfErrorPenalty, tone: "purple" },
    { key: "punctuation", label: "Punctuation", count: categoryCounts.punctuation, penalty: categoryCounts.punctuation * profile.halfErrorPenalty, tone: "purple" },
    { key: "spacing", label: "Spacing", count: categoryCounts.spacing, penalty: categoryCounts.spacing * profile.halfErrorPenalty, tone: "purple" },
    { key: "minorSpelling", label: "Minor spelling", count: categoryCounts.minorSpelling, penalty: categoryCounts.minorSpelling * profile.halfErrorPenalty, tone: "purple" },
    { key: "matra", label: "Matra (vowel sign)", count: categoryCounts.matra, penalty: categoryCounts.matra * profile.halfErrorPenalty, tone: "purple" },
    { key: "halant", label: "Halant (viram)", count: categoryCounts.halant, penalty: categoryCounts.halant * profile.halfErrorPenalty, tone: "purple" },
    { key: "gender", label: "Gender", count: categoryCounts.gender, penalty: categoryCounts.gender * profile.halfErrorPenalty, tone: "purple" },
    { key: "vachan", label: "Vachan (number)", count: categoryCounts.vachan, penalty: categoryCounts.vachan * profile.halfErrorPenalty, tone: "purple" },
    { key: "backspaces", label: "Backspaces", count: backspaces, penalty: 0, tone: "slate" },
  ] as const;
}

export function categoryTotalsReconcile(score: TypingScore, profile: ScoringProfile) {
  const expected = score.analysis.fullErrors * profile.fullErrorPenalty + score.analysis.halfErrors * profile.halfErrorPenalty;
  return Math.abs(expected - score.analysis.totalPenalty) < Number.EPSILON;
}
