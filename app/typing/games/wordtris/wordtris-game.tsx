"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toTypeableKrutiDev } from "@/lib/hindi-font-converter";
import { GLYPH_KEYS as HINDI_GLYPH_KEYS } from "@/lib/krutidev-tutor-content";
import { GLYPH_KEYS as ENGLISH_GLYPH_KEYS } from "@/lib/english-tutor-content";
import { CATEGORIES, WORDTRIS_STARTING_LIVES, WORDTRIS_WPM_MILESTONES, WORDTRIS_CATCHES_PER_MILESTONE, WORDTRIS_MISS_WPM_PENALTY, WORDTRIS_MIN_WPM, WORDTRIS_MAX_WPM, wordtrisFallMs, wordtrisSpawnMs, wordtrisNextMilestone, wordtrisPoints, type WordtrisCategory, type WordtrisLanguage, type WordtrisMode } from "@/lib/wordtris-content";
import { TypingBrandHeader } from "../../_components/typing-brand";
import { getWordtrisLeaderboard, submitWordtrisScore, type LeaderboardRow } from "./actions";

const HI = '"Nirmala UI", "Noto Sans Devanagari", system-ui, sans-serif';
const KD = '"Kruti Dev 010", "Nirmala UI", sans-serif';

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

// Small decorative drops drifting down behind the real, interactive ones --
// purely atmosphere, fixed (not random) so they don't reshuffle every
// render. Non-interactive: aria-hidden and never read from.
const AMBIENT_DROPS = Array.from({ length: 5 }, (_, i) => ({
  left: `${6 + i * 21}%`,
  duration: `${3 + (i % 3) * 0.7}s`,
  delay: `${i * 0.6}s`,
}));

// Real reported request: one item falling at a time never looked like
// "multiple drops" no matter how fast -- up to this many now fall at
// once, each in its own lane, spaced with enough margin that even the
// widest bundled word doesn't visually collide with its neighbours.
const LANE_POSITIONS = [16, 50, 84];
const MAX_CONCURRENT_DROPS = LANE_POSITIONS.length;
// How often the spawn scheduler re-checks whether it's time for a new
// drop -- independent of, and much shorter than, the actual spawn
// interval (baseSpawnMs..minSpawnMs), which changes as speedLevel moves.
const SPAWN_TICK_MS = 150;

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
type ActiveDrop = { id: number; text: string; target: string; lane: number; fallMs: number; spawnedAt: number };

function FallingDropView({ drop, fontFamily, typedLength, onMiss }: { drop: ActiveDrop; fontFamily?: string; typedLength: number; onMiss: (id: number) => void }) {
  const [falling, setFalling] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setFalling(true)));
  }, []);
  const locked = typedLength > 0;
  return (
    <div
      className="absolute"
      style={{
        left: `${LANE_POSITIONS[drop.lane]}%`,
        top: falling ? "calc(100% - 4.75rem)" : "1rem",
        transform: "translateX(-50%)",
        // No transition while snapping to the top on mount -- only while
        // actually falling. Without this, appearing itself animates too
        // (CSS transitions apply to any style change, not just the fall).
        transition: falling ? `top ${drop.fallMs}ms linear` : "none",
      }}
      onTransitionEnd={() => { if (falling) onMiss(drop.id); }}
    >
      <div className={`relative min-w-24 rounded-2xl px-7 pb-5 pt-11 text-center text-2xl font-black text-white drop-shadow-[0_6px_18px_rgba(8,145,178,0.6)] transition ${locked ? "ring-4 ring-amber-300" : ""}`} style={{ fontFamily }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 -z-10 h-full w-full" aria-hidden="true">
          <defs>
            {/* Unique id per concurrent drop -- several of these render at
                once now, so a shared id would be a duplicate DOM id. */}
            <linearGradient id={`wordtris-drop-fill-${drop.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={locked ? "#fbbf24" : "#22d3ee"} />
              <stop offset="100%" stopColor={locked ? "#b45309" : "#0e7490"} />
            </linearGradient>
          </defs>
          <polygon points={DROP_POINTS} fill={`url(#wordtris-drop-fill-${drop.id})`} />
          <ellipse cx="30" cy="58" rx="9" ry="15" fill="rgba(255,255,255,0.25)" />
        </svg>
        {/* Real reported request: each correctly typed key should visibly
            change that letter's color, the same "lit up as you go"
            feedback the site's own typing tutors already give -- so each
            character is its own span instead of one plain text node. */}
        <span className="relative">
          {[...drop.target].map((ch, i) => (
            <span key={i} className={i < typedLength ? "text-lime-300" : undefined}>{ch}</span>
          ))}
        </span>
      </div>
    </div>
  );
}

// A single cloud silhouette -- deliberately a visibly darker grey (not
// near-white) with an outlined edge and a real drop-shadow, so it stays
// readable against a light page background, not just the dark rain lane
// below it. Several render at once (see the overlapping cluster in
// WordtrisGame), each with its own gradient id since SVG gradient ids are
// global to the document.
function WordtrisCloud({ className }: { className: string }) {
  const gradId = useId();
  return (
    <svg viewBox="0 0 200 110" aria-hidden="true" className={`drop-shadow-[0_10px_16px_rgba(15,23,42,0.35)] ${className}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
      </defs>
      <g fill={`url(#${gradId})`} stroke="#64748b" strokeOpacity="0.35" strokeWidth="1.5">
        <ellipse cx="60" cy="70" rx="45" ry="32" />
        <ellipse cx="112" cy="52" rx="55" ry="40" />
        <ellipse cx="152" cy="72" rx="40" ry="30" />
        <ellipse cx="100" cy="80" rx="72" ry="26" />
      </g>
    </svg>
  );
}

export function WordtrisGame({ words }: Props) {
  const [mode, setMode] = useState<WordtrisMode>("word");
  const [step, setStep] = useState<Step>("setup");
  const [language, setLanguage] = useState<WordtrisLanguage>("english");
  const [category, setCategory] = useState<WordtrisCategory>("easy_words");

  const [lives, setLives] = useState<number>(WORDTRIS_STARTING_LIVES);
  const [score, setScore] = useState(0);
  const [wordsCaught, setWordsCaught] = useState(0);
  const [streak, setStreak] = useState(0);
  // Current typing speed the falling drops are paced to, in real WPM (see
  // lib/wordtris-content.ts) -- shown live in the HUD, adjustable from the
  // setup screen before a round starts.
  const [wpm, setWpm] = useState<number>(WORDTRIS_WPM_MILESTONES[0]);
  const [startingWpm, setStartingWpm] = useState<number>(WORDTRIS_WPM_MILESTONES[0]);
  const [activeDrops, setActiveDrops] = useState<ActiveDrop[]>([]);
  const [typed, setTyped] = useState("");
  const [flash, setFlash] = useState<"catch" | "miss" | null>(null);
  const [inputShake, setInputShake] = useState(false);
  // Every missed drop lands in the bucket's water -- a brief expanding
  // splash ring at the point of impact, purely decorative (aria-hidden),
  // removed a moment after it plays.
  const [splashes, setSplashes] = useState<{ id: number; lane: number }[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [leaderboardLimit, setLeaderboardLimit] = useState<10 | 20 | 50>(10);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const poolRef = useRef<string[]>([]);
  const poolCursorRef = useRef(0);
  const nextIdRef = useRef(0);
  const wpmRef = useRef<number>(WORDTRIS_WPM_MILESTONES[0]);
  const catchesSinceBumpRef = useRef(0);
  const activeDropsRef = useRef<ActiveDrop[]>([]);
  useEffect(() => { wpmRef.current = wpm; }, [wpm]);

  const startingLives = WORDTRIS_STARTING_LIVES;
  const fontFamily = language === "hindi" ? KD : undefined;

  const nextPoolItem = useCallback(() => {
    if (poolRef.current.length === 0) return "";
    if (poolCursorRef.current >= poolRef.current.length) {
      poolRef.current = shuffledPool(poolRef.current);
      poolCursorRef.current = 0;
    }
    const item = poolRef.current[poolCursorRef.current];
    poolCursorRef.current += 1;
    return item;
  }, []);

  // Only word mode's Hindi content is stored as Unicode needing conversion
  // -- character mode's Hindi pool is already raw, typeable Kruti Dev
  // bytes (see CHARACTER_POOL above), so converting it again would mangle it.
  const buildTarget = useCallback((raw: string, m: WordtrisMode, lang: WordtrisLanguage) => {
    if (m === "word" && lang === "hindi") {
      try { return toTypeableKrutiDev(raw); } catch { return raw; }
    }
    return raw;
  }, []);

  const spawnDrop = useCallback((m: WordtrisMode, lang: WordtrisLanguage) => {
    const used = new Set(activeDropsRef.current.map((d) => d.lane));
    const freeLanes = LANE_POSITIONS.map((_, i) => i).filter((i) => !used.has(i));
    if (!freeLanes.length) return;
    const lane = freeLanes[Math.floor(Math.random() * freeLanes.length)];

    const activeTexts = new Set(activeDropsRef.current.map((d) => d.text));
    let raw = nextPoolItem();
    for (let attempt = 0; attempt < 5 && activeTexts.has(raw); attempt += 1) raw = nextPoolItem();
    if (!raw) return;

    const target = buildTarget(raw, m, lang);
    const fallMs = wordtrisFallMs(target, wpmRef.current, m);

    const drop: ActiveDrop = { id: nextIdRef.current++, text: raw, target, lane, fallMs, spawnedAt: Date.now() };
    activeDropsRef.current = [...activeDropsRef.current, drop];
    setActiveDrops(activeDropsRef.current);
  }, [nextPoolItem, buildTarget]);

  const startRound = useCallback((m: WordtrisMode, lang: WordtrisLanguage, cat: WordtrisCategory) => {
    setMode(m);
    setLanguage(lang);
    setCategory(cat);
    poolRef.current = shuffledPool(m === "character" ? CHARACTER_POOL[lang] : words[lang][cat]);
    poolCursorRef.current = 0;
    nextIdRef.current = 0;
    activeDropsRef.current = [];
    setActiveDrops([]);
    setLives(WORDTRIS_STARTING_LIVES);
    setScore(0);
    setWordsCaught(0);
    setStreak(0);
    wpmRef.current = startingWpm;
    setWpm(startingWpm);
    catchesSinceBumpRef.current = 0;
    setTyped("");
    setSubmitted(false);
    setStep("playing");
    if (m === "character") {
      try { setPersonalBest(Number(localStorage.getItem(`wordtris-best-character-${lang}`)) || null); } catch { setPersonalBest(null); }
    }
  }, [words, startingWpm]);

  const onCatch = useCallback((drop: ActiveDrop) => {
    const points = wordtrisPoints(drop.text);
    setScore((s) => s + points);
    setWordsCaught((w) => w + 1);
    setStreak((s) => s + 1);
    activeDropsRef.current = activeDropsRef.current.filter((d) => d.id !== drop.id);
    setActiveDrops(activeDropsRef.current);
    setTyped("");
    setFlash("catch");
    window.setTimeout(() => setFlash(null), 300);
    // Every WORDTRIS_CATCHES_PER_MILESTONE catches in a row advances the
    // WPM to the next rung on the ladder -- see lib/wordtris-content.ts.
    catchesSinceBumpRef.current += 1;
    if (catchesSinceBumpRef.current >= WORDTRIS_CATCHES_PER_MILESTONE) {
      catchesSinceBumpRef.current = 0;
      const next = wordtrisNextMilestone(wpmRef.current);
      wpmRef.current = next;
      setWpm(next);
    }
  }, []);

  const onMiss = useCallback((dropId: number) => {
    // A stray transitionend from a drop that was already caught (and thus
    // already removed/unmounted) can't actually reach here -- React
    // unmounting the element aborts its in-flight CSS transition instead
    // of firing the event -- but the guard costs nothing and documents why
    // double-counting a miss isn't possible.
    const missed = activeDropsRef.current.find((d) => d.id === dropId);
    if (!missed) return;
    activeDropsRef.current = activeDropsRef.current.filter((d) => d.id !== dropId);
    setActiveDrops(activeDropsRef.current);
    setStreak(0);
    setFlash("miss");
    window.setTimeout(() => setFlash(null), 300);
    setSplashes((s) => [...s, { id: missed.id, lane: missed.lane }]);
    window.setTimeout(() => setSplashes((s) => s.filter((sp) => sp.id !== missed.id)), 550);
    // A miss backs the WPM off and restarts the catch count toward the
    // next milestone, so climbing back up always retraces the ladder.
    catchesSinceBumpRef.current = 0;
    const eased = Math.max(WORDTRIS_MIN_WPM, wpmRef.current - WORDTRIS_MISS_WPM_PENALTY);
    wpmRef.current = eased;
    setWpm(eased);
    setLives((l) => {
      const left = l - 1;
      if (left <= 0) setStep("gameover");
      return Math.max(0, left);
    });
  }, []);

  // Spawns new drops on a schedule computed from the current WPM (see
  // wordtrisSpawnMs) -- rechecked on a short, fixed tick so it always
  // reacts to the CURRENT speed rather than whatever it was when the round
  // started.
  useEffect(() => {
    if (step !== "playing") return;
    let nextSpawnAt = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() < nextSpawnAt) return;
      if (activeDropsRef.current.length >= MAX_CONCURRENT_DROPS) return;
      spawnDrop(mode, language);
      nextSpawnAt = Date.now() + wordtrisSpawnMs(wpmRef.current);
    }, SPAWN_TICK_MS);
    return () => window.clearInterval(timer);
  }, [step, mode, language, spawnDrop]);

  useEffect(() => {
    if (step === "playing") requestAnimationFrame(() => inputRef.current?.focus());
  }, [step]);

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

  // Hindi compares exact (its bytes are case-sensitive by design -- see
  // hindi-font-converter.ts); English is lenient, matching word mode's
  // long-standing behaviour. Shared by the prefix-lock check below and the
  // space-to-confirm submit, so both always agree on what "matches" means.
  const normalize = useCallback((value: string) => (language === "hindi" ? value : value.trim().toLowerCase()), [language]);
  const dropText = useCallback((d: ActiveDrop) => (language === "hindi" ? d.target : d.target.toLowerCase()), [language]);

  // Real reported request: once the student is partway into one falling
  // drop's word, a stray keystroke that only belongs to a *different*
  // falling word must not be accepted -- it should simply not type at all,
  // the same way a real word-processor's autocomplete would refuse an
  // impossible continuation. Backspacing is always allowed so the field
  // can still be cleared/retried.
  const isValidPrefix = useCallback((value: string) => {
    const norm = normalize(value);
    if (!norm) return true;
    return activeDropsRef.current.some((d) => dropText(d).startsWith(norm));
  }, [normalize, dropText]);

  const handleTyped = (value: string) => {
    const isShrinking = value.length < typed.length && typed.startsWith(value);
    if (!isShrinking && value && !isValidPrefix(value)) return;
    setTyped(value);
  };

  // The actual catch only fires once the student presses Space after
  // finishing a word/character -- matching a real typed word being
  // confirmed with a space, not the moment the letters happen to line up.
  const trySubmit = useCallback(() => {
    if (!typed) return;
    const normalizedTyped = normalize(typed);
    const candidates = activeDropsRef.current.filter((d) => dropText(d) === normalizedTyped);
    if (!candidates.length) {
      setInputShake(true);
      window.setTimeout(() => setInputShake(false), 320);
      return;
    }
    // More than one identical falling drop can match at once (small pools,
    // especially in character mode) -- catch whichever is furthest along
    // its fall, the more urgent one.
    const mostUrgent = candidates.reduce((a, b) => ((Date.now() - b.spawnedAt) / b.fallMs > (Date.now() - a.spawnedAt) / a.fallMs ? b : a));
    onCatch(mostUrgent);
  }, [typed, normalize, dropText, onCatch]);

  const handleTypedKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== " " && event.code !== "Space") return;
    event.preventDefault();
    trySubmit();
  };

  const normalizedTyped = normalize(typed);
  // How many of each locked drop's own characters are "typed so far" --
  // drives the letter-by-letter color feedback in FallingDropView. Keyed
  // by drop id rather than a plain boolean so each drop can light up
  // exactly as many of its own letters as have actually been matched.
  const lockedProgress = useMemo(() => {
    const map = new Map<number, number>();
    if (!normalizedTyped) return map;
    for (const d of activeDrops) if (dropText(d).startsWith(normalizedTyped)) map.set(d.id, typed.length);
    return map;
  }, [activeDrops, normalizedTyped, dropText, typed]);

  const waterFillPercent = ((startingLives - lives) / startingLives) * 100;

  const displayCategories = useMemo(() => CATEGORIES, []);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <TypingBrandHeader backHref="/typing/games" backLabel="Games" />
      <section className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-end gap-3">
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
              <p className="mt-2 text-sm leading-6 text-slate-300">Multiple drops fall from the cloud at once, starting slow -- type one and press Space to catch it before it lands. Miss one and the bucket fills with a little more water; string catches together and it speeds back up. Six missed drops and the bucket overflows.</p>
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

              <p className="mt-5 text-xs font-black uppercase tracking-wider text-slate-500">Starting speed</p>
              <div className="mt-2 flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-2.5">
                <button type="button" onClick={() => setStartingWpm((w) => Math.max(WORDTRIS_MIN_WPM, w - 1))} aria-label="Decrease starting speed" className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black text-slate-700 shadow-sm hover:bg-slate-100">−</button>
                <span className="flex-1 text-center text-sm font-black text-slate-800">{startingWpm} WPM</span>
                <button type="button" onClick={() => setStartingWpm((w) => Math.min(WORDTRIS_MAX_WPM, w + 1))} aria-label="Increase starting speed" className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black text-slate-700 shadow-sm hover:bg-slate-100">+</button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">Drops start paced to this real typing speed, then speed up every {WORDTRIS_CATCHES_PER_MILESTONE} catches -- and ease back off after a miss.</p>

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
                <span>Speed <b className="text-lg text-slate-950">{wpm} WPM</b></span>
                <span>Score <b className="text-lg text-slate-950">{score}</b></span>
                <span>Streak <b className="text-lg text-slate-950">{streak}</b></span>
              </div>
            </div>

            {/* A small overlapping cluster of clouds drifts above the
                bucket, each moving independently so they slide across and
                past one another -- purely atmospheric, every drop visually
                originates from underneath them. A soft blurred haze sits
                behind the cluster and the clouds themselves use a visibly
                darker, outlined fill (not near-white) so they stay clearly
                readable against a light page background too. */}
            <div className="relative mt-5 flex h-24 items-center justify-center sm:h-28">
              <div className="absolute h-16 w-44 rounded-full bg-slate-400/30 blur-2xl sm:h-20 sm:w-60" aria-hidden="true" />
              <WordtrisCloud className="absolute left-1/2 h-14 w-36 animate-wordtris-cloud-a opacity-90 sm:h-16 sm:w-44" />
              <WordtrisCloud className="absolute left-1/2 h-20 w-52 animate-wordtris-cloud-b sm:h-24 sm:w-64" />
              <WordtrisCloud className="absolute left-1/2 h-14 w-36 animate-wordtris-cloud-c opacity-90 sm:h-16 sm:w-44" />
            </div>

            {/* The bucket's rim + wire handle, decorative only. */}
            <div className="relative mx-auto -mb-2 flex h-8 items-end justify-center">
              <svg viewBox="0 0 120 40" aria-hidden="true" className="absolute bottom-1 h-9 w-28 sm:w-32">
                <path d="M15 38 C 15 8, 105 8, 105 38" fill="none" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />
              </svg>
              <div className="relative z-10 h-3.5 w-[92%] rounded-full bg-gradient-to-b from-slate-300 to-slate-500 shadow-inner sm:w-[88%]" />
            </div>

            {/* The bucket body: the falling-drop play field, now much
                bigger, with metal side straps and a rising water level --
                one step per life lost (6 steps to fully full/game over). */}
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-3 left-0 z-20 w-2.5 rounded-full bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500 sm:w-3" />
              <div className="pointer-events-none absolute inset-y-3 right-0 z-20 w-2.5 rounded-full bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500 sm:w-3" />
              <div className={`wordtris-rain-lane relative h-[28rem] overflow-hidden rounded-[2rem] ring-1 ring-slate-700 transition sm:h-[34rem] ${flash === "catch" ? "ring-4 ring-emerald-400" : flash === "miss" ? "ring-4 ring-rose-400" : ""}`}>
                {/* Rising water -- absolutely positioned first so every
                    later sibling (ambient rain, real drops, splashes)
                    naturally paints on top of it. */}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden transition-[height] duration-700 ease-out"
                  style={{ height: `${waterFillPercent}%` }}
                  aria-hidden="true"
                >
                  <div className="absolute inset-x-0 -top-3 h-6 overflow-hidden">
                    <svg viewBox="0 0 400 20" preserveAspectRatio="none" className="animate-wordtris-wave-scroll h-full w-[200%] fill-cyan-400/70">
                      <path d="M0 10 C 25 0,75 20,100 10 C125 0,175 20,200 10 L200 20 L0 20 Z M200 10 C225 0,275 20,300 10 C325 0,375 20,400 10 L400 20 L200 20 Z" />
                    </svg>
                    <svg viewBox="0 0 400 20" preserveAspectRatio="none" className="animate-wordtris-wave-scroll-slow absolute inset-0 h-full w-[200%] fill-cyan-300/40">
                      <path d="M0 12 C25 4,75 20,100 12 C125 4,175 20,200 12 L200 20 L0 20 Z M200 12 C225 4,275 20,300 12 C325 4,375 20,400 12 L400 20 L200 20 Z" />
                    </svg>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 top-3 bg-gradient-to-b from-cyan-500/70 via-cyan-600/80 to-cyan-800/90" />
                </div>

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
                {activeDrops.map((drop) => (
                  <FallingDropView key={drop.id} drop={drop} fontFamily={fontFamily} typedLength={lockedProgress.get(drop.id) ?? 0} onMiss={onMiss} />
                ))}
                {splashes.map((s) => (
                  <span key={s.id} aria-hidden="true" className="animate-wordtris-splash pointer-events-none absolute z-10 h-12 w-12 rounded-full border-2 border-cyan-100" style={{ left: `${LANE_POSITIONS[s.lane]}%`, bottom: `${Math.min(94, waterFillPercent)}%` }} />
                ))}
              </div>
            </div>

            {/* Base plate. */}
            <div className="mx-auto -mt-2 h-3 w-[86%] rounded-full bg-gradient-to-b from-slate-500 to-slate-700 shadow-md sm:w-[82%]" />

            <div className="mt-4">
              <input
                ref={inputRef}
                value={typed}
                onChange={(event) => handleTyped(event.target.value)}
                onKeyDown={handleTypedKeyDown}
                spellCheck={false}
                autoFocus
                aria-label={`Type any falling ${mode === "character" ? "character" : "word"}, then press Space`}
                className={`w-full rounded-xl border-2 border-slate-200 p-3 text-lg outline-none focus:border-slate-500 ${inputShake ? "animate-wordtris-shake border-rose-400" : ""}`}
                style={{ fontFamily }}
                placeholder={mode === "character" ? "Type the falling key, then press Space…" : "Type any falling word, then press Space…"}
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
