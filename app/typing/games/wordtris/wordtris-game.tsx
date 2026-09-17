"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toTypeableKrutiDev } from "@/lib/hindi-font-converter";
import { CATEGORIES, WORDTRIS_DIFFICULTY, wordtrisPoints, type WordtrisCategory, type WordtrisLanguage } from "@/lib/wordtris-content";
import { TypingBrandHeader } from "../../_components/typing-brand";
import { getWordtrisLeaderboard, submitWordtrisScore, type LeaderboardRow } from "./actions";

const HI = '"Nirmala UI", "Noto Sans Devanagari", system-ui, sans-serif';
const KD = '"Kruti Dev 010", "Nirmala UI", sans-serif';
const { startingLives, baseFallMs, minFallMs, speedUpEveryStreak, speedUpFactor, missBreatherFactor } = WORDTRIS_DIFFICULTY;

type Step = "setup" | "playing" | "gameover";
type Props = { words: Record<WordtrisLanguage, Record<WordtrisCategory, string[]>> };

function shuffledPool(list: string[]) {
  const pool = [...list];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export function WordtrisGame({ words }: Props) {
  const [step, setStep] = useState<Step>("setup");
  const [language, setLanguage] = useState<WordtrisLanguage>("english");
  const [category, setCategory] = useState<WordtrisCategory>("easy_words");

  const [pool, setPool] = useState<string[]>([]);
  const [poolIndex, setPoolIndex] = useState(0);
  const [lives, setLives] = useState<number>(startingLives);
  const [score, setScore] = useState(0);
  const [wordsCaught, setWordsCaught] = useState(0);
  const [streak, setStreak] = useState(0);
  const [fallMs, setFallMs] = useState<number>(baseFallMs);
  const [falling, setFalling] = useState(false);
  const [typed, setTyped] = useState("");
  const [flash, setFlash] = useState<"catch" | "miss" | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [leaderboardLimit, setLeaderboardLimit] = useState<10 | 20 | 50>(10);
  const inputRef = useRef<HTMLInputElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);

  const currentWord = pool[poolIndex] ?? "";
  const target = language === "hindi" ? (() => { try { return toTypeableKrutiDev(currentWord); } catch { return currentWord; } })() : currentWord;
  const fontFamily = language === "hindi" ? KD : undefined;

  const startRound = useCallback((lang: WordtrisLanguage, cat: WordtrisCategory) => {
    setLanguage(lang);
    setCategory(cat);
    setPool(shuffledPool(words[lang][cat]));
    setPoolIndex(0);
    setLives(startingLives);
    setScore(0);
    setWordsCaught(0);
    setStreak(0);
    setFallMs(baseFallMs);
    setTyped("");
    setSubmitted(false);
    setStep("playing");
    setFalling(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setFalling(true)));
  }, [words]);

  const nextWord = useCallback((nextFallMs: number) => {
    setPoolIndex((i) => (i + 1 >= pool.length ? 0 : i + 1));
    if (poolIndex + 1 >= pool.length) setPool((p) => shuffledPool(p));
    setFallMs(nextFallMs);
    setTyped("");
    setFalling(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setFalling(true)));
  }, [pool.length, poolIndex]);

  const onCatch = useCallback(() => {
    const points = wordtrisPoints(currentWord);
    setScore((s) => s + points);
    setWordsCaught((w) => w + 1);
    setFlash("catch");
    window.setTimeout(() => setFlash(null), 350);
    const nextStreak = streak + 1;
    setStreak(nextStreak);
    const speedUp = nextStreak > 0 && nextStreak % speedUpEveryStreak === 0;
    const nextFallMs = speedUp ? Math.max(minFallMs, fallMs * speedUpFactor) : fallMs;
    nextWord(nextFallMs);
  }, [currentWord, fallMs, streak, nextWord]);

  const onMiss = useCallback(() => {
    setFlash("miss");
    window.setTimeout(() => setFlash(null), 350);
    setStreak(0);
    const eased = Math.min(baseFallMs, fallMs * missBreatherFactor);
    setLives((l) => {
      const left = l - 1;
      if (left <= 0) {
        setStep("gameover");
        return 0;
      }
      nextWord(eased);
      return left;
    });
  }, [fallMs, nextWord]);

  useEffect(() => {
    if (step === "playing") requestAnimationFrame(() => inputRef.current?.focus());
  }, [step, poolIndex]);

  useEffect(() => {
    if (step !== "gameover" || submitted) return;
    setSubmitted(true);
    void submitWordtrisScore(language, category, score, wordsCaught);
    void getWordtrisLeaderboard(language, category, leaderboardLimit).then(setLeaderboard);
  }, [step, submitted, language, category, score, wordsCaught, leaderboardLimit]);

  useEffect(() => {
    if (step !== "gameover") return;
    void getWordtrisLeaderboard(language, category, leaderboardLimit).then(setLeaderboard);
  }, [leaderboardLimit, step, language, category]);

  const handleTyped = (value: string) => {
    setTyped(value);
    const matches = language === "hindi" ? value === target : value.trim().toLowerCase() === currentWord.toLowerCase();
    if (matches && value.length > 0) onCatch();
  };

  const displayCategories = useMemo(() => CATEGORIES, []);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <TypingBrandHeader />
      <section className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/typing/games" className="text-sm font-bold text-blue-700">← Games</Link>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-cyan-600 shadow-sm">WordTris · Cloud Rain</span>
        </div>

        {step === "setup" && (
          <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-black text-slate-950">WordTris</h1>
            <p className="mt-2 text-slate-600">Catch each word before it lands. Miss one and you get a short breather; string catches together and it speeds back up.</p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setLanguage("english")} className={`rounded-lg px-4 py-2 text-sm font-black ${language === "english" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-600"}`}>English</button>
              <button type="button" onClick={() => setLanguage("hindi")} className={`rounded-lg px-4 py-2 text-sm font-black ${language === "hindi" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-600"}`}>हिन्दी</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {displayCategories.map((cat) => (
                <button key={cat.id} type="button" onClick={() => setCategory(cat.id)} className={`rounded-xl px-3 py-2 text-sm font-bold ${category === cat.id ? "bg-cyan-100 text-cyan-800 ring-2 ring-cyan-500" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`} style={{ fontFamily: language === "hindi" ? HI : undefined }}>
                  {language === "hindi" ? cat.hi : cat.en}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => startRound(language, category)} className="mt-6 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-3 text-base font-black text-white shadow-lg hover:brightness-105">Start →</button>
          </div>
        )}

        {step === "playing" && (
          <div className="mt-6 rounded-3xl bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1" aria-label={`${lives} lives left`}>
                {Array.from({ length: startingLives }).map((_, i) => (
                  <span key={i} aria-hidden className={`text-2xl transition ${i < lives ? "text-sky-500" : "text-slate-200"}`}>☁</span>
                ))}
              </div>
              <div className="flex items-center gap-4 text-sm font-black text-slate-700">
                <span>Score <b className="text-lg text-slate-950">{score}</b></span>
                <span>Streak <b className="text-lg text-slate-950">{streak}</b></span>
              </div>
            </div>

            <div ref={laneRef} className={`relative mt-4 h-80 overflow-hidden rounded-2xl bg-gradient-to-b from-sky-100 to-blue-50 ring-1 ring-sky-200 transition ${flash === "catch" ? "ring-4 ring-emerald-400" : flash === "miss" ? "ring-4 ring-rose-400" : ""}`}>
              <div className="absolute left-1/2 top-2 -translate-x-1/2 text-4xl opacity-70" aria-hidden>☁</div>
              {currentWord && (
                <div
                  className="absolute left-1/2 rounded-full rounded-b-[999px] bg-blue-600/90 px-5 py-2 text-lg font-black text-white shadow-lg"
                  style={{
                    top: falling ? "calc(100% - 3rem)" : "3rem",
                    transform: "translateX(-50%)",
                    // No transition while snapping back to the top between
                    // words -- only while actually falling. Without this,
                    // the reset itself animates over fallMs too (since CSS
                    // transitions apply to any change, not just the fall),
                    // making every catch look like the word floats back up
                    // before falling again instead of an instant respawn.
                    transition: falling ? `top ${fallMs}ms linear` : "none",
                    fontFamily,
                  }}
                  onTransitionEnd={() => { if (falling) onMiss(); }}
                >
                  {target}
                </div>
              )}
            </div>

            <div className="mt-3">
              <input
                ref={inputRef}
                value={typed}
                onChange={(event) => handleTyped(event.target.value)}
                spellCheck={false}
                autoFocus
                aria-label="Type the falling word"
                className="w-full rounded-xl border-2 border-slate-200 p-3 text-lg outline-none focus:border-cyan-500"
                style={{ fontFamily }}
                placeholder="Type the word above…"
              />
            </div>
          </div>
        )}

        {step === "gameover" && (
          <div className="mt-6 space-y-5">
            <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
              <h2 className="text-xl font-black text-slate-950">Game over</h2>
              <p className="mt-2 text-4xl font-black text-cyan-700">{score}</p>
              <p className="mt-1 text-sm font-bold text-slate-500">{wordsCaught} words caught</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => startRound(language, category)} className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-black text-white hover:bg-cyan-700">Play again</button>
                <button type="button" onClick={() => setStep("setup")} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">Change category</button>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black text-slate-950">
                  Leaderboard — {language === "hindi" ? CATEGORIES.find((c) => c.id === category)?.hi : CATEGORIES.find((c) => c.id === category)?.en}
                </h3>
                <div className="flex overflow-hidden rounded-lg border border-slate-300 text-xs font-black">
                  {([10, 20, 50] as const).map((n) => (
                    <button key={n} type="button" onClick={() => setLeaderboardLimit(n)} className={`px-3 py-1.5 ${leaderboardLimit === n ? "bg-cyan-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>Top {n}</button>
                  ))}
                </div>
              </div>
              <ol className="mt-4 space-y-1.5">
                {leaderboard.map((row, i) => (
                  <li key={row.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-bold text-slate-700">{i + 1}. {row.student_name}</span>
                    <span className="font-black text-slate-950">{row.score}</span>
                  </li>
                ))}
                {!leaderboard.length && <p className="text-center text-sm text-slate-500">No scores yet — you could be first.</p>}
              </ol>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
