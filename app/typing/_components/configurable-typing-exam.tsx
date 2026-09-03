"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Noto_Serif } from "next/font/google";
import { recordManagedAttempt } from "@/app/tests/actions";
import { calculateTypingScore, DEFAULT_TYPING_SETTINGS, isAllowedTypingEdit, scoringProfileWithSelectedCategories, ALL_HALF_ERROR_CATEGORIES, PRACTICE_DURATION_MINUTES, type BackspaceMode, type HalfErrorCategory, type TypingSettings } from "@/lib/typing-test";
import { repeatPassageToExactWordCount, type ExamPreset } from "@/lib/typing-curriculum";
import { getInputSystemPassage, getScoringText, normalizeTypingInput, segmentGraphemes, type InputSystem } from "@/lib/typing-language";
import { TypingBrandHeader } from "./typing-brand";
import { AdvancedTypingResults } from "./advanced-typing-results";
import { DictationGate } from "./dictation-gate";
import { defaultTypingFontPreferences, type TypingFontPreferences } from "@/lib/typing-font-preferences";
import { UniversalTypingSettings } from "./universal-typing-settings";
import { useTypingPlatformSettings } from "./typing-platform-provider";
import { fontContextFor, managedTestSettingsLocks, resolveAttemptSettings, type AttemptVariant } from "@/lib/typing-platform-settings";
import { BackButton } from "../../_components/back-button";

// Formal serif face used only for the exam-mode ("Simulation") pre-start
// screen -- an "admit card" look, distinct from the plain sans-serif UI used
// everywhere else in the app (practice/learn keep the original ExamStart
// layout entirely, see the mode === "exam" branch below).
const examSerif = Noto_Serif({ subsets: ["latin"], weight: ["600", "700", "900"], variable: "--font-exam-serif" });

function InputSystemOptions({ systems, value, onChange }: { systems: InputSystem[]; value: string; onChange: (id: string) => void }) { return <fieldset className="mt-6"><legend className="mb-2 text-sm font-black text-slate-900">Language and input system</legend><div className="grid gap-2 sm:grid-cols-2">{systems.map((system) => <button key={system.id} type="button" aria-pressed={value === system.id} onClick={() => onChange(system.id)} className={`rounded-xl border p-3 text-left text-sm font-bold ${value === system.id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-slate-50 text-slate-800"}`}><span aria-hidden>{value === system.id ? "●" : "○"}</span> {system.label}<small className="mt-1 block font-normal opacity-80">{system.keyboardLayout}</small></button>)}</div></fieldset>; }

type ExamMode = "practice" | "exam";
export type PracticeNavigation={currentIndex:number;total:number;items:{title:string;href:string;label:string}[];previousHref:string|null;nextHref:string|null;sort:"newest"|"oldest";newestHref:string;oldestHref:string};
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const remainingSeconds = (end: number) => Math.max(0, Math.ceil((end - Date.now()) / 1000));
const backspaceLabel = (mode: BackspaceMode) => mode === "full" ? "Full backspace" : mode === "word" ? "One-word backspace" : "Backspace disabled";
const escapeHtmlForPrint = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Devanagari has no case, so capitalization is never a meaningful category
// for Hindi -- matches managedVersionToPreset()'s existing
// capitalizationErrors: language === "English" default exactly.
// The dictation gate's initial checklist selection: the admin's configured
// defaults when this test has been set up for it (preset.dictationCategories),
// falling back to "everything on" (this app's original behavior, before
// admin-configurability existed) for any test that hasn't. Either way,
// capitalization/halant are still excluded for the language they don't
// apply to -- an admin-configured default can only narrow the language-
// appropriate set further, never reintroduce a category that makes no
// sense for this test's language.
const defaultCategoriesFor = (preset: ExamPreset): HalfErrorCategory[] => {
  const languageAppropriate = ALL_HALF_ERROR_CATEGORIES.filter((category) => preset.language === "English" ? category !== "halant" : category !== "capitalization");
  if (!preset.dictationCategories) return languageAppropriate;
  return languageAppropriate.filter((category) => preset.dictationCategories!.defaults.includes(category));
};
// Tailwind class discovery for the result legend: bg-green-500 bg-red-500 bg-orange-500 bg-blue-500 bg-purple-500

export function ConfigurableTypingExam({ preset, mode, customPreset = false, matterPreset = false, directWorkspace = false, managedTest, practiceNavigation }: { preset: ExamPreset; mode: ExamMode; customPreset?: boolean; matterPreset?: boolean; directWorkspace?: boolean; managedTest?: {testId:string;versionId:string;mode:"learn"|"practice"|"exam"|"stenography";isLive?:boolean;resultsPublishAt?:string|null}; practiceNavigation?:PracticeNavigation }) {
  const { preferences, loaded, updatePreferences } = useTypingPlatformSettings();
  const officialSettings = useMemo<TypingSettings>(() => ({ ...DEFAULT_TYPING_SETTINGS, backspaceMode: preset.backspaceMode, wordMethod: preset.wordMethod }), [preset.backspaceMode, preset.wordMethod]);
  const [started, setStarted] = useState(directWorkspace);
  const [finished, setFinished] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [timeLeft, setTimeLeft] = useState(preset.durationSeconds);
  const [endTimestamp, setEndTimestamp] = useState<number | null>(null);
  const [timerStarted, setTimerStarted] = useState(false);
  const [backspaces, setBackspaces] = useState(0);
  // Stenography dictation phase (only ever reachable when preset.audioUrl is
  // set -- every other test takes the exact same path as before this
  // feature existed). dictationReady flips true the moment Start Typing is
  // clicked, which is also what starts the timer (see beginTiming below) --
  // a fixed transcription-time window, like the real exam, not tied to the
  // student's first keystroke the way plain typing tests are.
  const [dictationReady, setDictationReady] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<HalfErrorCategory[]>(() => defaultCategoriesFor(preset));
  const startedAt = useRef<string | null>(null); const recordedAttempt = useRef(false);
  const directSettingsInitialized = useRef(false);
  const [verifiedScore, setVerifiedScore] = useState<ReturnType<typeof calculateTypingScore> | null>(null);
  const [liveSubmission, setLiveSubmission] = useState<"idle"|"saving"|"submitted"|"already-submitted"|"closed"|"failed">("idle");
  const [settings, setSettings] = useState<TypingSettings>(officialSettings);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollbar, setShowScrollbar] = useState(preferences.showScrollbar);
  const [paused, setPaused] = useState(false);
  // No longer switchable by the student -- the "Official Preset / Custom
  // Simulation" toggle was removed from ExamStart, so this stays fixed at
  // its initial value for the lifetime of an attempt: "official" locks
  // exam-mode rules to the researched pattern (always, now), "custom"
  // keeps practice mode's existing settings-follow-student-preferences
  // behavior, both unchanged from before.
  const [attemptVariant] = useState<AttemptVariant>(mode === "practice" || customPreset ? "custom" : "official");
  const managedSettingsLockMap = managedTestSettingsLocks(managedTest?.mode, managedTest?.isLive);
  const managedRulesLocked = Object.keys(managedSettingsLockMap).length > 0;
  const resolvedAttemptVariant: AttemptVariant = managedTest ? (managedRulesLocked ? "official" : "custom") : customPreset ? "official" : attemptVariant;
  // A practice-mode managed test (managedRulesLocked is false only for that
  // case -- see managedTestSettingsLocks) never forces the admin's duration
  // on the student, same as it already never forces backspace/highlight/word
  // method for that mode. Every other managed test (exam/learn/stenography,
  // or any live test) is unchanged: Boolean(managedTest) alone used to force
  // it for ALL managed tests including practice, which is the bug this fixes
  // -- the duration field already rendered "unlocked" for practice tests,
  // but the timer ran on the admin's fixed value regardless.
  const activeDurationSeconds = attemptVariant === "official" || matterPreset || (Boolean(managedTest) && managedRulesLocked) ? preset.durationSeconds : preferences.durationMinutes * 60;
  const [inputSystemId, setInputSystemId] = useState(preset.inputSystems[0].id);
  const [fontCheck, setFontCheck] = useState<{ id: string; available: boolean } | null>(null);
  const inputSystem = preset.inputSystems.find((system) => system.id === inputSystemId) ?? preset.inputSystems[0];
  const fontContext = fontContextFor(inputSystem.inputEncoding, inputSystem.script);
  const fontPreferences = preferences.fonts[fontContext];
  const fontAvailable = inputSystem.requiredFontAsset
    ? fontCheck?.id === inputSystem.id ? fontCheck.available : null
    : true;
  const passage = useMemo(() => getInputSystemPassage(inputSystem, preset.passage), [inputSystem, preset.passage]);
  const normalizedInput = useMemo(() => normalizeTypingInput(typedText, inputSystem), [inputSystem, typedText]);
  // Student-adjustable passage length (150-700 words), offered in every
  // typing section except Stenography (preset.category === "stenography")
  // -- a dictation passage is paired to a fixed audio recording and must
  // never be resampled. wordCountEditable mirrors the same rulesLocked
  // passed to ExamWorkspace below (whether this test allows customizing it
  // at all); effectivePassage is deliberately NOT re-gated on timerStarted
  // -- once typing begins it must stay exactly what the student has been
  // typing against, not silently revert to the natural passage the instant
  // the (separate, UI-only) passageWordCountLocked flag flips true.
  const rulesLocked = attemptVariant === "official" || managedRulesLocked || (customPreset && !managedTest);
  const showPassageWordCount = preset.category !== "stenography";
  const wordCountEditable = showPassageWordCount && !rulesLocked;
  const passageWordCountLocked = !wordCountEditable || timerStarted;
  const naturalWordCount = useMemo(() => passage.trim().split(/\s+/u).length, [passage]);
  const effectivePassage = useMemo(() => wordCountEditable && preferences.passageWordCount ? repeatPassageToExactWordCount(passage, preferences.passageWordCount) : passage, [wordCountEditable, preferences.passageWordCount, passage]);
  const changePassageWordCount = (value: number | null) => updatePreferences({ passageWordCount: value });

  useEffect(() => {
    if (!inputSystem.requiredFontAsset) return;
    let active = true;
    fetch(inputSystem.requiredFontAsset, { method: "HEAD", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return false;
        await document.fonts.load(`16px ${inputSystem.fontStack}`);
        return document.fonts.check(`16px ${inputSystem.fontStack}`);
      })
      .then((available) => { if (active) setFontCheck({ id: inputSystem.id, available }); })
      .catch(() => { if (active) setFontCheck({ id: inputSystem.id, available: false }); });
    return () => { active = false; };
  }, [inputSystem]);
  useEffect(() => { if (!loaded || started || !preferences.inputSystemId || !preset.inputSystems.some((system) => system.id === preferences.inputSystemId)) return; const timer = window.setTimeout(() => setInputSystemId(preferences.inputSystemId), 0); return () => window.clearTimeout(timer); }, [loaded, preferences.inputSystemId, preset.inputSystems, started]);
  useEffect(() => {
    if (!directWorkspace || !loaded || directSettingsInitialized.current) return;
    directSettingsInitialized.current = true;
    const resolved = resolveAttemptSettings(preferences, officialSettings, resolvedAttemptVariant);
    if ((managedRulesLocked || resolvedAttemptVariant === "official") && preset.highlightMode) resolved.highlightMode = preset.highlightMode;
    // timeLeft's own useState always initializes to preset.durationSeconds
    // (activeDurationSeconds isn't computed yet at that point in the
    // component), which is correct for a locked test but wrong for an
    // unlocked practice one -- directWorkspace (the practice-hub entry
    // point every student actually uses) skips start() entirely, so
    // nothing else ever corrects it. activeDurationSeconds is already the
    // right value either way, so just adopt it here, once.
    const timer = window.setTimeout(() => { setSettings(resolved); setAutoScroll(resolved.autoScroll); setShowScrollbar(preferences.showScrollbar); setTimeLeft(activeDurationSeconds); }, 0);
    return () => window.clearTimeout(timer);
  }, [activeDurationSeconds, directWorkspace, loaded, managedRulesLocked, officialSettings, preferences, preset.highlightMode, resolvedAttemptVariant]);

  useEffect(() => {
    if (!started || finished || paused || !endTimestamp) return;
    const sync = () => { const next = remainingSeconds(endTimestamp); setTimeLeft(next); if (!next) setFinished(true); };
    const initial = window.setTimeout(sync, 0);
    const interval = window.setInterval(sync, 500);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); window.removeEventListener("focus", sync); document.removeEventListener("visibilitychange", sync); };
  }, [endTimestamp, finished, paused, started]);
  useEffect(() => { if (!timerStarted || finished) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [finished, timerStarted]);
  useEffect(() => { sessionStorage.setItem("practice-attempt-active", String(timerStarted && !finished)); return () => sessionStorage.setItem("practice-attempt-active", "false"); }, [finished, timerStarted]);

  const start = () => { if (inputSystem.requiredFontAsset && fontAvailable !== true) return; const resolved = resolveAttemptSettings(preferences, officialSettings, resolvedAttemptVariant); if ((managedRulesLocked || resolvedAttemptVariant === "official") && preset.highlightMode) resolved.highlightMode = preset.highlightMode; setSettings(resolved); setAutoScroll(resolved.autoScroll); setPaused(false); setTypedText(""); setBackspaces(0); setTimeLeft(activeDurationSeconds); setEndTimestamp(null); setTimerStarted(false); setFinished(false); setVerifiedScore(null); setLiveSubmission("idle"); recordedAttempt.current=false; startedAt.current=null; setDictationReady(false); setSelectedCategories(defaultCategoriesFor(preset)); setStarted(true); };
  const beginTiming = () => { if (timerStarted) return; setTimerStarted(true); setEndTimestamp(Date.now() + activeDurationSeconds * 1000); startedAt.current = new Date().toISOString(); };
  // Duration is only actually changeable through this same set of
  // conditions that stop activeDurationSeconds from being forced -- plus
  // once the timer has genuinely started, since changing it mid-attempt
  // would desync the running countdown. This is what lets a practice
  // student (who reaches the workspace directly via directWorkspace and
  // never sees ExamStart's own duration picker) still change it, from the
  // in-workspace Settings popup, before they start typing.
  const durationLocked = attemptVariant === "official" || matterPreset || (Boolean(managedTest) && managedRulesLocked) || timerStarted;
  const changeDuration = (minutes: number) => { updatePreferences({ durationMinutes: minutes }); if (!timerStarted) setTimeLeft(minutes * 60); };
  const submit = () => { if (window.confirm("Submit this test now? You cannot continue typing after submission.")) { setTimeLeft(endTimestamp ? remainingSeconds(endTimestamp) : timeLeft); setFinished(true); } };
  const togglePause = () => { if (!timerStarted) return; if (paused) { setEndTimestamp(Date.now() + timeLeft * 1000); setPaused(false); } else { setTimeLeft(endTimestamp ? remainingSeconds(endTimestamp) : timeLeft); setEndTimestamp(null); setPaused(true); } };
  const navigatePracticeTest=(href:string)=>{if(timerStarted&&!finished&&!window.confirm("Changing tests will discard the active attempt. Continue?"))return;window.location.href=href;};
  useEffect(() => { const shortcut=(event:KeyboardEvent)=>{if(event.altKey&&event.key==="ArrowLeft"&&practiceNavigation?.previousHref){event.preventDefault();navigatePracticeTest(practiceNavigation.previousHref);}if(event.altKey&&event.key==="ArrowRight"&&practiceNavigation?.nextHref){event.preventDefault();navigatePracticeTest(practiceNavigation.nextHref);}if(event.key==="Escape"&&started&&!finished&&!paused){event.preventDefault();togglePause();}if(event.ctrlKey&&event.key==="Enter"){event.preventDefault();if(!started)start();else if(!finished&&(!preset.audioUrl||dictationReady))submit();}};window.addEventListener("keydown",shortcut);return()=>window.removeEventListener("keydown",shortcut); });
  // Folding the student's dictation-phase category selection into the
  // scoring profile is only meaningful for audio (dictation) tests -- for
  // every other test scoredPreset is the exact same object reference as
  // preset, so nothing downstream that reads preset.scoringProfile behaves
  // any differently than before this feature existed.
  const effectiveScoringProfile = useMemo(() => preset.audioUrl ? scoringProfileWithSelectedCategories(preset.scoringProfile, selectedCategories) : preset.scoringProfile, [preset.audioUrl, preset.scoringProfile, selectedCategories]);
  const scoredPreset = useMemo(() => preset.audioUrl ? { ...preset, scoringProfile: effectiveScoringProfile } : preset, [preset, effectiveScoringProfile]);
  const finalScore = useMemo(() => finished ? calculateTypingScore({ typedText: getScoringText(normalizedInput.comparisonText, inputSystem), passage: getScoringText(effectivePassage, inputSystem), elapsedSeconds: activeDurationSeconds - timeLeft, wordMethod: settings.wordMethod, scoringProfile: effectiveScoringProfile, includeUntypedWords: true }) : null, [activeDurationSeconds, effectiveScoringProfile, finished, inputSystem, normalizedInput.comparisonText, effectivePassage, settings.wordMethod, timeLeft]);
  // examCategorySlug: preset was already built server-side via the
  // corrected managedVersionToPreset(version, viewAs) (see
  // app/tests/[slug]/page.tsx), so preset.examCategorySlug already
  // reflects the category the student is actually viewing this shared
  // Rajasthan LDC exercise as -- threading it through here is what lets
  // recordManagedAttempt's own authoritative rescoring apply that same
  // category's rules instead of silently falling back to Rajasthan LDC's.
  useEffect(()=>{if(!finished||!finalScore||!managedTest||!startedAt.current||recordedAttempt.current)return;recordedAttempt.current=true;void recordManagedAttempt({testId:managedTest.testId,versionId:managedTest.versionId,startedAt:startedAt.current,typedText,elapsedSeconds:finalScore.elapsedSeconds,backspaces,selectedCategories,passageWordCount:wordCountEditable?preferences.passageWordCount:null,examCategorySlug:preset.examCategorySlug}).then((result) => { if(result?.status==="scored"&&result.score)setVerifiedScore(result.score);if(managedTest.isLive)setLiveSubmission(result?.status==="submitted"||result?.status==="already-submitted"||result?.status==="closed"?result.status:"failed"); });},[backspaces,finalScore,finished,managedTest,preset.examCategorySlug,selectedCategories,typedText,wordCountEditable,preferences.passageWordCount]);
  const saveSettings = (next: TypingSettings) => { setSettings(next); updatePreferences(attemptVariant === "custom" ? { backspaceMode: next.backspaceMode, highlightMode: next.highlightMode, wordMethod: next.wordMethod } : { highlightMode: next.highlightMode }); };
  const changeScroll = (value: boolean) => { setAutoScroll(value); updatePreferences({ autoScroll: value }); };
  const changeScrollbar = (value: boolean) => { setShowScrollbar(value); updatePreferences({ showScrollbar: value }); };
  const changeFontPreferences = (next: TypingFontPreferences) => updatePreferences({ fonts: { ...preferences.fonts, [fontContext]: next } });

  const changeInputSystem = (id: string) => { if (id === inputSystemId) return; if (typedText && !window.confirm("Changing the language or input system will restart this attempt and clear the typed text. Continue?")) return; setInputSystemId(id); updatePreferences({ inputSystemId: id }); if (typedText) { setTypedText(""); setBackspaces(0); setTimeLeft(activeDurationSeconds); setEndTimestamp(null); setTimerStarted(false); startedAt.current=null; } };
  if (!started) return <ExamStart preset={preset} mode={mode} inputSystem={inputSystem} inputSystemId={inputSystemId} onInputSystemChange={(id) => { setInputSystemId(id); updatePreferences({ inputSystemId: id }); }} fontAvailable={fontAvailable} attemptVariant={attemptVariant} customPreset={customPreset} durationSeconds={activeDurationSeconds} durationLocked={durationLocked} onDurationChange={changeDuration} onStart={start}/>;
  if (started && preset.audioUrl && !dictationReady) return <DictationGate preset={preset} url={preset.audioUrl} selectedCategories={selectedCategories} onCategoriesChange={setSelectedCategories} onStartTyping={() => { beginTiming(); setDictationReady(true); }}/>;
  if (finished && finalScore && managedTest?.isLive) return <LiveSubmissionReceipt status={liveSubmission} resultsPublishAt={managedTest.resultsPublishAt}/>;
  // "Return to Tests" used to always point at /typing/exams (Exam
  // Simulators) no matter what kind of test was actually taken -- wrong
  // for the far more common Practice/Learn/Stenography paths. Route it
  // back to wherever this attempt actually came from.
  const returnHref = managedTest
    ? managedTest.mode === "practice" ? `/typing/practice/${inputSystem.language === "Hindi" ? "hindi" : "english"}`
    : managedTest.mode === "learn" ? `/typing/learn/${inputSystem.language === "Hindi" ? "hindi" : "english"}`
    : managedTest.mode === "stenography" ? "/typing/practice/stenography"
    : managedTest.mode === "exam" && preset.examCategorySlug ? `/typing/exams/category/${preset.examCategorySlug}/${inputSystem.language === "Hindi" ? "hindi" : "english"}`
    : "/typing/exams"
    : "/typing/exams";
  const returnLabel = managedTest
    ? managedTest.mode === "practice" ? "Return to Practice Tests"
    : managedTest.mode === "learn" ? "Return to Learn Typing"
    : managedTest.mode === "stenography" ? "Return to Stenography"
    : managedTest.mode === "exam" && preset.examCategorySlug ? "Return to Exercises"
    : "Return to Tests"
    : "Return to Tests";
  if (finished && finalScore) return <AdvancedTypingResults preset={scoredPreset} score={verifiedScore ?? finalScore} backspaces={backspaces} onRestart={start} inputSystem={inputSystem} passage={effectivePassage} typedText={normalizedInput.comparisonText} returnHref={returnHref} returnLabel={returnLabel}/>;
  return <ExamWorkspace preset={scoredPreset} passage={effectivePassage} inputSystem={inputSystem} fontAvailable={fontAvailable} fontPreferences={fontPreferences} setFontPreferences={changeFontPreferences} encodingMismatch={normalizedInput.encodingMismatch} rulesLocked={rulesLocked} typedText={typedText} setTypedText={setTypedText} onFirstTypingInput={beginTiming} timerStarted={timerStarted} onInputSystemChange={attemptVariant === "custom" && !managedRulesLocked && !(customPreset && !managedTest) ? changeInputSystem : undefined} timeLeft={timeLeft} paused={paused} onPauseToggle={togglePause} settings={settings} setSettings={saveSettings} autoScroll={autoScroll} setAutoScroll={changeScroll} showScrollbar={showScrollbar} setShowScrollbar={changeScrollbar} setBackspaces={setBackspaces} onSubmit={submit} practiceNavigation={practiceNavigation} onNavigateTest={navigatePracticeTest} durationMinutes={activeDurationSeconds / 60} durationLocked={durationLocked} onDurationChange={changeDuration} showPassageWordCount={showPassageWordCount} passageWordCount={passageWordCountLocked ? naturalWordCount : (preferences.passageWordCount ?? naturalWordCount)} passageWordCountLocked={passageWordCountLocked} onPassageWordCountChange={changePassageWordCount}/>;
}

function LiveSubmissionReceipt({status,resultsPublishAt}:{status:"idle"|"saving"|"submitted"|"already-submitted"|"closed"|"failed";resultsPublishAt?:string|null}) { const release=resultsPublishAt?new Date(resultsPublishAt).toLocaleString():"the scheduled publication time"; const message=status==="saving"||status==="idle"?"Securely saving your submission…":status==="submitted"?`Submission received. Your result will unlock on ${release}.`:status==="already-submitted"?`Your live-test attempt was already submitted. Results unlock on ${release}.`:status==="closed"?"The live-test window has closed, so this submission was not accepted.":"We could not confirm the submission. Please contact support."; return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4"><section className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-3xl" aria-hidden>{status==="submitted"||status==="already-submitted"?"✓":"⏳"}</span><h1 className="mt-5 text-3xl font-black text-slate-900">Live test submission</h1><p className="mt-4 leading-7 text-slate-600">{message}</p><p className="mt-3 text-sm font-bold text-blue-700">Scores are hidden from everyone until the scheduled release.</p><a href="/live-test" className="mt-6 inline-block rounded-xl bg-blue-700 px-6 py-3 font-black text-white">Live test centre</a></section></main>; }

function ExamStart({ preset, mode, inputSystem, inputSystemId, onInputSystemChange, fontAvailable, attemptVariant, customPreset, durationSeconds, durationLocked, onDurationChange, onStart }: { preset: ExamPreset; mode: ExamMode; inputSystem: InputSystem; inputSystemId: string; onInputSystemChange: (id: string) => void; fontAvailable: boolean | null; attemptVariant: AttemptVariant; customPreset: boolean; durationSeconds: number; durationLocked: boolean; onDurationChange: (value: number) => void; onStart: () => void }) {
  const specs = [["Duration", formatTime(durationSeconds)], ["Language", inputSystem.language], ["Font", inputSystem.fontLabel], ["Layout", inputSystem.keyboardLayout], ["Required speed", `${preset.speedRequirement} WPM`], ["Required accuracy", `${preset.accuracyRequirement}%`], ["Backspace", backspaceLabel(preset.backspaceMode)]];
  const blocked = Boolean(inputSystem.requiredFontAsset) && fontAvailable !== true;
  const lockNote = customPreset ? "Uploaded exam rules are locked; visual and accessibility settings stay editable." : attemptVariant === "official" ? "Exam rules lock when you begin; visual and accessibility settings stay editable." : "Rule changes use your universal defaults and clearly mark this as a custom simulation.";
  const lockLabel = customPreset ? "Locked Custom Preset" : attemptVariant === "official" ? "Official preset lock" : "Custom Simulation";
  const fontWarning = fontAvailable === null ? "Checking the licensed Kruti Dev 010 font…" : <>Kruti Dev 010 is unavailable. The project owner must provide the licensed font at <code>{inputSystem.requiredFontAsset}</code>. This legacy passage will not be shown with a fallback font.</>;

  // Practice mode keeps the original plain layout, byte-for-byte -- this
  // redesign is deliberately scoped to mode === "exam" only (see below), so
  // Practice/Learn/Word-Efficiency (which all share ExamStart) are
  // completely unaffected.
  if (mode !== "exam") return <main className="min-h-screen bg-slate-100"><TypingBrandHeader/><section className="mx-auto max-w-5xl px-4 py-10"><div className="rounded-3xl bg-white p-6 shadow-xl sm:p-10"><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">Practice mode</span><h1 className="mt-5 text-4xl font-black text-slate-900">{preset.title}</h1><p className="mt-2 text-slate-600">{preset.subtitle}. This is a practice experience and not an official examination portal.</p>{preset.inputSystems.length > 1 && <InputSystemOptions systems={preset.inputSystems} value={inputSystemId} onChange={onInputSystemChange}/>}{!durationLocked && <label className="mt-6 block max-w-xs text-sm font-bold">Duration<select value={durationSeconds / 60} onChange={(event) => onDurationChange(Number(event.target.value))} className="input mt-2">{(PRACTICE_DURATION_MINUTES.includes(durationSeconds / 60) ? PRACTICE_DURATION_MINUTES : [...PRACTICE_DURATION_MINUTES, durationSeconds / 60].sort((a, b) => a - b)).map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}</select></label>}<div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{specs.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-black text-slate-900">{value}</p></div>)}</div>{blocked && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 font-bold text-red-800">{fontWarning}</p>}<div className="mt-7 rounded-xl bg-blue-50 p-5 text-sm text-blue-900"><strong>{lockLabel}:</strong> {lockNote}</div><button type="button" disabled={blocked} onClick={onStart} className="mt-8 w-full rounded-xl bg-green-600 py-4 text-lg font-black text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-400">Start Practice</button></div></section></main>;

  // Exam mode: a formal "admit card" / official-notice look -- the user
  // explicitly asked for this to feel like a real government job exam
  // rather than a plain generic card. The disclaimer that this is an
  // independent, unaffiliated practice simulation is kept (made MORE
  // prominent, as its own ribbon) precisely because the visual design now
  // leans authoritative -- looking official must never be mistaken for
  // being official.
  return <main className={`min-h-screen bg-[#eee9db] ${examSerif.variable}`}>
    <TypingBrandHeader/>
    <section className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <p className="mb-5 rounded-md border border-amber-400 bg-amber-50 px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-amber-900 sm:text-xs">
        Independent practice simulation by Samradhi Classes — not affiliated with, endorsed by, or an official product of any recruitment or examination authority.
      </p>
      <div className="overflow-hidden rounded-sm border-[3px] border-double border-slate-800 bg-[#fffdf7] shadow-2xl">
        <div className="border-b-[3px] border-double border-slate-800 bg-gradient-to-b from-slate-900 to-slate-800 px-6 py-7 text-center text-white sm:px-10">
          <span aria-hidden className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-400 text-lg font-black tracking-tight text-amber-400">SC</span>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-300">Samradhi Classes · Practice Simulator</p>
          <h1 style={{ fontFamily: "var(--font-exam-serif)" }} className="mt-3 text-2xl font-black uppercase tracking-wide sm:text-4xl">{preset.title}</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">{preset.subtitle}</p>
        </div>
        <div className="px-6 py-8 sm:px-10">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 pb-3 text-xs">
            <span className="font-bold uppercase tracking-widest text-slate-500">Simulation Code</span>
            <span className="font-mono font-black tracking-wider text-slate-800">{preset.id.toUpperCase()}</span>
          </div>
          {preset.patternSourced !== undefined && <p className={`mt-3 text-xs font-bold ${preset.patternSourced ? "text-emerald-700" : "text-amber-700"}`}>{preset.patternSourced ? "✓ Pattern researched from this board's published exam-pattern / typing-test guidance." : "⚠ No confirmed official pattern was found for this exact post — the figures below are a reasoned baseline. Verify against the current notification."}</p>}
          {preset.inputSystems.length > 1 && <InputSystemOptions systems={preset.inputSystems} value={inputSystemId} onChange={onInputSystemChange}/>}
          {!durationLocked && <label className="mt-6 block max-w-xs text-sm font-bold text-slate-800">Duration<select value={durationSeconds / 60} onChange={(event) => onDurationChange(Number(event.target.value))} className="input mt-2">{(PRACTICE_DURATION_MINUTES.includes(durationSeconds / 60) ? PRACTICE_DURATION_MINUTES : [...PRACTICE_DURATION_MINUTES, durationSeconds / 60].sort((a, b) => a - b)).map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}</select></label>}

          <h2 style={{ fontFamily: "var(--font-exam-serif)" }} className="mt-8 border-b-2 border-slate-800 pb-1.5 text-sm font-black uppercase tracking-widest text-slate-800">Particulars of Simulation</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-4">
            {specs.map(([label, value], index) => <div key={label} className={`border-b border-slate-300 px-1 py-3 sm:px-2 ${index % 4 !== 0 ? "sm:border-l" : ""} ${index % 2 !== 0 ? "border-l" : ""}`}><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-0.5 font-black tabular-nums text-slate-900">{value}</dd></div>)}
          </dl>

          {blocked && <p role="alert" className="mt-6 rounded border border-red-300 bg-red-50 p-4 font-bold text-red-800">{fontWarning}</p>}

          <div className="mt-8 rounded border border-slate-300 bg-slate-50 p-5">
            <h2 style={{ fontFamily: "var(--font-exam-serif)" }} className="text-sm font-black uppercase tracking-widest text-slate-800">Instructions to Candidate</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-slate-700">
              <li>The timer begins the moment you type your first keystroke in the workspace — not when this page loads, and not the instant you click Begin Simulation.</li>
              <li>Do not refresh, close, or navigate away from this window once the simulation has started.</li>
              {preset.instructionNotes?.map((note) => <li key={note}>{note}</li>)}
              <li>{lockLabel}: {lockNote}</li>
              <li>Full-screen mode is available from the toolbar for a distraction-free, exam-like environment.</li>
            </ol>
          </div>

          <button type="button" disabled={blocked} onClick={onStart} className="mt-8 w-full rounded-sm border-2 border-slate-900 bg-slate-900 py-4 text-lg font-black uppercase tracking-widest text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400">Begin Simulation</button>
        </div>
      </div>
    </section>
  </main>;
}

type WorkspaceProps = { preset: ExamPreset; passage: string; inputSystem: InputSystem; fontAvailable: boolean | null; fontPreferences: TypingFontPreferences; setFontPreferences: (value: TypingFontPreferences) => void; encodingMismatch: boolean; rulesLocked: boolean; typedText: string; setTypedText: (value: string) => void; onFirstTypingInput: () => void; timerStarted: boolean; onInputSystemChange?: (id: string) => void; timeLeft: number; paused: boolean; onPauseToggle: () => void; settings: TypingSettings; setSettings?: (value: TypingSettings) => void; autoScroll: boolean; setAutoScroll: (value: boolean) => void; showScrollbar: boolean; setShowScrollbar: (value: boolean) => void; setBackspaces: React.Dispatch<React.SetStateAction<number>>; onSubmit: () => void; practiceNavigation?:PracticeNavigation; onNavigateTest:(href:string)=>void; durationMinutes: number; durationLocked: boolean; onDurationChange: (value: number) => void; showPassageWordCount: boolean; passageWordCount: number; passageWordCountLocked: boolean; onPassageWordCountChange: (value: number | null) => void };

type SettingsPopupProps = {
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onClose: (restoreFocus?: boolean) => void;
  children: React.ReactNode;
};

function TypingSettingsPopup({ triggerRef, onClose, children }: SettingsPopupProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 8, left: 8, width: 352, maxHeight: 420 });

  useEffect(() => {
    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const gap = 6;
      const edge = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(352, viewportWidth - edge * 2);
      const belowSpace = viewportHeight - rect.bottom - gap - edge;
      const aboveSpace = rect.top - gap - edge;
      const preferredHeight = Math.min(480, viewportHeight - edge * 2);
      const openBelow = belowSpace >= Math.min(320, preferredHeight) || belowSpace >= aboveSpace;
      const availableHeight = Math.max(120, openBelow ? belowSpace : aboveSpace);
      const maxHeight = Math.min(preferredHeight, availableHeight);
      const left = Math.min(Math.max(edge, rect.right - width), viewportWidth - width - edge);
      const top = openBelow ? rect.bottom + gap : Math.max(edge, rect.top - gap - maxHeight);
      setPosition({ top, left, width, maxHeight });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [triggerRef]);

  useEffect(() => {
    closeRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) onClose(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(true); return; }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [onClose, triggerRef]);

  return <div ref={panelRef} id="typing-settings-dialog" role="dialog" aria-modal="false" aria-labelledby="typing-settings-title" className="fixed z-[100] flex overscroll-contain rounded-xl bg-white text-slate-950 shadow-2xl ring-1 ring-slate-300" style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}>
    <div className="flex min-h-0 w-full flex-col overflow-hidden rounded-xl">
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3"><h2 id="typing-settings-title" className="font-black">Typing settings</h2><button ref={closeRef} type="button" onClick={() => onClose(true)} aria-label="Close typing settings" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-2xl font-black leading-none text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">×</button></header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">{children}</div>
    </div>
  </div>;
}

function ExamWorkspace({ preset, passage, inputSystem, fontAvailable, fontPreferences, setFontPreferences, encodingMismatch, rulesLocked, typedText, setTypedText, onFirstTypingInput, timerStarted, onInputSystemChange, timeLeft, paused, onPauseToggle, settings, setSettings, autoScroll, setAutoScroll, showScrollbar, setShowScrollbar, setBackspaces, onSubmit, practiceNavigation, onNavigateTest, durationMinutes, durationLocked, onDurationChange, showPassageWordCount, passageWordCount, passageWordCountLocked, onPassageWordCountChange }: WorkspaceProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null); const passageRef = useRef<HTMLDivElement>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const lockedPassageScrollTop = useRef(0); const lastActiveLine = useRef<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => { const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement)); document.addEventListener("fullscreenchange", onChange); return () => document.removeEventListener("fullscreenchange", onChange); }, []);
  const toggleFullscreen = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void workspaceRef.current?.requestFullscreen(); };
  // Printout Mode: a student who has a printed copy of the passage in hand
  // (via "Print / Download PDF" below) can hide the on-screen Original
  // Passage panel entirely and type from paper instead, matching how a real
  // paper-based typing exam works. This never touches scoring -- the same
  // passage is still compared against, the student just isn't shown it.
  const [printoutMode, setPrintoutMode] = useState(false);
  const [showPrintoutConfirm, setShowPrintoutConfirm] = useState(false);
  const printPassage = () => {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;
    const fontFace = inputSystem.requiredFontAsset ? `@font-face{font-family:"${inputSystem.fontLabel.split(" (")[0]}";src:url("${new URL(inputSystem.requiredFontAsset, window.location.origin).href}") format("truetype");}` : "";
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtmlForPrint(preset.title)} — Samradhi Classes</title><style>${fontFace}body{font-family:${inputSystem.fontStack};font-size:18px;line-height:1.8;white-space:pre-wrap;max-width:800px;margin:40px auto;padding:0 24px;color:#000}h1{font-family:Arial,sans-serif;font-size:20px;margin-bottom:4px}p.meta{font-family:Arial,sans-serif;font-size:12px;color:#555;margin-top:0}@media print{body{margin:0;padding:20px}}</style></head><body><h1>${escapeHtmlForPrint(preset.title)}</h1><p class="meta">Samradhi Classes &middot; ${inputSystem.language} &middot; ${inputSystem.fontLabel}</p><p lang="${inputSystem.language === "Hindi" ? "hi" : "en"}">${escapeHtmlForPrint(passage)}</p></body></html>`);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
  };
  const passageUnits = useMemo(() => segmentGraphemes(passage), [passage]);
  const typedUnitCount = useMemo(() => segmentGraphemes(normalizeTypingInput(typedText, inputSystem).comparisonText).length, [inputSystem, typedText]);
  const highlightStart = settings.highlightMode === "word" ? Math.max(0, passageUnits.lastIndexOf(" ", Math.max(0, typedUnitCount - 1)) + 1) : typedUnitCount;
  const nextWordSpace = passageUnits.indexOf(" ", typedUnitCount);
  const highlightEnd = settings.highlightMode === "word" ? (nextWordSpace < 0 ? passageUnits.length : nextWordSpace) : typedUnitCount + 1;
  const allowed = (start: number, end: number, value: string) => isAllowedTypingEdit({ previousValue: typedText, nextValue: value, selectionStart: start, selectionEnd: end, mode: settings.backspaceMode, maximumLength: passage.length });
  useEffect(() => {
    if (!autoScroll || paused) { lastActiveLine.current = null; return; }
    const original = passageRef.current; const typing = textareaRef.current;
    const marker = original?.querySelector<HTMLElement>("[data-current-character]");
    if (!original || !marker || !typing) return;
    const activeLine = marker.offsetTop;
    if (lastActiveLine.current === activeLine) return;
    lastActiveLine.current = activeLine;
    const originalTarget = Math.max(0, Math.min(original.scrollHeight - original.clientHeight, activeLine - original.clientHeight / 3));
    lockedPassageScrollTop.current = originalTarget;
    if (Math.abs(original.scrollTop - originalTarget) > 1) original.scrollTop = originalTarget;
    const typingMaximum = Math.max(0, typing.scrollHeight - typing.clientHeight);
    const typingProgress = typing.value.length ? typing.selectionStart / typing.value.length : 0;
    const typingTarget = Math.max(0, Math.min(typingMaximum, typingMaximum * typingProgress));
    if (Math.abs(typing.scrollTop - typingTarget) > typing.clientHeight * .25) typing.scrollTop = typingTarget;
  }, [autoScroll, fontPreferences.originalSize, fontPreferences.typingSize, paused, typedText]);
  useEffect(() => {
    const original = passageRef.current;
    if (!autoScroll || paused || !original) return;
    const restore = () => { if (Math.abs(original.scrollTop - lockedPassageScrollTop.current) > 1) original.scrollTop = lockedPassageScrollTop.current; };
    const preventManual = (event: Event) => { event.preventDefault(); restore(); };
    const preventScrollKeys = (event: KeyboardEvent) => { if (["ArrowUp","ArrowDown","PageUp","PageDown","Home","End"," "].includes(event.key)) preventManual(event); };
    original.addEventListener("scroll", restore);
    original.addEventListener("wheel", preventManual, { passive: false });
    original.addEventListener("touchmove", preventManual, { passive: false });
    original.addEventListener("keydown", preventScrollKeys);
    return () => { original.removeEventListener("scroll", restore); original.removeEventListener("wheel", preventManual); original.removeEventListener("touchmove", preventManual); original.removeEventListener("keydown", preventScrollKeys); };
  }, [autoScroll, paused]);
  const handleChange = (value: string) => { let prefix = 0; while (prefix < typedText.length && prefix < value.length && typedText[prefix] === value[prefix]) prefix++; let suffix = 0; while (suffix < typedText.length - prefix && suffix < value.length - prefix && typedText.at(-1 - suffix) === value.at(-1 - suffix)) suffix++; if (allowed(prefix, typedText.length - suffix, value)) { if (value !== typedText) onFirstTypingInput(); setTypedText(value); } };
  const keyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => { const { selectionStart: start, selectionEnd: end } = event.currentTarget; if (event.key === "Backspace") { setBackspaces((value) => value + 1); const from = start === end ? Math.max(0, start - 1) : start; if (!allowed(from, end, typedText.slice(0, from) + typedText.slice(end))) event.preventDefault(); } else if (event.key === "Delete") { const to = start === end ? Math.min(typedText.length, end + 1) : end; if (!allowed(start, to, typedText.slice(0, start) + typedText.slice(to))) event.preventDefault(); } else if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("en") === "x" && !allowed(start, end, typedText.slice(0, start) + typedText.slice(end))) { event.preventDefault(); } };
  const beforeInput = (event: React.FormEvent<HTMLTextAreaElement>) => {
    const nativeInputType = (event.nativeEvent as InputEvent).inputType;
    const inputType = typeof nativeInputType === "string" ? nativeInputType : "";

    if (inputType === "insertFromDrop" || inputType.startsWith("history")) {
      event.preventDefault();
    }
  };
  const update = (changes: Partial<TypingSettings>) => setSettings?.({ ...settings, ...changes });
  const resetSettings = () => {
    setFontPreferences(defaultTypingFontPreferences(inputSystem.script));
    setAutoScroll(true);
    setShowScrollbar(true);
    update({ highlightMode: DEFAULT_TYPING_SETTINGS.highlightMode, ...(rulesLocked ? {} : { backspaceMode: DEFAULT_TYPING_SETTINGS.backspaceMode, wordMethod: DEFAULT_TYPING_SETTINGS.wordMethod }) });
    if (!passageWordCountLocked) onPassageWordCountChange(null);
  };
  const closeSettings = (restoreFocus = false) => { setShowSettings(false); if (restoreFocus) window.setTimeout(() => settingsTriggerRef.current?.focus(), 0); };
  const activeText = passageUnits.slice(highlightStart, Math.max(highlightStart + 1, highlightEnd)).join("");
  return <main ref={workspaceRef} className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-slate-200">
    <header className="z-40 shrink-0 bg-blue-800 px-3 py-2 text-white shadow"><div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-2">
      <BackButton dark label="Back"/>
      {!practiceNavigation&&<div className="min-w-0"><strong className="block truncate">SAMRADHI CLASSES</strong><p className="truncate text-xs text-blue-100">{inputSystem.language} · {inputSystem.fontLabel} · {inputSystem.keyboardLayout}</p></div>}
      {practiceNavigation&&<nav aria-label="Practice test navigation" className="flex items-center gap-1.5"><button type="button" aria-label="Previous test" disabled={!practiceNavigation.previousHref} onClick={()=>practiceNavigation.previousHref&&onNavigateTest(practiceNavigation.previousHref)} className="grid h-8 w-8 place-items-center rounded-lg bg-white text-xl font-black text-blue-800 disabled:opacity-40">‹</button><select title={practiceNavigation.items[practiceNavigation.currentIndex]?.title} aria-label={`Select practice test. Current: ${practiceNavigation.items[practiceNavigation.currentIndex]?.title}`} value={practiceNavigation.items[practiceNavigation.currentIndex]?.href} onChange={(event)=>onNavigateTest(event.target.value)} className="h-8 w-24 rounded-lg border border-blue-300 bg-white px-1 text-center text-xs font-black text-slate-900 sm:w-40 sm:px-2">{practiceNavigation.items.map(item=><option key={item.href} value={item.href} title={item.title}>{item.label}</option>)}</select><button type="button" aria-label="Next test" disabled={!practiceNavigation.nextHref} onClick={()=>practiceNavigation.nextHref&&onNavigateTest(practiceNavigation.nextHref)} className="grid h-8 w-8 place-items-center rounded-lg bg-white text-xl font-black text-blue-800 disabled:opacity-40">›</button><div role="group" aria-label="Sort tests by" className="ml-1 flex overflow-hidden rounded-lg border border-blue-300 text-xs font-black"><button type="button" aria-pressed={practiceNavigation.sort==="newest"} onClick={()=>onNavigateTest(practiceNavigation.newestHref)} className={`px-2 py-1.5 ${practiceNavigation.sort==="newest"?"bg-white text-blue-800":"bg-blue-700 text-blue-100 hover:bg-blue-600"}`}>Newest</button><button type="button" aria-pressed={practiceNavigation.sort==="oldest"} onClick={()=>onNavigateTest(practiceNavigation.oldestHref)} className={`px-2 py-1.5 ${practiceNavigation.sort==="oldest"?"bg-white text-blue-800":"bg-blue-700 text-blue-100 hover:bg-blue-600"}`}>Oldest</button></div></nav>}
      <div className="ml-auto flex flex-wrap items-center justify-center gap-1.5 sm:gap-2" aria-label="Typing controls">
        <button type="button" onClick={onSubmit} className="rounded-lg bg-white px-4 py-2 text-xs font-black text-blue-800 hover:bg-blue-50">Submit</button>
        <button type="button" disabled={!timerStarted} onClick={onPauseToggle} aria-pressed={paused} className="rounded-lg bg-amber-100 px-4 py-2 text-xs font-black text-amber-950 disabled:cursor-not-allowed disabled:opacity-50">{paused ? "Resume" : "Pause"}</button>
        <span role="timer" aria-label={`${formatTime(timeLeft)} remaining`} className="min-w-20 rounded-lg bg-white px-3 py-1.5 text-center text-xl font-black text-red-600">{formatTime(timeLeft)}</span>
        <button ref={settingsTriggerRef} type="button" aria-haspopup="dialog" aria-expanded={showSettings} aria-controls="typing-settings-dialog" onClick={() => setShowSettings((open) => !open)} className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-black hover:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{showSettings ? "Close Settings" : "Settings"}</button>
        <button type="button" onClick={toggleFullscreen} aria-pressed={isFullscreen} aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"} title={isFullscreen ? "Exit full screen" : "Enter full screen"} className="grid h-8 w-8 place-items-center rounded-lg border border-blue-300 hover:bg-blue-600">{isFullscreen ? <span aria-hidden className="text-base font-black leading-none">✕</span> : <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>}</button>
        {!preset.audioUrl && <button type="button" onClick={printPassage} title="Print or save this passage as a PDF" className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-black hover:bg-blue-600">🖨️ Print / PDF</button>}
        {preset.pdfUrl && <a href={preset.pdfUrl} target="_blank" rel="noopener noreferrer" download={preset.pdfFileName ?? undefined} title="Download the question paper PDF the admin attached to this test" className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-black hover:bg-blue-600">📄 Download PDF</a>}
        {!preset.audioUrl && <button type="button" disabled={timerStarted} aria-pressed={printoutMode} onClick={() => (printoutMode ? setPrintoutMode(false) : setShowPrintoutConfirm(true))} title={printoutMode ? "Show the passage on screen again" : "Type from a printed copy instead of the on-screen passage"} className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-black hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50">{printoutMode ? "Exit Printout Mode" : "Printout Mode"}</button>}
        {showSettings && <TypingSettingsPopup triggerRef={settingsTriggerRef} onClose={closeSettings}>{encodingMismatch && <p role="alert" className="mb-3 rounded bg-red-100 px-2 py-1 text-xs font-bold text-red-800">Input encoding mismatch</p>}{preset.inputSystems.length > 1 && onInputSystemChange && <InputSystemOptions systems={preset.inputSystems} value={inputSystem.id} onChange={onInputSystemChange}/>}<UniversalTypingSettings compact settings={settings} autoScroll={autoScroll} showScrollbar={showScrollbar} fonts={fontPreferences} script={inputSystem.script} rulesLocked={rulesLocked} durationMinutes={durationMinutes} durationLocked={durationLocked} onDurationChange={onDurationChange} onSettingsChange={update} onScrollChange={setAutoScroll} onScrollbarChange={setShowScrollbar} onFontsChange={setFontPreferences} onReset={resetSettings} showPassageWordCount={showPassageWordCount} passageWordCount={passageWordCount} passageWordCountLocked={passageWordCountLocked} onPassageWordCountChange={onPassageWordCountChange}/></TypingSettingsPopup>}
      </div>
    </div></header>
    <section className="mx-auto min-h-0 w-full max-w-[1800px] flex-1 overflow-hidden p-2 sm:p-3" aria-label="Active typing workspace">
      <div className={`grid h-full min-h-0 overflow-hidden rounded-2xl border border-blue-300 bg-blue-100 shadow-xl ${preset.audioUrl || printoutMode ? "" : "grid-rows-[minmax(0,1fr)_minmax(0,1fr)]"}`}>
        {/* Dictation tests never reach this component until dictationReady
            is true (see the DictationGate render branch above), so there is
            never a passage -- or the audio player -- to show here: the
            typing panel below is the only row, matching "a blank area where
            he can type" from the exam workflow this is modeling. */}
        {!preset.audioUrl && !printoutMode && <section className="flex min-h-0 flex-col bg-white" aria-labelledby="original-passage-title"><h2 id="original-passage-title" className="shrink-0 border-b border-slate-200 bg-slate-800 px-4 py-2 text-sm font-black text-white">Original Passage</h2><div ref={passageRef} tabIndex={0} className="min-h-0 flex-1 p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 sm:p-5" style={{ fontFamily: inputSystem.fontStack, fontSize: `${fontPreferences.originalSize}px`, lineHeight: `${Math.round(fontPreferences.originalSize * 1.7)}px`, overflowY: showScrollbar ? "auto" : "hidden" }} lang={inputSystem.language === "Hindi" ? "hi" : "en"}>{fontAvailable === true ? <p className="whitespace-pre-wrap">{passageUnits.slice(0, highlightStart).join("")}<span data-current-character>{settings.highlightMode !== "none" && activeText ? <mark className="rounded bg-yellow-300 px-0.5">{activeText}</mark> : activeText || "\u200b"}</span>{passageUnits.slice(Math.max(highlightStart + 1, highlightEnd)).join("")}</p> : <p role="alert" className="font-sans font-bold text-red-700">Kruti Dev 010 cannot be displayed until the licensed font asset is installed.</p>}</div></section>}
        <section className="flex min-h-0 flex-col border-t-2 border-blue-300 bg-white" aria-labelledby="typing-passage-title"><h2 id="typing-passage-title" className="shrink-0 border-b border-slate-200 bg-slate-800 px-4 py-2 text-sm font-black text-white">Type Here</h2><textarea disabled={fontAvailable !== true || paused} ref={textareaRef} autoFocus value={typedText} onChange={(event) => handleChange(event.target.value)} onKeyDown={keyDown} onBeforeInput={beforeInput} onPaste={(event) => event.preventDefault()} onDrop={(event) => event.preventDefault()} onCut={(event) => { const target = event.currentTarget; if (!allowed(target.selectionStart, target.selectionEnd, typedText.slice(0, target.selectionStart) + typedText.slice(target.selectionEnd))) event.preventDefault(); }} spellCheck={false} aria-label="Type Here" placeholder={printoutMode ? "Type here from the printed passage you downloaded -- it is not shown on screen in Printout Mode." : undefined} lang={inputSystem.language === "Hindi" ? "hi" : "en"} style={{ fontFamily: inputSystem.fontStack, fontSize: `${fontPreferences.typingSize}px`, lineHeight: `${Math.round(fontPreferences.typingSize * 1.7)}px` }} className="min-h-0 w-full flex-1 resize-none overflow-y-auto p-4 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:p-5"/></section>
      </div>
    </section>
    {showPrintoutConfirm && <div role="presentation" className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-4" onMouseDown={() => setShowPrintoutConfirm(false)}><div role="dialog" aria-modal="true" aria-labelledby="printout-confirm-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><h2 id="printout-confirm-title" className="text-lg font-black text-slate-900">Type from a printed copy?</h2><p className="mt-3 text-sm leading-6 text-slate-700">Use <strong>Print / PDF</strong> first to print this exact passage, or save it as a PDF from your browser&apos;s print dialog. Then keep the printout in front of you -- the on-screen passage will be hidden and you&apos;ll type into a blank area instead.</p><p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-bold text-amber-900">Make sure the printout matches this exact test -- typing from the wrong passage will score incorrectly.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowPrintoutConfirm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">Cancel</button><button type="button" onClick={() => { setPrintoutMode(true); setShowPrintoutConfirm(false); }} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800">Start Printout Mode</button></div></div></div>}
  </main>;
}

