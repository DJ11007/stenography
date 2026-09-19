"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toTypeableKrutiDev } from "@/lib/hindi-font-converter";
import { GLYPH_KEYS as HINDI_GLYPH_KEYS } from "@/lib/krutidev-tutor-content";
import { GLYPH_KEYS as ENGLISH_GLYPH_KEYS } from "@/lib/english-tutor-content";
import { CATEGORIES, WORDTRIS_DIFFICULTY, WORDTRIS_CHARACTER_DIFFICULTY, wordtrisPoints, type WordtrisCategory, type WordtrisLanguage, type WordtrisMode } from "@/lib/wordtris-content";
import { TypingBrandHeader } from "../../_components/typing-brand";
import { getWordtrisLeaderboard, submitWordtrisScore, type LeaderboardRow } from "./actions";

const HI = '"Nirmala UI", "Noto Sans Devanagari", system-ui, sans-serif';
const KD = '"Kruti Dev 010", "Nirmala UI", sans-serif';
const { startingLives } = WORDTRIS_DIFFICULTY;

// A real teardrop silhouette (sampled bottom-half ellipse tangent to a
// single point at the top), not the rounded pill/bubble shape this
// replaced -- percent-based points, so it scales cleanly to whatever
// width/height the box around it ends up being (sized by its own text).
const DROP_POINTS = "50,0 8,68 9.43,76.28 13.63,84 20.3,90.63 29,95.71 39.13,98.91 50,100 60.87,98.91 71,95.71 79.7,90.63 86.37,84 90.57,76.28 92,68";

// Character mode's content: every plain, unshifted key that already
// carries real content on the Kruti Dev / English tutor keyboards (the
// same GLYPH_KEYS those tutors already use and verify) -- real, curated
// keyboard content, not a new hand-typed list at risk of the same
// byte-collision bugs this file's sibling, hindi-font-converter.ts, keeps
// finding. Kruti Dev's own bytes render as Devanagari purely through the
// KD font family below; the underlying characters are the same raw keys
// English mode shows literally.
const CHARACTER_POOL: Record<WordtrisLanguage, string[]> = {
  english: [...new Set(ENGLISH_GLYPH_KEYS.map((k) => k.normal).filter(Boolean))],
  hindi: [...new Set(HINDI_GLYPH_KEYS.map((k) => k.normal).filter(Boolean))],
};

// Small decorative drops drifting down behind the real, interactive one --
// purely atmosphere, fixed (not random) so they don't reshuffle every
// render. Non-interactive: aria-hidden and never read from.
const AMBIENT_DROPS = Array.from({ length: 5 }, (_, i) => ({
  left: `${6 + i * 21}%`,
  duration: `${3 + (i % 3) * 0.7}s`,
  delay: `${i * 0.6}s`,
}));

function shuffledPool(list: string[]) {
  const pool = [...list];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

type Step = "setup" | "playing" | "gameover";
type Props = { words: Record<WordtrisLanguage, Record<WordtrisCategory, string[]>> };

export function WordtrisGame({ words }: Props) {
  const [mode, setMode] = useState<WordtrisMode>("word");
  const [step, setStep] = useState<Step>("setup");
  const [language, setLanguage] = useState<WordtrisLanguage>("english");
  const [category, setCategory] = useState<WordtrisCategory>("easy_words");

  const [pool, setPool] = useState<string[]>([]);
  const [poolIndex, setPoolIndex] = useState(0);
  const [lives, setLives] = useState<number>(startingLives);
  const [score, setScore] = useState(0);
  const [wordsCaught, setWordsCaught] = useState(0);
  const [streak, setStreak] = useState(0);
  const [fallMs, setFallMs] = useState<number>(WORDTRIS_DIFFICULTY.baseFallMs);
  const [falling, setFalling] = useState(false);
  const [typed, setTyped] = useState("");
  const [flash, setFlash] = useState<"catch" | "miss" | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [leaderboardLimit, setLeaderboardLimit] = useState<10 | 20 | 50>(10);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);

  // Character mode drills single keystrokes, which need a fraction of a
  // whole word's fall time -- a different, faster difficulty curve, same
  // shape (ease off after a miss, ramp back up on a streak).
  const { baseFallMs, minFallMs, speedUpEveryStreak, speedUpFactor, missBreatherFactor } = mode === "character" ? WORDTRIS_CHARACTER_DIFFICULTY : WORDTRIS_DIFFICULTY;

  const currentItem = pool[poolIndex] ?? "";
  // Only word mode's Hindi content is stored as Unicode needing conversion
  // -- character mode's Hindi pool is already raw, typeable Kruti Dev
  // bytes (see CHARACTER_POOL above), so converting it again would mangle it.
  const target = mode === "word" && language === "hindi" ? (() => { try { return toTypeableKrutiDev(currentItem); } catch { return currentItem; } })() : currentItem;
  const fontFamily = language === "hindi" ? KD : undefined;

  const startRound = useCallback((m: WordtrisMode, lang: WordtrisLanguage, cat: WordtrisCategory) => {
    const curve = m === "character" ? WORDTRIS_CHARACTER_DIFFICULTY : WORDTRIS_DIFFICULTY;
    setMode(m);
    setLanguage(lang);
    setCategory(cat);
    setPool(shuffledPool(m === "character" ? CHARACTER_POOL[lang] : words[lang][cat]));
    setPoolIndex(0);
    setLives(curve.startingLives);
    setScore(0);
    setWordsCaught(0);
    setStreak(0);
    setFallMs(curve.baseFallMs);
    setTyped("");
    setSubmitted(false);
    setStep("playing");
    setFalling(false);
    if (m === "character") {
      try { setPersonalBest(Number(localStorage.getItem(`wordtris-best-character-${lang}`)) || null); } catch { setPersonalBest(null); }
    }
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
    const points = wordtrisPoints(currentItem);
    setScore((s) => s + points);
    setWordsCaught((w) => w + 1);
    setFlash("catch");
    window.setTimeout(() => setFlash(null), 350);
    const nextStreak = streak + 1;
    setStreak(nextStreak);
    const speedUp = nextStreak > 0 && nextStreak % speedUpEveryStreak === 0;
    const nextFallMs = speedUp ? Math.max(minFallMs, fallMs * speedUpFactor) : fallMs;
    nextWord(nextFallMs);
  }, [currentItem, fallMs, streak, nextWord, minFallMs, speedUpEveryStreak, speedUpFactor]);

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
  }, [fallMs, nextWord, baseFallMs, missBreatherFactor]);

  useEffect(() => {
    if (step === "playing") requestAnimationFrame(() => inputRef.current?.focus());
  }, [step, poolIndex]);

  useEffect(() => {
    if (step !== "gameover" || submitted) return;
    setSubmitted(true);
    if (mode === "word") {
      void submitWordtrisScore(language, category, score, wordsCaught);
      void getWordtrisLeaderboard(language, category, leaderboardLimit).then(setLeaderboard);
    } else {
      // Character mode has no server-side leaderboard (its scores aren't
      // comparable across the word-category point scheme the real
      // leaderboard is scoped by) -- just a personal best, kept locally.
      try {
        const key = `wordtris-best-character-${language}`;
        const prev = Number(localStorage.getItem(key)) || 0;
        if (score > prev) localStorage.setItem(key, String(score));
        setPersonalBest(Math.max(prev, score));
      } catch { /* private browsing / storage disabled -- personal best just won't persist */ }
    }
  }, [step, submitted, mode, language, category, score, wordsCaught, leaderboardLimit]);

  useEffect(() => {
    if (step !== "gameover" || mode !== "word") return;
    void getWordtrisLeaderboard(language, category, leaderboardLimit).then(setLeaderboard);
  }, [leaderboardLimit, step, mode, language, category]);

  const handleTyped = (value: string) => {
    setTyped(value);
    const matches = language === "hindi" ? value === target : value.trim().toLowerCase() === currentItem.toLowerCase();
    if (matches && value.length > 0) onCatch();
  };

  const displayCategories = useMemo(() => CATEGORIES, []);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <TypingBrandHeader />
      <section className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/typing/games" className="text-sm font-bold text-blue-700">← Games</Link>
          <span className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-cyan-400 shadow-sm">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-3 w-2.5 fill-cyan-400" aria-hidden="true"><polygon points={DROP_POINTS} /></svg>
            WordTris · {mode === "character" ? "Character" : "Word"} Rain
          </span>
        </div>

        {step === "setup" && (
          <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="bg-slate-900 px-6 py-5">
              <div className="flex items-center gap-2.5">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-7 w-5 fill-cyan-400" aria-hidden="true"><polygon points={DROP_POINTS} /></svg>
                <h1 className="text-2xl font-black text-white">WordTris</h1>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">Catch each item before it lands. Miss one and you get a short breather; string catches together and it speeds back up.</p>
            </div>
            <div className="p-6">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Drill</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setMode("character")} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${mode === "character" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>Character</button>
                <button type="button" onClick={() => setMode("word")} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${mode === "word" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>Word</button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">{mode === "character" ? "Single keystrokes, dropped fast -- builds raw finger speed." : "Whole words by topic -- builds recognition and rhythm."}</p>

              <p className="mt-5 text-xs font-black uppercase tracking-wider text-slate-500">Language</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setLanguage("english")} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${language === "english" ? "bg-cyan-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>English</button>
                <button type="button" onClick={() => setLanguage("hindi")} style={{ fontFamily: HI }} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${language === "hindi" ? "bg-cyan-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>हिन्दी</button>
              </div>

              {mode === "word" ? (
                <>
                  <p className="mt-5 text-xs font-black uppercase tracking-wider text-slate-500">Category</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {displayCategories.map((cat) => (
                      <button key={cat.id} type="button" onClick={() => setCategory(cat.id)} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${category === cat.id ? "bg-cyan-50 text-cyan-800 ring-2 ring-cyan-600" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`} style={{ fontFamily: language === "hindi" ? HI : undefined }}>
                        {language === "hindi" ? cat.hi : cat.en}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">Every letter{language === "hindi" ? " and मात्रा" : ""} key on the {language === "hindi" ? "Kruti Dev" : "English"} keyboard, dropped one at a time.</p>
              )}

              <button type="button" onClick={() => startRound(mode, language, category)} className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-3 text-base font-black text-white shadow-lg transition hover:bg-slate-800">Start →</button>
            </div>
          </div>
        )}

        {step === "playing" && (
          <div className="mt-6 rounded-3xl bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1.5" aria-label={`${lives} lives left`}>
                {Array.from({ length: startingLives }).map((_, i) => (
                  <svg key={i} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className={`h-4 w-3 transition ${i < lives ? "fill-cyan-600" : "fill-slate-200"}`}>
                    <polygon points={DROP_POINTS} />
                  </svg>
                ))}
              </div>
              <div className="flex items-center gap-4 text-sm font-black text-slate-700">
                <span>Score <b className="text-lg text-slate-950">{score}</b></span>
                <span>Streak <b className="text-lg text-slate-950">{streak}</b></span>
              </div>
            </div>

            <div ref={laneRef} className={`wordtris-rain-lane relative mt-4 h-80 overflow-hidden rounded-2xl ring-1 ring-slate-700 transition ${flash === "catch" ? "ring-4 ring-emerald-400" : flash === "miss" ? "ring-4 ring-rose-400" : ""}`}>
              {AMBIENT_DROPS.map((drop, i) => (
                <svg
                  key={i}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="animate-wordtris-ambient-fall absolute h-6 w-4 fill-slate-500/40"
                  style={{ left: drop.left, animationDuration: drop.duration, animationDelay: drop.delay }}
                >
                  <polygon points={DROP_POINTS} />
                </svg>
              ))}
              {currentItem && (
                <div
                  className="absolute left-1/2"
                  style={{
                    top: falling ? "calc(100% - 3.5rem)" : "1.25rem",
                    transform: "translateX(-50%)",
                    // No transition while snapping back to the top between
                    // words -- only while actually falling. Without this,
                    // the reset itself animates over fallMs too (since CSS
                    // transitions apply to any change, not just the fall),
                    // making every catch look like the word floats back up
                    // before falling again instead of an instant respawn.
                    transition: falling ? `top ${fallMs}ms linear` : "none",
                  }}
                  onTransitionEnd={() => { if (falling) onMiss(); }}
                >
                  <div className="relative min-w-16 px-5 pb-3.5 pt-8 text-center text-lg font-black text-white drop-shadow-[0_6px_18px_rgba(8,145,178,0.6)]" style={{ fontFamily }}>
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 -z-10 h-full w-full" aria-hidden="true">
                      <defs>
                        <linearGradient id="wordtris-drop-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" />
                          <stop offset="100%" stopColor="#0e7490" />
                        </linearGradient>
                      </defs>
                      <polygon points={DROP_POINTS} fill="url(#wordtris-drop-fill)" />
                      <ellipse cx="30" cy="58" rx="9" ry="15" fill="rgba(255,255,255,0.25)" />
                    </svg>
                    <span className="relative">{target}</span>
                  </div>
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
                aria-label={`Type the falling ${mode === "character" ? "character" : "word"}`}
                className="w-full rounded-xl border-2 border-slate-200 p-3 text-lg outline-none focus:border-slate-500"
                style={{ fontFamily }}
                placeholder={mode === "character" ? "Type the key above…" : "Type the word above…"}
              />
            </div>
          </div>
        )}

        {step === "gameover" && (
          <div className="mt-6 space-y-5">
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="bg-slate-900 px-6 py-6 text-center">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Round over</h2>
                <p className="mt-1 text-4xl font-black text-cyan-400">{score}</p>
                <p className="mt-1 text-sm font-bold text-slate-400">{wordsCaught} {mode === "character" ? (wordsCaught === 1 ? "character" : "characters") : (wordsCaught === 1 ? "word" : "words")} caught</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 p-5">
                <button type="button" onClick={() => startRound(mode, language, category)} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800">Play again</button>
                <button type="button" onClick={() => setStep("setup")} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">Change setup</button>
              </div>
            </div>

            {mode === "word" ? (
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-black text-slate-950">
                    Leaderboard — {language === "hindi" ? CATEGORIES.find((c) => c.id === category)?.hi : CATEGORIES.find((c) => c.id === category)?.en}
                  </h3>
                  <div className="flex overflow-hidden rounded-lg border border-slate-300 text-xs font-black">
                    {([10, 20, 50] as const).map((n) => (
                      <button key={n} type="button" onClick={() => setLeaderboardLimit(n)} className={`px-3 py-1.5 ${leaderboardLimit === n ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>Top {n}</button>
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
            ) : (
              <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
                <p className="text-sm font-bold text-slate-500">Your best — {language === "hindi" ? "हिन्दी" : "English"} characters</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{personalBest ?? score}</p>
                <p className="mt-2 text-xs text-slate-400">Character-drill scores are kept on this device only. The Top-50 leaderboard is for Word mode.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
