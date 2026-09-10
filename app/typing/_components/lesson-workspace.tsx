"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { calculateTypingScore, isAllowedTypingEdit, type TypingSettings } from "@/lib/typing-test";
import { ENGLISH_QWERTY, HINDI_INPUT_SYSTEMS, type ExamPreset, type LessonProgress, type TypingLesson } from "@/lib/typing-curriculum";
import { getScoringText, normalizeTypingInput, type InputSystem } from "@/lib/typing-language";
import { TypingBrandHeader } from "./typing-brand";
import { AdvancedTypingResults } from "./advanced-typing-results";
import { UniversalTypingSettings } from "./universal-typing-settings";
import { useTypingPlatformSettings } from "./typing-platform-provider";

const PROGRESS_KEY = "samradhi-typing-lesson-progress-v2";
const TIMED_SECONDS = 60;
const LESSON_INPUT_SYSTEMS: InputSystem[] = [ENGLISH_QWERTY, ...HINDI_INPUT_SYSTEMS];
// The passage/keyboard/finger UI keys off the raw target character. For a
// Hindi lesson that's a Kruti Dev legacy byte, meaningless to the QWERTY
// keyboard guidance -- so only that font swap and the scoring
// normalization change; the physical-key guidance stays English-shaped.
function resolveLessonInputSystem(inputSystemId: string | null | undefined) {
  return LESSON_INPUT_SYSTEMS.find((system) => system.id === inputSystemId) ?? ENGLISH_QWERTY;
}
const keyboardRows = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "?"],
  ["space"],
];

const fingerByKey: Record<string, string> = {
  "1": "Left little", q: "Left little", a: "Left little", z: "Left little",
  "2": "Left ring", w: "Left ring", s: "Left ring", x: "Left ring",
  "3": "Left middle", e: "Left middle", d: "Left middle", c: "Left middle",
  "4": "Left index", "5": "Left index", r: "Left index", t: "Left index", f: "Left index", g: "Left index", v: "Left index", b: "Left index",
  "6": "Right index", "7": "Right index", y: "Right index", u: "Right index", h: "Right index", j: "Right index", n: "Right index", m: "Right index",
  "8": "Right middle", i: "Right middle", k: "Right middle", ",": "Right middle",
  "9": "Right ring", o: "Right ring", l: "Right ring", ".": "Right ring",
  "0": "Right little", p: "Right little", ";": "Right little", "?": "Right little",
  space: "Either thumb",
};

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}") as Record<string, LessonProgress>; } catch { return {}; }
}

export function LessonWorkspace({ lesson, lessons: providedLessons }: { lesson: TypingLesson; lessons?: TypingLesson[] }) {
  const lessons = providedLessons ?? [lesson];
  const [mode, setMode] = useState<"learn" | "timed">("learn");
  const [typed, setTyped] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(TIMED_SECONDS);
  const [running, setRunning] = useState(false);
  const [learnSeconds, setLearnSeconds] = useState(0);
  const [progress, setProgress] = useState<Record<string, LessonProgress>>({});
  const [progressLoaded, setProgressLoaded] = useState(false);
  const { preferences, updatePreferences } = useTypingPlatformSettings();
  const timedSeconds = preferences.durationMinutes * 60;
  const attemptSaved = useRef(false);
  const target = mode === "learn" ? lesson.content : lesson.timedContent;
  const lessonInputSystem = useMemo(() => resolveLessonInputSystem(lesson.inputSystemId), [lesson.inputSystemId]);
  // Kruti Dev text is Latin-1 codepoints, so a script test on `target`
  // reports "Latin" and the Devanagari font never gets applied -- the
  // reported bug. Trust the input system's declared script instead.
  const lessonScript = lessonInputSystem.script === "Devanagari" ? "Devanagari" : "Latin";
  // Font to paint the passage + typing box in. Kruti Dev lessons carry a
  // legacy font in fontStack (their text is Latin-1 bytes the font maps to
  // Devanagari); a real-Unicode Devanagari lesson keeps the system stack;
  // anything else (English) stays on the default.
  const lessonFontStack = lessonInputSystem.requiredFontAsset
    ? lessonInputSystem.fontStack
    : /\p{Script=Devanagari}/u.test(target)
      ? '"Nirmala UI", Mangal, "Noto Sans Devanagari", sans-serif'
      : lessonInputSystem.id === ENGLISH_QWERTY.id
        ? undefined
        : lessonInputSystem.fontStack;
  const fontContext = lessonScript === "Devanagari" ? "devanagari" : "latin";
  const fontPreferences = preferences.fonts[fontContext];
  const [lessonFontReady, setLessonFontReady] = useState<boolean | null>(lessonInputSystem.requiredFontAsset ? null : true);
  useEffect(() => {
    if (!lessonInputSystem.requiredFontAsset) { setLessonFontReady(true); return; }
    let active = true;
    setLessonFontReady(null);
    fetch(lessonInputSystem.requiredFontAsset, { method: "HEAD", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return false;
        await document.fonts.load(`16px ${lessonInputSystem.fontStack}`);
        return document.fonts.check(`16px ${lessonInputSystem.fontStack}`);
      })
      .then((available) => { if (active) setLessonFontReady(available); })
      .catch(() => { if (active) setLessonFontReady(false); });
    return () => { active = false; };
  }, [lessonInputSystem]);
  const universalSettings: TypingSettings = { backspaceMode: preferences.backspaceMode, highlightMode: preferences.highlightMode, wordMethod: preferences.wordMethod, minWords: 150, maxWords: 1500 };
  const elapsedSeconds = mode === "timed" ? timedSeconds - secondsLeft : learnSeconds;
  const targetKey = target[typed.length]?.toLocaleLowerCase("en") === " " ? "space" : target[typed.length]?.toLocaleLowerCase("en") ?? "";
  const completed = typed.length >= target.length || (mode === "timed" && secondsLeft === 0);
  const lessonPreset: ExamPreset = useMemo(() => ({ id: `lesson-${lesson.id}`, slug: `lesson-${lesson.id}`, title: lesson.title, subtitle: `Lesson ${lesson.order}: ${lesson.category}`, category: "typing", language: lessonInputSystem.language, script: lessonInputSystem.script, inputEncoding: lessonInputSystem.inputEncoding, durationSeconds: timedSeconds, passage: target, fontLabel: lessonInputSystem.fontLabel, fontStack: lessonInputSystem.fontStack, fontClassName: "font-sans", layoutLabel: lessonInputSystem.keyboardLayout, keyboardLayout: lessonInputSystem.keyboardLayout, inputSystems: [lessonInputSystem], speedRequirement: 0, accuracyRequirement: lesson.unlockAccuracy, backspaceMode: preferences.backspaceMode, wordMethod: "characters", highlightMode: preferences.highlightMode, scoringProfile: { fullErrorPenalty: 1, halfErrorPenalty: 0.5, minorSpellingMaxDistance: 1, passNetWpm: 0, passAccuracy: lesson.unlockAccuracy } }), [lesson, lessonInputSystem, preferences.backspaceMode, preferences.highlightMode, target, timedSeconds]);
  // Kruti Dev's legacy bytes have NFC/NFD variants that render identically
  // but aren't string-equal across keyboard-driver installs -- comparing
  // raw typed vs raw target would flag correct typing as errors. Score
  // through the same normalize + getScoringText path configurable-typing-
  // exam uses for its own managed Kruti Dev tests.
  const scoringPassage = useMemo(() => getScoringText(target, lessonInputSystem), [target, lessonInputSystem]);
  const scoringTyped = useMemo(() => getScoringText(normalizeTypingInput(typed, lessonInputSystem).comparisonText, lessonInputSystem), [typed, lessonInputSystem]);
  const finalScore = useMemo(() => completed ? calculateTypingScore({ typedText: scoringTyped, passage: scoringPassage, elapsedSeconds: Math.max(1, elapsedSeconds), wordMethod: "characters", scoringProfile: lessonPreset.scoringProfile, includeUntypedWords: true }) : null, [completed, elapsedSeconds, lessonPreset.scoringProfile, scoringPassage, scoringTyped]);
  const score = finalScore ?? { accuracy: 0 };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProgress(loadProgress());
      setProgressLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (mode === "learn") {
        setLearnSeconds((value) => value + 1);
        return;
      }
      setSecondsLeft((value) => {
        if (value > 1) return value - 1;
        setRunning(false);
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [mode, running]);

  const weakKeys = useMemo(() => {
    if (!completed) return [];
    const counts = new Map<string, number>();
    [...typed].forEach((character, index) => { if (character !== target[index]) { const key = target[index]?.toLocaleLowerCase("en") || "space"; counts.set(key, (counts.get(key) ?? 0) + 1); } });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key]) => key === " " ? "space" : key);
  }, [completed, target, typed]);

  const saveAttempt = (attemptScore: ReturnType<typeof calculateTypingScore>, attemptWeakKeys: string[]) => {
    if (attemptSaved.current) return;
    attemptSaved.current = true;
    const previous = progress[lesson.id];
    const next: LessonProgress = { lessonId: lesson.id, completed: attemptScore.accuracy >= lesson.unlockAccuracy, bestAccuracy: Math.max(previous?.bestAccuracy ?? 0, attemptScore.accuracy), bestWpm: Math.max(previous?.bestWpm ?? 0, attemptScore.netWpm), attempts: (previous?.attempts ?? 0) + 1, weakKeys: attemptWeakKeys };
    const updated = { ...progress, [lesson.id]: next };
    setProgress(updated);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(updated));
  };

  const reset = (nextMode = mode) => { setMode(nextMode); setTyped(""); setSecondsLeft(timedSeconds); setLearnSeconds(0); setRunning(false); attemptSaved.current = false; };
  const changeFontPreferences = (next: typeof fontPreferences) => updatePreferences({ fonts: { ...preferences.fonts, [fontContext]: next } });
  const handleChange = (value: string) => {
    if (completed || value.length > target.length) return;
    let prefix = 0; while (prefix < typed.length && prefix < value.length && typed[prefix] === value[prefix]) prefix += 1;
    let suffix = 0; while (suffix < typed.length - prefix && suffix < value.length - prefix && typed.at(-1 - suffix) === value.at(-1 - suffix)) suffix += 1;
    if (!isAllowedTypingEdit({ previousValue: typed, nextValue: value, selectionStart: prefix, selectionEnd: typed.length - suffix, mode: preferences.backspaceMode, maximumLength: target.length })) return;
    setRunning(true);
    setTyped(value);
    if (value.length >= target.length) {
      setRunning(false);
      const finalScore = calculateTypingScore({ typedText: getScoringText(normalizeTypingInput(value, lessonInputSystem).comparisonText, lessonInputSystem), passage: getScoringText(target, lessonInputSystem), elapsedSeconds: Math.max(1, elapsedSeconds), wordMethod: "characters" });
      const counts = new Map<string, number>();
      [...value].forEach((character, index) => {
        if (character !== target[index]) {
          const key = target[index]?.toLocaleLowerCase("en") || "space";
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      });
      saveAttempt(finalScore, [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key]) => key));
    }
  };
  const currentIndex = lessons.findIndex((item) => item.id === lesson.id);
  const nextLesson = lessons[currentIndex + 1];
  const unlockedNext = typed.length >= target.length && (finalScore?.accuracy ?? 0) >= lesson.unlockAccuracy;
  const wordStart = preferences.highlightMode === "word" ? Math.max(0, target.lastIndexOf(" ", Math.max(0, typed.length - 1)) + 1) : typed.length;
  const nextSpace = target.indexOf(" ", typed.length);
  const wordEnd = preferences.highlightMode === "word" ? (nextSpace < 0 ? target.length : nextSpace) : typed.length + 1;

  if (!progressLoaded) {
    return <main className="min-h-screen bg-slate-100"><TypingBrandHeader/><p className="mx-auto max-w-7xl px-4 py-12 font-bold text-slate-600">Loading lesson progress…</p></main>;
  }
  if (completed && mode === "timed" && finalScore) {
    return <AdvancedTypingResults preset={lessonPreset} inputSystem={lessonInputSystem} passage={target} typedText={normalizeTypingInput(typed, lessonInputSystem).comparisonText} score={finalScore} backspaces={0} onRestart={() => reset("timed")}/>;
  }

  return <main className="min-h-screen bg-slate-100"><TypingBrandHeader/><section className="mx-auto max-w-7xl px-4 py-7"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/typing/learn" className="text-sm font-bold text-blue-700">← All lessons</Link><p className="mt-4 text-xs font-bold uppercase tracking-widest text-blue-600">Lesson {lesson.order} of {lessons.length}</p><h1 className="mt-1 text-3xl font-black text-slate-900">{lesson.title}</h1><p className="mt-2 text-slate-600">{lesson.shortDescription}</p></div><div className="inline-flex rounded-xl bg-white p-1 shadow" aria-label="Lesson mode"><button type="button" aria-pressed={mode === "learn"} onClick={() => reset("learn")} className={`rounded-lg px-5 py-2 text-sm font-bold ${mode === "learn" ? "bg-blue-600 text-white" : "text-slate-600"}`}>Learn</button><button type="button" aria-pressed={mode === "timed"} onClick={() => reset("timed")} className={`rounded-lg px-5 py-2 text-sm font-bold ${mode === "timed" ? "bg-blue-600 text-white" : "text-slate-600"}`}>Timed Practice</button></div></div>
  {mode === "timed" && <div role="timer" aria-label={`${secondsLeft} seconds remaining`} className="mt-5 ml-auto w-fit rounded-xl bg-white px-5 py-3 text-xl font-black text-red-600 shadow">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</div>}
  <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="space-y-5"><section className="rounded-2xl bg-white p-6 shadow"><h2 className="font-bold text-slate-900">Type the lesson line</h2>{lessonInputSystem.requiredFontAsset && lessonFontReady === false && <p role="status" className="mt-3 rounded-xl bg-amber-100 p-3 text-sm font-bold text-amber-900">The {lessonInputSystem.fontLabel} font could not be loaded, so this passage may look like plain letters. Install the font, then reload this page.</p>}<p className="mt-4 min-h-52 whitespace-pre-wrap rounded-xl bg-blue-50 p-5 text-slate-700" style={{ fontFamily: lessonFontStack, fontSize: `${fontPreferences.originalSize}px`, lineHeight: `${Math.round(fontPreferences.originalSize * 1.7)}px` }}>{target.slice(0, wordStart)}{preferences.highlightMode !== "none" ? <mark className="rounded bg-yellow-300 px-1">{target.slice(wordStart, wordEnd) || "✓"}</mark> : target.slice(wordStart, wordEnd)}{target.slice(wordEnd)}</p><textarea autoFocus value={typed} onChange={(event) => handleChange(event.target.value)} onPaste={(event) => event.preventDefault()} spellCheck={false} aria-label="Lesson typing area" style={{ fontFamily: lessonFontStack, fontSize: `${fontPreferences.typingSize}px`, lineHeight: `${Math.round(fontPreferences.typingSize * 1.7)}px` }} className="mt-4 h-64 w-full resize-none rounded-xl border-2 border-slate-200 p-4 text-lg leading-8 outline-none focus:border-blue-500" placeholder="Start typing here…"/></section><OnScreenKeyboard targetKey={targetKey}/></div>
  <aside className="space-y-5"><section className="rounded-2xl bg-white p-5 shadow"><UniversalTypingSettings durationMinutes={preferences.durationMinutes} durationLocked={running} onDurationChange={(durationMinutes) => { updatePreferences({ durationMinutes }); if (!running) setSecondsLeft(durationMinutes * 60); }} settings={universalSettings} autoScroll={preferences.autoScroll} fonts={fontPreferences} script={lessonScript} onSettingsChange={(changes) => updatePreferences(changes)} onScrollChange={(autoScroll) => updatePreferences({ autoScroll })} onFontsChange={changeFontPreferences}/></section><section className="rounded-2xl bg-white p-5 shadow"><h2 className="font-bold">Current key guidance</h2><div className="mt-4 rounded-xl bg-blue-700 p-5 text-center text-white"><p className="text-xs font-bold uppercase text-blue-100">Target key</p><p className="mt-1 text-4xl font-black">{targetKey === "space" ? "Space" : targetKey || "Done"}</p><p className="mt-2 text-sm">Recommended finger: <strong>{fingerByKey[targetKey] ?? "Follow normal touch-typing position"}</strong></p></div></section>{completed && <section className="rounded-2xl bg-white p-5 shadow"><h2 className="font-bold">Weak keys</h2><div className="mt-3 flex flex-wrap gap-2">{weakKeys.length ? weakKeys.map((key) => <span key={key} className="rounded-lg bg-red-100 px-3 py-2 text-sm font-bold text-red-700">Key {key}</span>) : <p className="text-sm text-slate-500">No weak keys detected yet.</p>}</div></section>}{completed && <section aria-live="polite" className={`rounded-2xl p-5 shadow ${unlockedNext ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900"}`}><h2 className="text-lg font-black">{unlockedNext ? "Lesson complete" : "Keep practising"}</h2><p className="mt-2 text-sm">You scored {score.accuracy}%. {unlockedNext ? "The next lesson is unlocked." : `Reach ${lesson.unlockAccuracy}% accuracy to unlock the next lesson.`}</p><div className="mt-4 grid gap-2">{unlockedNext && nextLesson && <Link href={`/typing/learn/${nextLesson.slug ?? nextLesson.id}`} className="rounded-lg bg-green-700 px-4 py-3 text-center font-bold text-white">Next lesson</Link>}<button type="button" onClick={() => reset()} className="rounded-lg bg-white px-4 py-3 font-bold">Repeat lesson</button></div></section>}</aside></div></section></main>;
}


function OnScreenKeyboard({ targetKey }: { targetKey: string }) { return <section className="rounded-2xl bg-slate-800 p-4 shadow sm:p-6" aria-label="On-screen keyboard"><h2 className="mb-4 font-bold text-white">On-screen keyboard</h2><div className="space-y-2">{keyboardRows.map((row, rowIndex) => <div key={rowIndex} className="flex justify-center gap-1 sm:gap-2">{row.map((key) => { const active = key === targetKey; return <div key={key} aria-label={`${key} key${active ? `, target key, use ${fingerByKey[key]}` : ""}`} className={`flex h-10 items-center justify-center rounded-md border text-[10px] font-bold sm:h-12 sm:text-sm ${key === "space" ? "w-2/3 max-w-sm" : "min-w-0 flex-1 sm:w-12 sm:flex-none"} ${active ? "border-yellow-200 bg-yellow-300 text-slate-900 ring-4 ring-yellow-300/30" : "border-slate-600 bg-slate-700 text-white"}`}>{key === "space" ? "Space" : key.toUpperCase()}</div>; })}</div>)}</div></section>; }
