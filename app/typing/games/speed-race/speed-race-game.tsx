"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CATEGORIES, type WordtrisCategory, type WordtrisLanguage } from "@/lib/wordtris-content";
import { SPEEDRACE_WORDS_PER_RACE, SPEEDRACE_DEFAULT_PACE_WPM, SPEEDRACE_MIN_PACE_WPM, SPEEDRACE_MAX_PACE_WPM, SPEEDRACE_BOOSTS_PER_RACE, buildSpeedRacePassage, speedRaceProgressAtElapsed, speedRaceNetWpm, speedRaceAccuracy } from "@/lib/speedrace-content";
import { TypingBrandHeader } from "../../_components/typing-brand";

const HI = '"Nirmala UI", "Noto Sans Devanagari", system-ui, sans-serif';
const KD = '"Kruti Dev 010", "Nirmala UI", sans-serif';

type Step = "setup" | "racing" | "finished";
type Props = { words: Record<WordtrisLanguage, Record<WordtrisCategory, string[]>> };
type FinishStats = { wpm: number; accuracy: number; timeMs: number; isNewBest: boolean };

// The live race clock ticks on this schedule while racing -- independent
// of typing itself -- so the pace car and personal-best ghost keep moving
// in real time even while the student is reading ahead, not typing.
const TRACK_TICK_MS = 100;

function Racetrack({ label, progress, marker, tone }: { label: string; progress: number; marker: string; tone: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
      <div className="relative h-2.5 flex-1 rounded-full bg-slate-200">
        <span aria-hidden="true" className="absolute -right-0.5 -top-2.5 text-base">🏁</span>
        <div
          aria-hidden="true"
          className={`absolute -top-3.5 flex h-7 w-7 items-center justify-center rounded-full text-sm shadow-md transition-[left] duration-100 ease-linear ${tone}`}
          style={{ left: `calc(${Math.min(100, progress * 100)}% - 14px)` }}
        >
          {marker}
        </div>
      </div>
    </div>
  );
}

export function SpeedRaceGame({ words }: Props) {
  const [step, setStep] = useState<Step>("setup");
  const [language, setLanguage] = useState<WordtrisLanguage>("english");
  const [category, setCategory] = useState<WordtrisCategory>("easy_words");
  const [paceWpm, setPaceWpm] = useState(SPEEDRACE_DEFAULT_PACE_WPM);

  const [passage, setPassage] = useState("");
  const [typed, setTyped] = useState("");
  const [boostsLeft, setBoostsLeft] = useState(SPEEDRACE_BOOSTS_PER_RACE);
  const [boostFlash, setBoostFlash] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finishStats, setFinishStats] = useState<FinishStats | null>(null);
  const [personalBest, setPersonalBest] = useState<number | null>(null);

  const startedAtRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fontFamily = language === "hindi" ? KD : undefined;
  const bestKey = `speedrace-best-${language}-${category}`;

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(bestKey));
      setPersonalBest(Number.isFinite(v) && v > 0 ? v : null);
    } catch { setPersonalBest(null); }
  }, [bestKey]);

  const finishRace = useCallback((finalTyped: string, currentPassage: string) => {
    const timeMs = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    let correct = 0;
    for (let i = 0; i < finalTyped.length; i += 1) if (finalTyped[i] === currentPassage[i]) correct += 1;
    const wpm = Math.round(speedRaceNetWpm(correct, timeMs));
    const accuracy = speedRaceAccuracy(correct, finalTyped.length);
    let isNewBest = false;
    try {
      const prev = Number(localStorage.getItem(bestKey)) || 0;
      if (wpm > prev) {
        localStorage.setItem(bestKey, String(wpm));
        setPersonalBest(wpm);
        isNewBest = true;
      }
    } catch { /* private browsing / storage disabled -- personal best just won't persist */ }
    setFinishStats({ wpm, accuracy, timeMs, isNewBest });
    setStep("finished");
  }, [bestKey]);

  const startRace = useCallback(() => {
    const pool = words[language]?.[category] ?? [];
    const nextPassage = buildSpeedRacePassage(pool);
    setPassage(nextPassage);
    setTyped("");
    setBoostsLeft(SPEEDRACE_BOOSTS_PER_RACE);
    setElapsedMs(0);
    setFinishStats(null);
    startedAtRef.current = null;
    setStep("racing");
  }, [words, language, category]);

  useEffect(() => {
    if (step !== "racing") return;
    const timer = window.setInterval(() => {
      if (startedAtRef.current) setElapsedMs(Date.now() - startedAtRef.current);
    }, TRACK_TICK_MS);
    return () => window.clearInterval(timer);
  }, [step]);

  useEffect(() => {
    if (step === "racing") requestAnimationFrame(() => inputRef.current?.focus());
  }, [step]);

  const handleTyped = (value: string) => {
    if (step !== "racing") return;
    if (!startedAtRef.current && value.length > 0) startedAtRef.current = Date.now();
    const clipped = value.length > passage.length ? value.slice(0, passage.length) : value;
    setTyped(clipped);
    if (passage.length > 0 && clipped.length >= passage.length) finishRace(clipped, passage);
  };

  // One boost per race -- instantly completes whichever word the student
  // is currently stuck on, the same "spend a one-time resource to skip a
  // hard word" idea real typing-race games use (see lib/speedrace-content.ts).
  const useBoost = () => {
    if (boostsLeft <= 0 || step !== "racing") return;
    if (!startedAtRef.current) startedAtRef.current = Date.now();
    let end = passage.indexOf(" ", typed.length);
    end = end === -1 ? passage.length : end + 1;
    const next = passage.slice(0, end);
    setTyped(next);
    setBoostsLeft((b) => b - 1);
    setBoostFlash(true);
    window.setTimeout(() => setBoostFlash(false), 400);
    if (next.length >= passage.length) finishRace(next, passage);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    useBoost();
  };

  // Live HUD figures while racing -- finishStats holds the frozen final
  // numbers once the race actually ends.
  let liveCorrect = 0;
  for (let i = 0; i < typed.length; i += 1) if (typed[i] === passage[i]) liveCorrect += 1;
  const liveWpm = Math.round(speedRaceNetWpm(liveCorrect, elapsedMs || 1));
  const liveAccuracy = speedRaceAccuracy(liveCorrect, typed.length);

  const youProgress = passage.length ? typed.length / passage.length : 0;
  const paceProgress = speedRaceProgressAtElapsed(paceWpm, elapsedMs, passage.length);
  const ghostProgress = personalBest ? speedRaceProgressAtElapsed(personalBest, elapsedMs, passage.length) : 0;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <TypingBrandHeader backHref="/typing/games" backLabel="Games" />
      <section className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-amber-400 shadow-sm">
            🏁 Speed Race
          </span>
        </div>

        {step === "setup" && (
          <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="bg-slate-900 px-6 py-5">
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="text-2xl">🏎️</span>
                <h1 className="text-2xl font-black text-white">Speed Race</h1>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">Type a full passage as fast and accurately as you can -- your car advances as you go. Race against a pace car set to a real WPM, and against a ghost of your own personal best. One boost per race instantly finishes whatever word you're stuck on (press Tab).</p>
            </div>
            <div className="p-6">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Language</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setLanguage("english")} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${language === "english" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>English</button>
                <button type="button" onClick={() => setLanguage("hindi")} style={{ fontFamily: HI }} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${language === "hindi" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>हिन्दी</button>
              </div>

              <p className="mt-5 text-xs font-black uppercase tracking-wider text-slate-500">Category</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CATEGORIES.map((cat) => (
                  <button key={cat.id} type="button" onClick={() => setCategory(cat.id)} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${category === cat.id ? "bg-amber-50 text-amber-800 ring-2 ring-amber-600" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`} style={{ fontFamily: language === "hindi" ? HI : undefined }}>
                    {language === "hindi" ? cat.hi : cat.en}
                  </button>
                ))}
              </div>

              <p className="mt-5 text-xs font-black uppercase tracking-wider text-slate-500">Pace car speed</p>
              <div className="mt-2 flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-2.5">
                <button type="button" onClick={() => setPaceWpm((w) => Math.max(SPEEDRACE_MIN_PACE_WPM, w - 5))} aria-label="Decrease pace car speed" className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black text-slate-700 shadow-sm hover:bg-slate-100">−</button>
                <span className="flex-1 text-center text-sm font-black text-slate-800">{paceWpm} WPM</span>
                <button type="button" onClick={() => setPaceWpm((w) => Math.min(SPEEDRACE_MAX_PACE_WPM, w + 5))} aria-label="Increase pace car speed" className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black text-slate-700 shadow-sm hover:bg-slate-100">+</button>
              </div>
              {personalBest && <p className="mt-1.5 text-xs text-slate-500">Your best on this category: <b className="text-slate-700">{personalBest} WPM</b> -- that ghost races too.</p>}

              <button type="button" onClick={startRace} className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-3 text-base font-black text-white shadow-lg transition hover:bg-slate-800">Start Race →</button>
            </div>
          </div>
        )}

        {step === "racing" && (
          <div className="mt-6 rounded-3xl bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-black text-slate-700">
              <span>WPM <b className="text-lg text-slate-950">{liveWpm}</b></span>
              <span>Accuracy <b className="text-lg text-slate-950">{liveAccuracy}%</b></span>
              <span>Time <b className="text-lg text-slate-950">{(elapsedMs / 1000).toFixed(1)}s</b></span>
              <button
                type="button"
                onClick={useBoost}
                disabled={boostsLeft <= 0}
                className={`rounded-lg px-4 py-2 text-xs font-black transition ${boostsLeft > 0 ? "bg-amber-500 text-white hover:bg-amber-600" : "cursor-not-allowed bg-slate-100 text-slate-400"} ${boostFlash ? "animate-speedrace-boost-flash" : ""}`}
              >
                ⚡ Boost ({boostsLeft} left) -- Tab
              </button>
            </div>

            <div className="mt-5 space-y-4 rounded-2xl bg-slate-50 p-5">
              <Racetrack label="You" progress={youProgress} marker="🚗" tone="bg-amber-500" />
              <Racetrack label="Pace" progress={paceProgress} marker="🚙" tone="bg-slate-500" />
              {personalBest && <Racetrack label="Best" progress={ghostProgress} marker="👻" tone="bg-violet-500" />}
            </div>

            <p className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-xl leading-9 tracking-wide" style={{ fontFamily }}>
              {[...passage].map((ch, i) => {
                const cls = i < typed.length
                  ? (typed[i] === ch ? "text-emerald-600" : "rounded bg-rose-200 text-rose-700")
                  : i === typed.length
                    ? "rounded bg-amber-300 text-slate-900"
                    : "text-slate-400";
                return <span key={i} className={cls}>{ch === " " ? " " : ch}</span>;
              })}
            </p>

            <div className="mt-3">
              <input
                ref={inputRef}
                value={typed}
                onChange={(event) => handleTyped(event.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoFocus
                aria-label="Type the passage above"
                className="w-full rounded-xl border-2 border-slate-200 p-3 text-lg outline-none focus:border-slate-500"
                style={{ fontFamily }}
                placeholder="Start typing the passage above…"
              />
            </div>
          </div>
        )}

        {step === "finished" && finishStats && (
          <div className="mt-6 space-y-5">
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="bg-slate-900 px-6 py-6 text-center">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Race finished</h2>
                <p className="mt-1 text-4xl font-black text-amber-400">{finishStats.wpm} WPM</p>
                <p className="mt-1 text-sm font-bold text-slate-400">{finishStats.accuracy}% accuracy · {(finishStats.timeMs / 1000).toFixed(1)}s</p>
                {finishStats.isNewBest && <p className="mt-3 inline-block rounded-full bg-amber-500/20 px-4 py-1.5 text-xs font-black text-amber-300">🏆 New personal best!</p>}
              </div>
              <div className="flex flex-wrap justify-center gap-2 p-5">
                <button type="button" onClick={startRace} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800">Race again</button>
                <button type="button" onClick={() => setStep("setup")} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">Change setup</button>
              </div>
            </div>
            <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-500">Personal-best scores are kept on this device only, per language and category.</p>
              <p className="mt-2 text-xs text-slate-400">{SPEEDRACE_WORDS_PER_RACE} words per race · pace car set to {paceWpm} WPM</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
