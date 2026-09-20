"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { getExamPreset, type ExamPreset } from "@/lib/typing-curriculum";
import { EXAM_CATEGORIES, examCategoryPresetId, type ExamCategoryDefinition } from "@/lib/exam-categories";
import { segmentGraphemes, type InputSystem } from "@/lib/typing-language";
import { buildErrorGuide, guidePenaltyTotal, type ErrorGuideDefinition } from "@/lib/typing-error-guide";
import { buildResultSummary, calculateConfiguredRssbMarks, comparisonWordDisplay, resultCategoryTotals } from "@/lib/typing-results";
import { ALL_HALF_ERROR_CATEGORIES, activeHalfErrorCategories, calculateTypingScore, entryMistakeUnits, HALF_ERROR_CATEGORY_LABELS as CATEGORY_LABELS, type TypingScore, type WordAnalysisEntry } from "@/lib/typing-test";
import { TypingBrandHeader } from "./typing-brand";
import { useTypingStudent } from "./typing-student-provider";

type ResultTab = "combined" | "original" | "typed" | "errors" | "categories" | "self";
type Props = { preset: ExamPreset; inputSystem: InputSystem; passage: string; typedText: string; score: TypingScore; backspaces: number; onRestart: () => void; returnHref?: string; returnLabel?: string; mode: "practice" | "exam" };
const number = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
const TABS: [ResultTab, string][] = [["combined", "Combined Analysis"], ["original", "Original Passage"], ["typed", "Typed Passage"], ["errors", "Errors Only"], ["categories", "Category Analysis"], ["self", "Self Analysis"]];
const toneClasses: Record<string, string> = { green: "border-green-200 bg-green-50 text-green-900", red: "border-red-200 bg-red-50 text-red-900", rose: "border-rose-200 bg-rose-50 text-rose-950", orange: "border-orange-200 bg-orange-50 text-orange-950", blue: "border-blue-200 bg-blue-50 text-blue-900", purple: "border-purple-200 bg-purple-50 text-purple-900", slate: "border-slate-200 bg-slate-50 text-slate-900" };

export function AdvancedTypingResults({ preset, inputSystem, passage, typedText, score, backspaces, onRestart, returnHref = "/typing/exams", returnLabel = "Return to Tests", mode }: Props) {
  const [tab, setTab] = useState<ResultTab>("combined");
  const [selectedError, setSelectedError] = useState<WordAnalysisEntry | null>(null);
  const [practicePassage, setPracticePassage] = useState("");
  const resultPanelRef = useRef<HTMLDivElement>(null);
  // score.analysis.entries is already display-ready Unicode for every input
  // encoding, Kruti Dev included: calculateTypingScore() itself now receives
  // decoded text for Kruti Dev tests (see getScoringText() in
  // typing-language.ts), so entry.original/entry.typed are the actual
  // Devanagari words, not raw legacy bytes any more. Re-decoding them here a
  // second time (the previous behavior) would corrupt anything that
  // survived into the decoded text but is also a legacy-significant
  // character on its own -- e.g. a literal comma, which the legacy
  // dictionary maps to "ए", turning "ज्ञान," into "ज्ञानए".
  const displayEntries = score.analysis.entries;
  const categories = useMemo(() => buildCategories(displayEntries, preset.scoringProfile.fullErrorPenalty, preset.scoringProfile.halfErrorPenalty), [displayEntries, preset.scoringProfile]);
  // Stenography grades Hindi-grammar-specific categories (matra/halant/
  // gender/vachan) that a plain typing test never does (see
  // halfErrorCategories() in typing-test.ts -- those flags stay undefined
  // outside a stenography scoring profile, so their counts are always
  // exactly 0 for typing). Showing them anyway on every typing result was
  // the reported "stenography's display method leaking into typing"
  // bug -- these tiles/rows are stenography-only from here on.
  const isStenography = preset.category === "stenography";
  const STENOGRAPHY_ONLY_CATEGORY_KEYS = new Set(["matra", "halant", "gender", "vachan"]);
  const totals = resultCategoryTotals(score, backspaces, preset.scoringProfile).filter((item) => isStenography || !STENOGRAPHY_ONLY_CATEGORY_KEYS.has(item.key));
  const mistakes = useMemo(() => displayEntries.filter((entry) => entry.status !== "correct" && entry.status !== "remaining"), [displayEntries]);
  const weakWords = useMemo(() => repeatedWords(mistakes), [mistakes]);
  const weakCharacters = useMemo(() => repeatedCharacters(mistakes), [mistakes]);
  const fontFamily = inputSystem.inputEncoding === "krutidev-legacy" ? '"Nirmala UI", Mangal, "Noto Sans Devanagari", sans-serif' : inputSystem.fontStack;
  const textLanguage = inputSystem.language === "Hindi" ? "hi" : "en";
  const marksResult = preset.marksMethod ? calculateConfiguredRssbMarks(score, preset.marksMethod) : null;
  const resultLabel = marksResult ? marksResult.qualified ? "Qualified" : "Not Qualified" : score.passed ? "Pass" : "Fail";
  const resultPassed = marksResult ? marksResult.qualified : score.passed;
  const summary = buildResultSummary(passage, score, backspaces);
  const createPractice = () => { const words = weakWords.map((item) => item.text).filter(Boolean); setPracticePassage(words.length ? Array.from({ length: 3 }, () => words.join(" ")).join(". ") : "No mistakes are available for focused practice."); setTab("self"); };
  const student = useTypingStudent();
  const gradedCategories = activeHalfErrorCategories(preset.scoringProfile);
  // AIIMS's "Insufficient Attempt" rule (ScoringProfile.minimumStrokesFrom
  // PassSpeed): the official evaluation checks accuracy at all only once
  // gross keystrokes reach what the required qualifying pace would
  // produce over the full duration -- e.g. 35 WPM x 5 strokes/word x 15
  // minutes = 2625 for English. Deliberately kept out of TypingScore/
  // analyzeTyping entirely (see that flag's own doc comment): it can
  // never flip passed, so it's safe to compute here from data already in
  // scope, gated to mode !== "practice" like ErrorScoringGuide already is.
  const minimumStrokesRequired = Math.round(preset.scoringProfile.passNetWpm * 5 * (Math.max(preset.durationSeconds, score.elapsedSeconds) / 60));
  const insufficientAttempt = Boolean(preset.scoringProfile.minimumStrokesFromPassSpeed) && mode !== "practice" && score.totalCharacters < minimumStrokesRequired;
  return <main className="min-h-screen bg-slate-100 text-slate-950 print:bg-white"><TypingBrandHeader/><section className="mx-auto max-w-[1500px] px-3 py-6 sm:px-5 sm:py-8 print:max-w-none print:p-0 [&>:first-child]:mt-0">
    {gradedCategories.length < ALL_HALF_ERROR_CATEGORIES.length && <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-900 print:hidden">Graded for this attempt: {gradedCategories.length ? gradedCategories.map((category) => CATEGORY_LABELS[category]).join(", ") : "wrong, missing, extra, and repeated words only"}. Wrong, missing, extra, and repeated words are always graded.</p>}
    {isStenography ? (
      // Stenography gets its own, single continuous evaluation report --
      // not the typing simulator's character-count summary cards or its
      // 7-tab browsing UI (Combined/Original/Typed/Errors/Category/Self
      // Analysis). A real stenography evaluation is read start-to-finish
      // once: result, then word-based stats, then every graded category
      // (including the Hindi-grammar ones above), then the full corrected
      // passage -- reusing the same underlying data/components as the
      // typing layout below, just assembled and labeled for a dictation
      // transcript instead of a typing drill.
      <>
        <StenographyHeader title={preset.title} studentName={student.name}/>
        {insufficientAttempt
          ? <InsufficientAttemptBanner title={preset.title} minimumStrokes={minimumStrokesRequired} achievedStrokes={score.totalCharacters}/>
          : <ResultBanner label={resultLabel} passed={resultPassed} title={preset.title} requiredWpm={preset.speedRequirement} achievedWpm={summary.netWpm} requiredAccuracy={preset.accuracyRequirement} achievedAccuracy={summary.accuracy}/>}
        <StenographyStatsTables summary={summary}/>
        <DetailedResultBreakdown summary={summary} isStenography/>
        <KeyDepressionSpeedDetails summary={summary} profile={preset.scoringProfile}/>
        <CategoryStrip categories={totals}/>
        <ComparisonTextPanel entries={displayEntries} fontFamily={fontFamily} textLanguage={textLanguage} onSelect={setSelectedError}/>
        {selectedError && <ErrorDetail entry={selectedError} profile={preset.scoringProfile} fontFamily={fontFamily} textLanguage={textLanguage} onClose={() => setSelectedError(null)}/>}
        {mode !== "practice" && <ErrorScoringGuide profile={preset.scoringProfile} textLanguage={textLanguage} entries={score.analysis.entries} savedPenalty={score.analysis.totalPenalty}/>}
        <section className="mt-6 rounded-3xl bg-white p-4 shadow sm:p-7"><h2 className="text-xl font-black">Category Analysis</h2><div className="mt-5"><CategoryAnalysis categories={categories} fullErrors={score.analysis.fullErrors} halfErrors={score.analysis.halfErrors} fontFamily={fontFamily} textLanguage={textLanguage}/></div></section>
        <section className="mt-6 rounded-3xl bg-white p-4 shadow sm:p-7"><h2 className="text-xl font-black">Self Analysis</h2><div className="mt-5"><SelfAnalysis repeated={score.analysis.topRepeatedMistakes} weakWords={weakWords} weakCharacters={weakCharacters} practicePassage={practicePassage} fontFamily={fontFamily} textLanguage={textLanguage}/></div></section>
      </>
    ) : (
      <>
        {marksResult && preset.marksMethod && <RssbMarksPanel result={marksResult} method={preset.marksMethod} language={preset.language}/>}
        {/* Real reported feedback: the character-based summary cards, the
            word-based "Detailed Result" + mistake-breakdown boxes, and the
            category tile strip all repeated the same accuracy/speed/error
            numbers three different ways -- "mix match everything" -- when
            the WPM/KDPH-toggle Speed Details panel below is already the
            one authoritative source for speed, and the tabs (Category
            Analysis, Errors Only, ...) already give word-level detail.
            Non-RSSB typing results now show just the pass/fail banner and
            Speed Details before the tabs; the RSSB marks-method path keeps
            its own already-non-redundant RssbSpeedDetails display (its
            separate RssbTypingDetails word-count breakdown was later
            merged into RssbSpeedDetails itself -- see that component). */}
        {marksResult ? <><RssbSpeedDetails summary={summary}/><ComparisonTextPanel entries={displayEntries} fontFamily={fontFamily} textLanguage={textLanguage} onSelect={setSelectedError}/></> : mode === "practice" ? <MethodBasedSpeedDetails summary={summary} passage={passage} typedText={typedText} backspaces={backspaces} language={inputSystem.language}/> : <>{insufficientAttempt ? <InsufficientAttemptBanner title={preset.title} minimumStrokes={minimumStrokesRequired} achievedStrokes={score.totalCharacters}/> : <ResultBanner label={resultLabel} passed={resultPassed} title={preset.title} requiredWpm={preset.speedRequirement} achievedWpm={summary.netWpm} requiredAccuracy={preset.accuracyRequirement} achievedAccuracy={summary.accuracy}/>}<KeyDepressionSpeedDetails summary={summary} profile={preset.scoringProfile}/></>}
        {/* RSSB's marks method has no negative marking, so this penalty-based guide would misstate its rules. Practice attempts aren't following any specific exam's official rules at all, so the guide is dropped there entirely rather than shown with blanked-out values. */}
        {!marksResult && mode !== "practice" && <ErrorScoringGuide profile={preset.scoringProfile} textLanguage={textLanguage} entries={score.analysis.entries} savedPenalty={score.analysis.totalPenalty}/>}
        <section className="mt-6 rounded-3xl bg-white p-4 shadow sm:p-7">
          <div className="flex items-center justify-between gap-2 border-b">
            <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Result views">{TABS.map(([id,label]) => <button key={id} id={`tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`} onClick={() => setTab(id)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold ${tab === id ? "border-blue-700 text-blue-800" : "border-transparent text-slate-500"}`}>{label}</button>)}</div>
            {/* Real requested feature: a downward arrow at the top-right of
                this section, so a student who just scrolled past the
                summary panels above (Speed Details, the Scoring Guide, ...)
                has an obvious way to jump straight down into the detailed
                passage-by-passage result instead of hunting for it. */}
            <button type="button" onClick={() => resultPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} aria-label="Jump to detailed result" title="Jump to detailed result" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 print:hidden"><ChevronIcon/></button>
          </div>
          <div id={`panel-${tab}`} ref={resultPanelRef} role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-6">
          {tab === "combined" && <PassageFlow entries={displayEntries} onSelect={setSelectedError} fontFamily={fontFamily} textLanguage={textLanguage}/>} {tab === "original" && <PassageFlow entries={displayEntries.filter((entry) => entry.status !== "extra" && entry.status !== "repeated")} onSelect={setSelectedError} fontFamily={fontFamily} textLanguage={textLanguage}/>} {tab === "typed" && (typedText ? <PassageFlow entries={displayEntries.filter((entry) => entry.status !== "missing" && entry.status !== "remaining")} onSelect={setSelectedError} fontFamily={fontFamily} textLanguage={textLanguage}/> : <PassageText text="No text was entered." fontFamily={fontFamily} textLanguage={textLanguage}/>)} {tab === "errors" && <PassageFlow entries={mistakes} onSelect={setSelectedError} fontFamily={fontFamily} textLanguage={textLanguage}/>} {tab === "categories" && <CategoryAnalysis categories={categories} fullErrors={score.analysis.fullErrors} halfErrors={score.analysis.halfErrors} fontFamily={fontFamily} textLanguage={textLanguage}/>} {tab === "self" && <SelfAnalysis repeated={score.analysis.topRepeatedMistakes} weakWords={weakWords} weakCharacters={weakCharacters} practicePassage={practicePassage} fontFamily={fontFamily} textLanguage={textLanguage}/>}
        </div>{selectedError && <ErrorDetail entry={selectedError} profile={preset.scoringProfile} fontFamily={fontFamily} textLanguage={textLanguage} onClose={() => setSelectedError(null)}/>}</section>
      </>
    )}
    <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden"><button type="button" onClick={onRestart} className="rounded-xl bg-blue-700 px-5 py-3 font-black text-white">Try Again</button><button type="button" onClick={createPractice} className="rounded-xl bg-purple-700 px-5 py-3 font-black text-white">Practice Mistakes</button><button type="button" onClick={() => window.print()} className="rounded-xl bg-slate-800 px-5 py-3 font-black text-white">Print / Save PDF</button><Link href={returnHref} className="rounded-xl border border-blue-700 bg-white px-5 py-3 text-center font-black text-blue-800">{returnLabel}</Link></section>
  </section></main>;
}

function formatDuration(seconds: number) { const safe = Math.max(0, Math.round(seconds)); const hours = Math.floor(safe / 3600); const minutes = Math.floor((safe % 3600) / 60); const remainder = safe % 60; return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}` : `${minutes}:${String(remainder).padStart(2, "0")}`; }
// Stenography's report leads with a single, unambiguous pass/fail verdict
// (a real evaluation sheet is read once, top to bottom, not browsed via
// tabs like a typing drill) before any of the word-count or category detail
// below it.
// Real reported feedback: a failing result only ever said "did not meet
// the required speed and accuracy" with no actual numbers -- a student
// had no way to tell how close they were or what to improve. Required/
// achieved values are optional so every existing call site (stenography,
// which has its own dual-accuracy tables instead) keeps working
// unchanged; when both are supplied and the attempt failed, this renders
// the concrete gap instead of the generic sentence.
function ResultBanner({ label, passed, title, requiredWpm, achievedWpm, requiredAccuracy, achievedAccuracy }: { label: string; passed: boolean; title: string; requiredWpm?: number; achievedWpm?: number; requiredAccuracy?: number; achievedAccuracy?: number }) {
  const wpmGap = !passed && requiredWpm != null && achievedWpm != null ? Math.max(0, requiredWpm - achievedWpm) : 0;
  const accuracyGap = !passed && requiredAccuracy != null && achievedAccuracy != null ? Math.max(0, requiredAccuracy - achievedAccuracy) : 0;
  const gapParts = [wpmGap > 0 ? `${number(wpmGap)} more net WPM` : null, accuracyGap > 0 ? `${number(accuracyGap)}% more accuracy` : null].filter((part): part is string => Boolean(part));
  const message = passed
    ? "This attempt met the required speed and accuracy."
    : gapParts.length
      ? `To pass, you need ${gapParts.join(" and ")}. Review the mistakes below and try again.`
      : "This attempt did not meet the required speed and accuracy. Review the mistakes below and try again.";
  return <section aria-live="polite" className={`mt-6 rounded-3xl p-6 text-center shadow sm:p-8 ${passed ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}><p className="text-xs font-black uppercase tracking-[.2em] opacity-90">{title}</p><p className="mt-2 text-3xl font-black sm:text-4xl">{label}</p><p className="mt-2 text-sm font-bold opacity-90">{message}</p></section>;
}
// AIIMS-style "Insufficient Attempt" rule: below a minimum keystroke
// threshold, the official evaluation doesn't check accuracy at all --
// shown instead of the normal Pass/Fail banner. Never changes the stored
// verdict (falling short of the required pace already implies passed
// === false), purely a clearer label plus the concrete numbers.
function InsufficientAttemptBanner({ title, minimumStrokes, achievedStrokes }: { title: string; minimumStrokes: number; achievedStrokes: number }) {
  return <section aria-live="polite" className="mt-6 rounded-3xl bg-amber-500 p-6 text-center text-white shadow sm:p-8"><p className="text-xs font-black uppercase tracking-[.2em] opacity-90">{title}</p><p className="mt-2 text-3xl font-black sm:text-4xl">Insufficient Attempt</p><p className="mt-2 text-sm font-bold opacity-90">This exam's official evaluation needs at least {number(minimumStrokes)} keystrokes before accuracy is even checked -- this attempt had {number(achievedStrokes)}. Type more of the passage and try again.</p></section>;
}
// Candidate/matter identification line, the same way a real evaluation
// sheet is headed by whose attempt and which passage this is -- pulled
// from context (useTypingStudent) rather than a new prop, since
// TypingBrandHeader inside this same component already requires that
// context to be present everywhere AdvancedTypingResults is used.
function StenographyHeader({ title, studentName }: { title: string; studentName: string }) { return <section className="rounded-3xl bg-white p-4 shadow sm:p-5"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Stenography attempt review</p><h1 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">{title}</h1><p className="mt-1 text-sm font-bold text-slate-600">{studentName}</p></section>; }
// Two different, both-legitimate accuracy readings on the same attempt --
// the same distinction a real stenography evaluation sheet draws by
// showing "words wrong" both counted against the full dictated passage
// (harsher: an unattempted remainder counts against you) and counted only
// against what was actually typed (a truer measure of transcription
// accuracy for what you did attempt). Both derive from figures
// buildResultSummary already computes -- no new scoring logic.
function StenographyStatsTables({ summary }: { summary: ReturnType<typeof buildResultSummary> }) {
  const pct = (numerator: number, denominator: number) => denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
  const tables = [
    { title: "Accuracy against full passage", wrong: Math.max(0, summary.passageWords - summary.correctWordsTyped), accuracyPct: pct(summary.correctWordsTyped, summary.passageWords) },
    { title: "Accuracy against typed words", wrong: Math.max(0, summary.totalWordsTyped - summary.correctWordsTyped), accuracyPct: pct(summary.correctWordsTyped, summary.totalWordsTyped) },
  ];
  return <section className="mt-6 grid gap-4 lg:grid-cols-2">{tables.map((table) => { const errorPct = Math.round((100 - table.accuracyPct) * 10) / 10; return <div key={table.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow"><p className="bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-wide text-white">{table.title}</p><div className="grid grid-cols-3 divide-x divide-y divide-slate-200 text-center">{[["Total words", summary.passageWords], ["Typed words", summary.totalWordsTyped], ["Wrong words", table.wrong], ["Correct words", summary.correctWordsTyped], ["Accuracy", `${table.accuracyPct}%`], ["Error", `${errorPct}%`]].map(([label, value]) => <div key={label as string} className="p-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-lg font-black text-slate-950">{value}</p></div>)}</div></div>; })}</section>;
}
function RssbMarksPanel({ result, method, language }: { result: ReturnType<typeof calculateConfiguredRssbMarks>; method: NonNullable<ExamPreset["marksMethod"]>; language: ExamPreset["language"] }) { return <section aria-labelledby="rssb-marks-title" className="mt-6 rounded-3xl border border-amber-200 bg-white p-4 shadow sm:p-5"><p className="text-xs font-black uppercase tracking-[.18em] text-amber-700">Third-party reference method · not officially verified</p><h2 id="rssb-marks-title" className="mt-1 text-xl font-black text-slate-950">Configured Marks Method</h2><dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"><ResultMetric label="Maximum Marks" value={method.maximumMarks.toFixed(2)}/><ResultMetric label="Minimum Passing Marks" value={method.minimumPassingMarks.toFixed(2)}/><ResultMetric label="Marks Obtained" value={result.marksObtained.toFixed(2)}/><ResultMetric label="Final Result" value={result.qualified ? "Qualified" : "Not Qualified"}/><ResultMetric label="Correct words used for marks" value={String(result.correctWords)}/><ResultMetric label="Rate per correct word" value={`${method.marksPerCorrectWord} mark${method.marksPerCorrectWord === 1 ? "" : "s"}`}/></dl>{result.durationWarning && <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{result.durationWarning}</p>}<details className="group mt-4 rounded-2xl bg-slate-50"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-black text-slate-900"><span>Rules and Instructions</span><ChevronIcon/></summary><ul className="list-disc space-y-2 px-9 pb-4 pt-1 text-sm text-slate-700"><li>English typing awards 0.05 marks for each correct word.</li><li>Hindi typing awards 0.0625 marks for each correct word.</li><li>The marks method is designed for an exact 10-minute attempt; shorter or longer attempts still show marks with a caution.</li><li>English uses a 500-word limit.</li><li>Hindi uses a 400-word limit.</li><li>This {language} result uses only fully correct words; errors and remaining words receive no marks.</li></ul></details></section>; }
function ChevronIcon({ light = false }: { light?: boolean }) { return <svg aria-hidden viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 transition-transform group-open:rotate-180 ${light ? "text-white" : "text-slate-500"}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>; }
function ResultMetric({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><dt className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-0.5 truncate text-sm font-black text-slate-950" title={value}>{value}</dd></div>; }
// Real reported feedback: "Typing Details" (the word-count breakdown) and
// "Speed Details" (the WPM/KPM-toggle speed figures) rendered as two
// separate sections, one above the other -- the word breakdown "should
// come in wpm section", and "if anyone clicks on kpm all the information
// should [be] there" too. Merged into one section: the word/backspace
// breakdown is always visible (it doesn't change with the unit toggle),
// with only the speed-specific metrics switching between WPM and KPM.
function RssbSpeedDetails({ summary }: { summary: ReturnType<typeof buildResultSummary> }) {
  const [unit, setUnit] = useState<"wpm" | "kpm">("wpm");
  const speedMetrics = unit === "wpm"
    ? [["Gross Speed (WPM)", `${summary.grossWordsPerMinute.toFixed(2)} WPM`], ["Net Speed (WPM)", `${summary.netWordsPerMinute.toFixed(2)} WPM`]]
    : [["Gross Speed (CPM / KPM)", `${summary.grossCharactersPerMinute.toFixed(2)} CPM`], ["Gross KDPH", summary.grossKeystrokesPerHour.toFixed(0)], ["Net Speed (CPM / KPM)", `${summary.netCharactersPerMinute.toFixed(2)} CPM`], ["Net KDPH", summary.netKeystrokesPerHour.toFixed(0)]];
  // Real reported feedback: the word-count grid used to list Substitutions,
  // Additions, Repeated words, Omitted words and Half-mistake words all in
  // one flat, unlabeled row alongside neutral counts like Passage words and
  // Backspaces -- a student had no way to tell which numbers were "full"
  // mistakes, which were "half" mistakes, and which weren't mistakes at
  // all. Split into a neutral Overview strip plus the same red/purple
  // Full-mistakes / Half-mistakes breakdown cards used elsewhere in this
  // file (MistakeBreakdown), so the grouping is unambiguous at a glance
  // instead of requiring a trip to the Errors tab (which used to show this
  // same breakdown a second time -- now shown once, here).
  const overviewRows = [["Passage words",summary.passageWords],["Total words typed",summary.totalWordsTyped],["Fully correct words",summary.correctWordsTyped],["Remaining / unattempted words",summary.remainingWords],["Backspaces",summary.backspaces]] as const;
  return <section aria-labelledby="speed-details-title" className="mt-6 rounded-3xl bg-white p-4 shadow sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="speed-details-title" className="text-lg font-black">Speed Details</h2>
      <div role="group" aria-label="Speed unit" className="flex h-9 overflow-hidden rounded-lg border border-slate-300 text-xs font-black">
        <button type="button" aria-pressed={unit === "wpm"} onClick={() => setUnit("wpm")} className={`px-3 ${unit === "wpm" ? "bg-blue-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>WPM</button>
        <button type="button" aria-pressed={unit === "kpm"} onClick={() => setUnit("kpm")} className={`border-l border-slate-300 px-3 ${unit === "kpm" ? "bg-blue-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>KPM</button>
      </div>
    </div>
    <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{speedMetrics.map(([label,value]) => <ResultMetric key={label} label={label} value={value}/>)}</dl>
    <h3 className="mt-5 text-xs font-black uppercase tracking-wide text-slate-500">Overview</h3>
    <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">{overviewRows.map(([label,value]) => <ResultMetric key={label} label={label} value={String(value)}/>)}</dl>
    <div className="mt-3 grid gap-3 lg:grid-cols-2">
      <MistakeBreakdown title="Full mistakes" total={summary.fullMistakes} items={[["Substitutions",summary.fullCategories.substitutions],["Additions",summary.fullCategories.additions],["Repetitions",summary.fullCategories.repetitions],["Omissions",summary.fullCategories.omissions]]} tone="red"/>
      <MistakeBreakdown title="Half mistakes" total={summary.halfMistakes} items={[["Capitalization",summary.halfCategories.capitalization],["Punctuation",summary.halfCategories.punctuation],["Spacing",summary.halfCategories.spacing],["Spelling",summary.halfCategories.spelling]]} tone="purple"/>
    </div>
    <p className="mt-3 rounded-xl bg-slate-50 p-2.5 text-xs font-bold text-slate-600">Full mistakes are wrong, missing, extra, or repeated words. Half mistakes are smaller slips -- capitalization, punctuation, spacing, or minor spelling.</p>
    <div className="mt-4 space-y-1.5 rounded-2xl bg-slate-50 p-3 text-xs text-slate-700"><p><strong>Gross WPM:</strong> total words typed ÷ elapsed minutes. <strong>Gross CPM:</strong> typed characters ÷ elapsed minutes.</p><p><strong>Net WPM:</strong> fully correct words ÷ elapsed minutes. <strong>Net CPM:</strong> correctly typed characters ÷ elapsed minutes.</p><p><strong>Configured penalty-adjusted net speed:</strong> {number(summary.penaltyAdjustedNetWpm)} WPM = configured gross method − weighted full/half penalties per elapsed minute, minimum zero.</p></div>
  </section>;
}
// Real reported request: several boards (NCERT, SSC, DDA...) publish their
// speed requirement in KDPH (key depressions per hour), not just WPM --
// e.g. NCERT's "35 WPM corresponds to 10,500 KDPH" -- on the standard
// convention of 5 key depressions per word (WPM x 5 x 60 = KDPH). Derived
// directly from summary.grossWpm/netWpm (the same numbers already shown
// above as Gross/Net Speed, already computed with this test's own
// configured mistake penalty) rather than raw character counts, so this
// never shows a second, different "net speed" alongside the first one --
// unlike RssbSpeedDetails above, whose own Net WPM is deliberately the
// additive correct-words-only figure because RSSB's marks method has no
// penalty at all. Hidden for Practice, which isn't following any specific
// board's published benchmark.
// Real reported feedback (a student's Exercise-29 review): this panel
// used to show only Gross/Net speed, with no indication anywhere of which
// numbers were full mistakes, which were half mistakes, or how many
// mistakes there even were -- gains the exact same Overview strip +
// red/purple MistakeBreakdown cards RssbSpeedDetails already has, reusing
// that component rather than duplicating it, for every plain (non-RSSB)
// typing/exam result, not just AIIMS.
function KeyDepressionSpeedDetails({ summary, profile }: { summary: ReturnType<typeof buildResultSummary>; profile: ExamPreset["scoringProfile"] }) {
  const [unit, setUnit] = useState<"wpm" | "kdph">("wpm");
  const metrics = unit === "wpm"
    ? [["Gross Speed (WPM)", `${number(summary.grossWpm)} WPM`], ["Net Speed (WPM)", `${number(summary.netWpm)} WPM`]]
    : [["Gross Speed (KDPH)", number(summary.grossWpm * 300)], ["Net Speed (KDPH)", number(summary.netWpm * 300)]];
  const overviewRows = [["Passage words",summary.passageWords],["Total words typed",summary.totalWordsTyped],["Fully correct words",summary.correctWordsTyped],["Remaining / unattempted words",summary.remainingWords],["Backspaces",summary.backspaces]] as const;
  // AIIMS-style profiles (minorSpellingIsFullMistake) genuinely count
  // spelling as a full mistake, not half -- move the row to match where
  // it's actually counted, so the sub-items keep summing to the totals
  // shown above them instead of silently disagreeing for that one board.
  const spellingIsFull = Boolean(profile.minorSpellingIsFullMistake);
  const fullItems: [string, number][] = [["Substitutions",summary.fullCategories.substitutions],["Additions",summary.fullCategories.additions],["Repetitions",summary.fullCategories.repetitions],["Omissions",summary.fullCategories.omissions], ...(spellingIsFull ? ([["Spelling",summary.halfCategories.spelling]] as [string,number][]) : [])];
  const halfItems: [string, number][] = [["Capitalization",summary.halfCategories.capitalization],["Punctuation",summary.halfCategories.punctuation],["Spacing",summary.halfCategories.spacing], ...(spellingIsFull ? [] : ([["Spelling",summary.halfCategories.spelling]] as [string,number][]))];
  return <section aria-labelledby="kdph-speed-details-title" className="mt-6 rounded-3xl bg-white p-4 shadow sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="kdph-speed-details-title" className="text-lg font-black">Speed Details</h2>
      <div role="group" aria-label="Speed unit" className="flex h-9 overflow-hidden rounded-lg border border-slate-300 text-xs font-black">
        <button type="button" aria-pressed={unit === "wpm"} onClick={() => setUnit("wpm")} className={`px-3 ${unit === "wpm" ? "bg-blue-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>WPM</button>
        <button type="button" aria-pressed={unit === "kdph"} onClick={() => setUnit("kdph")} className={`border-l border-slate-300 px-3 ${unit === "kdph" ? "bg-blue-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>KDPH</button>
      </div>
    </div>
    <dl className="mt-3 grid grid-cols-2 gap-2">{metrics.map(([label,value]) => <ResultMetric key={label} label={label} value={value}/>)}</dl>
    <h3 className="mt-5 text-xs font-black uppercase tracking-wide text-slate-500">Overview</h3>
    <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">{overviewRows.map(([label,value]) => <ResultMetric key={label} label={label} value={String(value)}/>)}</dl>
    <div className="mt-3 grid gap-3 lg:grid-cols-2">
      <MistakeBreakdown title="Full mistakes" total={summary.fullMistakes} items={fullItems} tone="red"/>
      <MistakeBreakdown title="Half mistakes" total={summary.halfMistakes} items={halfItems} tone="purple"/>
    </div>
    <p className="mt-3 rounded-xl bg-slate-50 p-2.5 text-xs font-bold text-slate-600">Full mistakes are wrong, missing, extra, or repeated words{spellingIsFull ? ", including spelling errors for this exam" : ""}. Half mistakes are smaller slips -- capitalization, punctuation, spacing{spellingIsFull ? "" : ", or minor spelling"}.</p>
    <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs text-slate-700"><strong>KDPH</strong> (key depressions per hour) assumes 5 key depressions per word -- WPM × 5 × 60 -- the convention several boards (NCERT, SSC, DDA, and others) publish their speed requirement in, e.g. 35 WPM = 10,500 KDPH.</p>
  </section>;
}
// Real requested change: practice attempts aren't following any specific
// exam's official rules, so judging them Pass/Fail against a benchmark
// they were never trying to meet was reported as wrong -- "why you are
// showing in this practice test module fail or pass, this is only for
// practice". Replaces the Pass/Fail banner with two switchable, informal
// speed readings on the exact same attempt: Keystroke Based (1 word = 5
// keystrokes, the WPM convention most competitive-exam boards actually
// publish) and Word Based (1 word = a space-separated group of letters).
// Both numbers were already sitting unused in buildResultSummary
// (grossCharactersPerMinute/netCharactersPerMinute and
// grossWordsPerMinute/netWordsPerMinute are computed unconditionally,
// independent of whichever wordMethod the original score used) -- no
// rescoring needed, just surfacing the other convention's own numbers.
// Real requested follow-up: the two informal methods above answer "how
// fast was I" two different ways, but not "would I have qualified for
// exam X" -- the actual next thing asked for was previewing this exact
// same practice attempt against a REAL exam category's own official
// rules (speed/accuracy pass-fail, or a configured marks scheme where
// one exists), for any of the 25 researched categories, not just the one
// (if any) this practice passage happened to come from. Reuses
// getExamPreset()'s already-built scoringProfile/marksMethod for the
// chosen category exactly as a real exam attempt would -- no new scoring
// logic, just applying an existing category's real rules to different
// typed text. Grouped Central-or-other-state / Rajasthan State because
// that was the explicit ask ("central level exams and state level...
// only rajasthan government").
const isRajasthanCategory = (category: ExamCategoryDefinition) => category.slug.startsWith("rajasthan-") || category.slug.startsWith("rssb-");
function MethodBasedSpeedDetails({ summary, passage, typedText, backspaces, language }: { summary: ReturnType<typeof buildResultSummary>; passage: string; typedText: string; backspaces: number; language: "English" | "Hindi" }) {
  const [method, setMethod] = useState<"keystroke" | "word" | "exam">("keystroke");
  const [categorySlug, setCategorySlug] = useState(EXAM_CATEGORIES[0]!.slug);
  const grossWpm = method === "word" ? summary.grossWordsPerMinute : summary.grossCharactersPerMinute / 5;
  const netWpm = method === "word" ? summary.netWordsPerMinute : summary.netCharactersPerMinute / 5;
  const metrics: [string, string][] = [["Gross Speed", `${number(grossWpm)} WPM`], ["Net Speed", `${number(netWpm)} WPM`], ["Keystrokes per minute", number(grossWpm * 5)], ["KDPH", number(grossWpm * 300)]];
  const overviewRows = [["Passage words", summary.passageWords], ["Total words typed", summary.totalWordsTyped], ["Fully correct words", summary.correctWordsTyped], ["Remaining / unattempted words", summary.remainingWords], ["Backspaces", summary.backspaces]] as const;
  const centralCategories = useMemo(() => EXAM_CATEGORIES.filter((category) => !isRajasthanCategory(category)), []);
  const rajasthanCategories = useMemo(() => EXAM_CATEGORIES.filter(isRajasthanCategory), []);
  const category = EXAM_CATEGORIES.find((item) => item.slug === categorySlug) ?? EXAM_CATEGORIES[0]!;
  const categoryPreset = getExamPreset(examCategoryPresetId(category.slug, language));
  const categoryResult = useMemo(() => {
    if (method !== "exam" || !categoryPreset) return null;
    const categoryScore = calculateTypingScore({ typedText, passage, elapsedSeconds: summary.elapsedSeconds, wordMethod: categoryPreset.wordMethod, scoringProfile: categoryPreset.scoringProfile, includeUntypedWords: true });
    const categorySummary = buildResultSummary(passage, categoryScore, backspaces);
    const categoryMarks = categoryPreset.marksMethod ? calculateConfiguredRssbMarks(categoryScore, categoryPreset.marksMethod) : null;
    return { categoryScore, categorySummary, categoryMarks };
  }, [method, categoryPreset, typedText, passage, summary.elapsedSeconds, backspaces]);
  return <section aria-labelledby="method-result-title" className="mt-6 rounded-3xl bg-white p-4 shadow sm:p-5">
    <div className="flex flex-wrap gap-1 border-b" role="tablist" aria-label="Result method">
      <button type="button" role="tab" aria-selected={method === "keystroke"} onClick={() => setMethod("keystroke")} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold ${method === "keystroke" ? "border-blue-700 text-blue-800" : "border-transparent text-slate-500"}`}>Keystroke Based Result</button>
      <button type="button" role="tab" aria-selected={method === "word"} onClick={() => setMethod("word")} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold ${method === "word" ? "border-blue-700 text-blue-800" : "border-transparent text-slate-500"}`}>Word Based Result</button>
      <button type="button" role="tab" aria-selected={method === "exam"} onClick={() => setMethod("exam")} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold ${method === "exam" ? "border-blue-700 text-blue-800" : "border-transparent text-slate-500"}`}>Preview by Exam</button>
    </div>
    {method === "exam" ? <>
      <label className="mt-4 block text-xs font-bold text-slate-600">Preview this attempt under
        <select value={categorySlug} onChange={(event) => setCategorySlug(event.target.value)} className="input mt-1">
          <optgroup label="Central Level Exams">{centralCategories.map((item) => <option key={item.slug} value={item.slug}>{item.fullName}</option>)}</optgroup>
          <optgroup label="Rajasthan State Level Exams">{rajasthanCategories.map((item) => <option key={item.slug} value={item.slug}>{item.fullName}</option>)}</optgroup>
        </select>
      </label>
      <p className="mt-1 text-xs font-bold text-slate-500">This attempt was not taken as a {category.name} exam -- these are that exam's real rules applied to what you already typed, so you can see whether it would have qualified.</p>
      {categoryResult && categoryPreset && (categoryResult.categoryMarks && categoryPreset.marksMethod
        ? <><RssbMarksPanel result={categoryResult.categoryMarks} method={categoryPreset.marksMethod} language={categoryPreset.language} /><RssbSpeedDetails summary={categoryResult.categorySummary} /></>
        : <><ResultBanner label={categoryResult.categoryScore.passed ? "Pass" : "Fail"} passed={categoryResult.categoryScore.passed} title={category.fullName} requiredWpm={categoryPreset.speedRequirement} achievedWpm={categoryResult.categorySummary.netWpm} requiredAccuracy={categoryPreset.accuracyRequirement} achievedAccuracy={categoryResult.categorySummary.accuracy} /><KeyDepressionSpeedDetails summary={categoryResult.categorySummary} profile={categoryPreset.scoringProfile} /></>)}
    </> : <>
      <h2 id="method-result-title" className="mt-4 text-lg font-black">Speed Details</h2>
      <p className="mt-1 text-xs font-bold text-slate-500">{method === "keystroke" ? "1 word = 5 keystrokes" : "1 word = a group of letters separated by space"}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{metrics.map(([label, value]) => <ResultMetric key={label} label={label} value={value} />)}</dl>
      <h3 className="mt-5 text-xs font-black uppercase tracking-wide text-slate-500">Overview</h3>
      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">{overviewRows.map(([label, value]) => <ResultMetric key={label} label={label} value={String(value)} />)}</dl>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <MistakeBreakdown title="Full mistakes" total={summary.fullMistakes} items={[["Substitutions", summary.fullCategories.substitutions], ["Additions", summary.fullCategories.additions], ["Repetitions", summary.fullCategories.repetitions], ["Omissions", summary.fullCategories.omissions]]} tone="red" />
        <MistakeBreakdown title="Half mistakes" total={summary.halfMistakes} items={[["Capitalization", summary.halfCategories.capitalization], ["Punctuation", summary.halfCategories.punctuation], ["Spacing", summary.halfCategories.spacing], ["Spelling", summary.halfCategories.spelling]]} tone="purple" />
      </div>
      <p className="mt-3 rounded-xl bg-slate-50 p-2.5 text-xs font-bold text-slate-600">Full mistakes are wrong, missing, extra, or repeated words. Half mistakes are smaller slips -- capitalization, punctuation, spacing, or minor spelling. Neither method here is any specific exam's official rule -- switch between them to see how this same attempt reads either way.</p>
    </>}
  </section>;
}
function ComparisonTextPanel({ entries, fontFamily, textLanguage, onSelect }: { entries: WordAnalysisEntry[]; fontFamily: string; textLanguage: "hi" | "en"; onSelect: (entry: WordAnalysisEntry) => void }) { return <section aria-labelledby="comparison-text-title" className="mt-6 rounded-3xl bg-white p-5 shadow sm:p-7"><h2 id="comparison-text-title" className="text-xl font-black">Detailed Passage Comparison</h2><div className="mt-4 rounded-2xl border border-blue-200 p-4 sm:p-5"><PassageFlow entries={entries} onSelect={onSelect} fontFamily={fontFamily} textLanguage={textLanguage} compact/></div></section>; }
function DetailedResultBreakdown({ summary, isStenography = false }: { summary: ReturnType<typeof buildResultSummary>; isStenography?: boolean }) { const rows = [["Test duration",formatDuration(summary.elapsedSeconds)],["Total words typed",number(summary.totalWordsTyped)],["Correct words typed",number(summary.correctWordsTyped)],["Incorrect words typed",number(summary.incorrectWordsTyped)],["Omitted / skipped words",number(summary.omittedWords)],["Gross speed",`${number(summary.grossWpm)} WPM`],["Net speed",`${number(summary.netWpm)} WPM`],["Accuracy",`${number(summary.accuracy)}%`],["Error percentage",`${number(summary.errorPercentage)}%`],["Backspaces",number(summary.backspaces)]];
  // Matra/Halant/Gender/Vachan are stenography-specific (see the
  // isStenography note above) -- a plain typing result never adds them to
  // the headline half-mistake breakdown, only stenography does.
  const halfItems: [string,number][] = [["Capitalization",summary.halfCategories.capitalization],["Punctuation",summary.halfCategories.punctuation],["Spacing",summary.halfCategories.spacing],["Spelling",summary.halfCategories.spelling], ...(isStenography ? ([["Matra",summary.halfCategories.matra],["Halant",summary.halfCategories.halant],["Gender",summary.halfCategories.gender],["Vachan",summary.halfCategories.vachan]] as [string,number][]) : [])];
  return <section aria-labelledby="detailed-result-title" className="mt-6 rounded-3xl bg-white p-4 shadow sm:p-7"><h2 id="detailed-result-title" className="text-center text-xl font-black text-slate-900 underline decoration-blue-300 underline-offset-4">Detailed Result</h2><dl className="mt-6 grid gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">{rows.map(([label,value]) => <div key={label} className="flex items-baseline justify-between gap-4 border-b border-slate-100 pb-2"><dt className="text-sm font-semibold text-slate-600">{label}</dt><dd className="font-black text-slate-950">{value}</dd></div>)}</dl><div className="mt-6 grid gap-4 lg:grid-cols-2"><MistakeBreakdown title="Full mistakes" total={summary.fullMistakes} items={[["Omissions",summary.fullCategories.omissions],["Substitutions",summary.fullCategories.substitutions],["Additions",summary.fullCategories.additions],["Repetitions",summary.fullCategories.repetitions]]} tone="red"/><MistakeBreakdown title="Half mistakes" total={summary.halfMistakes} items={halfItems} tone="purple"/></div></section>; }
function MistakeBreakdown({ title, total, items, tone }: { title: string; total: number; items: [string,number][]; tone: "red" | "purple" }) { return <section className={`rounded-2xl border p-5 ${tone === "red" ? "border-red-200 bg-red-50" : "border-purple-200 bg-purple-50"}`}><div className="flex items-center justify-between"><h3 className="font-black">{title}</h3><strong className={tone === "red" ? "text-red-700" : "text-purple-700"}>{total}</strong></div><dl className="mt-4 grid grid-cols-2 gap-2 text-sm">{items.map(([label,value]) => <div key={label} className="flex justify-between gap-2 rounded-lg bg-white px-3 py-2"><dt>{label}</dt><dd className="font-black">{value}</dd></div>)}</dl></section>; }
function CategoryStrip({ categories }: { categories: ReturnType<typeof resultCategoryTotals>[number][] }) { return <section aria-label="Error-category summary" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-12">{categories.map((item) => <article key={item.key} className={`rounded-xl border p-3 ${toneClasses[item.tone]}`}><p className="text-xs font-black">{item.label}</p><p className="mt-1 text-xl font-black">{item.count}</p><p className="text-xs">Penalty {number(item.penalty)}</p></article>)}</section>; }
function PassageText({ text, fontFamily, textLanguage }: { text: string; fontFamily: string; textLanguage: "hi" | "en" }) { return <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-5 text-lg leading-9" style={{fontFamily}} lang={textLanguage}>{text}</div>; }
function PassageFlow({ entries, onSelect, fontFamily, textLanguage, compact = false }: { entries: WordAnalysisEntry[]; onSelect: (entry: WordAnalysisEntry) => void; fontFamily: string; textLanguage: "hi" | "en"; compact?: boolean }) { if (!entries.length) return <p className="rounded-xl bg-green-50 p-4 font-bold text-green-800">No errors found.</p>; return <div className={`whitespace-pre-wrap text-base leading-8 sm:text-lg sm:leading-9 ${compact ? "" : "rounded-2xl bg-slate-50 p-5"}`} style={{fontFamily}} lang={textLanguage}>{entries.map((entry) => <span key={entry.id}><AnalysisWord entry={entry} onSelect={onSelect}/>{entry.separatorAfter ?? " "}</span>)}</div>; }
function AnalysisWord({ entry, onSelect }: { entry: WordAnalysisEntry; onSelect: (entry: WordAnalysisEntry) => void }) { const styles = { correct: "font-medium text-green-700", remaining: "text-slate-500", substituted: "font-bold text-red-700 underline decoration-wavy decoration-red-400 underline-offset-4", missing: "rounded border border-red-200 bg-red-50 px-1", repeated: "rounded bg-orange-100 px-1 font-bold text-orange-900 line-through decoration-2 outline outline-1 outline-orange-300", extra: "font-bold text-red-700 line-through decoration-2", "half-error": "font-bold text-blue-700 underline decoration-dotted decoration-2 underline-offset-4" }[entry.status]; const label = entry.status === "half-error" ? entry.halfErrorCategories.map((item) => CATEGORY_LABELS[item]).join(", ") : entry.status; const display = comparisonWordDisplay(entry); if (entry.status === "correct" || entry.status === "remaining") return <span className={styles}>{display.text}</span>; const details = `${label}. Expected ${entry.original ?? "nothing"}; typed ${entry.typed ?? "nothing"}.`; return <button type="button" title={details} className={`${styles} mx-0.5 cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700`} aria-label={`${details} Show error details.`} onClick={() => onSelect(entry)}>{display.text}{display.expected && <> <span className="font-normal text-slate-500 no-underline">[{display.expected}]</span></>}</button>; }

function ErrorScoringGuide({ profile,textLanguage,entries,savedPenalty }: { profile:ExamPreset["scoringProfile"];textLanguage:"hi"|"en";entries:WordAnalysisEntry[];savedPenalty:number }) { const definitions=buildErrorGuide(profile,textLanguage); const representedPenalty=guidePenaltyTotal(entries,profile); const reconciled=Math.abs(representedPenalty-savedPenalty)<Number.EPSILON; return <details className="group error-scoring-guide mt-6 rounded-3xl border border-blue-200 bg-white shadow print:shadow-none"><summary className="cursor-pointer list-none rounded-3xl px-5 py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:px-7"><span className="flex items-center justify-between gap-4"><span><span className="block text-xs font-black uppercase tracking-[.16em] text-blue-700">Error Representation &amp; Scoring Guide</span><span className="mt-1 block text-xl font-black text-slate-950">How errors are represented</span></span><ChevronIcon/></span></summary><div className="border-t border-blue-100 px-4 py-5 sm:px-7"><p role="status" className={`rounded-xl p-3 text-sm font-bold ${reconciled?"bg-green-50 text-green-900":"bg-red-50 text-red-900"}`}>{reconciled?`Guide penalties reconcile with the saved score: ${number(savedPenalty)}.`:`Guide penalty ${number(representedPenalty)} does not reconcile with saved penalty ${number(savedPenalty)}.`}</p><div className="mt-5 hidden overflow-hidden rounded-2xl border border-slate-200 md:block"><table className="w-full border-collapse text-left text-sm"><thead className="bg-slate-900 text-white"><tr><th className="p-3">Visual example</th><th className="p-3">Error type</th><th className="p-3">Explanation</th><th className="p-3">Scoring category</th><th className="p-3">Applied penalty</th></tr></thead><tbody>{definitions.map((definition)=><GuideTableRow key={definition.key} definition={definition}/>)}</tbody></table></div><div className="mt-5 grid gap-3 md:hidden">{definitions.map((definition)=><GuideCard key={definition.key} definition={definition}/>)}</div></div></details>; }
function GuideExample({definition}:{definition:ErrorGuideDefinition}) { const expected=definition.example.expected; const typed=definition.example.typed; return <span className="inline-flex flex-wrap items-baseline gap-1" aria-label={`${definition.label} example: typed ${typed??"nothing"}; expected ${expected??"nothing"}`}><span className={definition.example.decoration==="repeat"?"rounded bg-orange-100 px-1 font-bold text-orange-900 line-through decoration-2":definition.example.decoration==="strike"?"font-bold text-red-700 line-through decoration-2":"font-bold text-red-700"}>{typed}</span>{expected&&<span className="font-semibold text-slate-500">[{expected}]</span>}</span>; }
// Applied penalty is deliberately shown as "-" rather than a number: the
// exact weight of each error type is specific to each exam's own official
// rules, which get implemented one at a time as they're researched and
// confirmed (see RSSB's marks method), not asserted generically here.
function GuideTableRow({definition}:{definition:ErrorGuideDefinition}) { return <tr className="border-t border-slate-200 align-top"><td className="p-3"><GuideExample definition={definition}/></td><th scope="row" className="p-3 font-black">{definition.label}</th><td className="p-3 text-slate-600">{definition.explanation}</td><td className={`p-3 font-black ${definition.kind==="full"?"text-red-700":"text-blue-700"}`}>{definition.kind==="full"?"Full mistake":"Half mistake"}</td><td className="p-3 font-black" title="Not yet configured for this exam's official rules">-</td></tr>; }
function GuideCard({definition}:{definition:ErrorGuideDefinition}) { return <article className={`rounded-2xl border-l-4 p-4 ${definition.kind==="full"?"border-red-600 bg-red-50":"border-blue-600 bg-blue-50"}`}><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-black">{definition.label}</h3><span className="rounded-full bg-white px-2.5 py-1 text-xs font-black" title="Not yet configured for this exam's official rules">{definition.kind==="full"?"Full mistake":"Half mistake"} · -</span></div><div className="mt-3 rounded-lg bg-white p-3"><GuideExample definition={definition}/></div><p className="mt-3 text-sm text-slate-700">{definition.explanation}</p></article>; }
function PassageValue({ value, fontFamily, textLanguage }: { value?: string; fontFamily: string; textLanguage: "hi" | "en" }) { return value ? <strong style={{fontFamily}} lang={textLanguage}>{value}</strong> : <strong>Nothing</strong>; }
function ErrorDetail({ entry, profile, fontFamily, textLanguage, onClose }: { entry: WordAnalysisEntry; profile: ExamPreset["scoringProfile"]; fontFamily: string; textLanguage: "hi" | "en"; onClose: () => void }) { const labels = entry.halfErrorCategories.map((item) => CATEGORY_LABELS[item]); const type = entry.status === "half-error" ? labels.join(", ") : entry.status; const units = entryMistakeUnits(entry, profile); const penalty = units.full * profile.fullErrorPenalty + units.half * profile.halfErrorPenalty; return <aside role="dialog" aria-modal="false" aria-label="Selected error details" className="mt-5 rounded-2xl border-2 border-blue-300 bg-blue-50 p-5 font-sans"><div className="flex items-start justify-between gap-4"><div><h3 className="font-black">{type}</h3><p className="mt-2">Expected: <PassageValue value={entry.original} fontFamily={fontFamily} textLanguage={textLanguage}/></p><p>Typed: <PassageValue value={entry.typed} fontFamily={fontFamily} textLanguage={textLanguage}/></p><p>Penalty: <strong>{number(penalty)}</strong></p></div><button type="button" onClick={onClose} aria-label="Close error details" className="rounded-lg bg-white px-3 py-2 font-bold">Close</button></div></aside>; }
type CategoryRow = { key: string; label: string; expected: string; typed: string; count: number; penalty: number; kind: "full" | "half" };
function buildCategories(entries: WordAnalysisEntry[], fullPenalty: number, halfPenalty: number) { const rows = new Map<string, CategoryRow>(); const add = (label: string, entry: WordAnalysisEntry, penalty: number, kind: "full" | "half") => { const key = `${label}|${entry.original ?? ""}|${entry.typed ?? ""}`; const current = rows.get(key); if (current) { current.count += 1; current.penalty += penalty; } else rows.set(key, { key, label, expected: entry.original ?? "—", typed: entry.typed ?? "—", count: 1, penalty, kind }); }; for (const entry of entries) { if (["substituted","missing","extra","repeated"].includes(entry.status)) add(entry.status, entry, fullPenalty, "full"); for (const category of entry.halfErrorCategories) add(CATEGORY_LABELS[category], entry, halfPenalty, "half"); } return [...rows.values()]; }
function CategoryAnalysis({ categories, fullErrors, halfErrors, fontFamily, textLanguage }: { categories: CategoryRow[]; fullErrors: number; halfErrors: number; fontFamily: string; textLanguage: "hi" | "en" }) { const sections = [{ title: "Full Errors", kind: "full", total: fullErrors, tone: "red" }, { title: "Half Errors", kind: "half", total: halfErrors, tone: "purple" }] as const; return <div className="grid gap-6 font-sans lg:grid-cols-2">{sections.map(({title,kind,total,tone}) => { const rows = categories.filter((item) => item.kind === kind); return <section key={kind} className={`rounded-2xl border p-5 ${toneClasses[tone]}`}><div className="flex justify-between"><h3 className="text-xl font-black">{title}</h3><strong>{total}</strong></div><div className="mt-4 space-y-3">{rows.length ? rows.map((row) => <article key={row.key} className="rounded-xl bg-white p-4 shadow-sm"><div className="flex justify-between gap-3"><strong className="capitalize">{row.label}</strong><span>{row.count} occurrence{row.count === 1 ? "" : "s"} · {number(row.penalty)} penalty</span></div><p className="mt-2 text-sm">Expected: <b style={{fontFamily}} lang={textLanguage}>{row.expected}</b> · Typed: <b style={{fontFamily}} lang={textLanguage}>{row.typed}</b></p></article>) : <p>No errors in this section.</p>}</div></section>; })}</div>; }
function repeatedWords(entries: WordAnalysisEntry[]) { const counts = new Map<string, number>(); for (const entry of entries) for (const word of [entry.original, entry.typed]) if (word) counts.set(word, (counts.get(word) ?? 0) + 1); return [...counts].map(([text,count]) => ({text,count})).sort((a,b) => b.count-a.count).slice(0,10); }
function repeatedCharacters(entries: WordAnalysisEntry[]) { const counts = new Map<string, number>(); for (const entry of entries) for (const char of segmentGraphemes(`${entry.original ?? ""}${entry.typed ?? ""}`)) if (!/\s/.test(char)) counts.set(char, (counts.get(char) ?? 0) + 1); return [...counts].map(([text,count]) => ({text,count})).sort((a,b) => b.count-a.count).slice(0,10); }
function SelfAnalysis({ repeated, weakWords, weakCharacters, practicePassage, fontFamily, textLanguage }: { repeated: {label:string;count:number}[]; weakWords: {text:string;count:number}[]; weakCharacters: {text:string;count:number}[]; practicePassage: string; fontFamily: string; textLanguage: "hi" | "en" }) { return <div className="grid gap-5 font-sans lg:grid-cols-2"><InsightList title="Repeated mistakes" items={repeated.map((item) => ({text:item.label,count:item.count}))} fontFamily={fontFamily} textLanguage={textLanguage}/><InsightList title="Weak words" items={weakWords} fontFamily={fontFamily} textLanguage={textLanguage}/><InsightList title="Weak characters" items={weakCharacters} fontFamily={fontFamily} textLanguage={textLanguage}/><InsightList title="Recommended next-practice words" items={weakWords.map((item) => ({text:item.text}))} fontFamily={fontFamily} textLanguage={textLanguage}/>{practicePassage && <section className="rounded-2xl bg-blue-50 p-5 lg:col-span-2"><h3 className="font-black">Focused practice passage</h3><p className="mt-3 leading-8" style={{fontFamily}} lang={textLanguage}>{practicePassage}</p></section>}<section className="rounded-2xl border border-dashed border-slate-300 p-5 lg:col-span-2"><h3 className="font-black">Teacher advice</h3><p className="mt-2 text-sm text-slate-500">Reserved for future institution feedback. No teacher data is stored in this phase.</p></section></div>; }
function InsightList({ title, items, fontFamily, textLanguage }: { title: string; items: {text:string;count?:number}[]; fontFamily: string; textLanguage: "hi" | "en" }) { return <section className="rounded-2xl bg-slate-50 p-5"><h3 className="font-black">{title}</h3>{items.length ? <ul className="mt-3 space-y-2">{items.map((item) => <li key={`${item.text}-${item.count ?? ""}`} className="rounded-lg bg-white px-3 py-2"><span style={{fontFamily}} lang={textLanguage}>{item.text}</span>{item.count !== undefined && <span> ({item.count}×)</span>}</li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No mistakes identified.</p>}</section>; }
