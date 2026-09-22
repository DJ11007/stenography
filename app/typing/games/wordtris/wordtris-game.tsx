"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toTypeableKrutiDev } from "@/lib/hindi-font-converter";
import type { CharacterPoolLanguage } from "@/lib/character-pool-content";
import type { CharacterPoolForLanguage } from "@/lib/character-pool-server";
import { CATEGORIES, WORDTRIS_STARTING_LIVES, WORDTRIS_WPM_MILESTONES, WORDTRIS_CATCHES_PER_MILESTONE, WORDTRIS_MISS_WPM_PENALTY, WORDTRIS_MIN_WPM, wordtrisFallMs, wordtrisNextMilestone, wordtrisPoints, type WordtrisCategory, type WordtrisLanguage, type WordtrisMode } from "@/lib/wordtris-content";
import { TypingBrandHeader } from "../../_components/typing-brand";
import { getWordtrisLeaderboard, submitWordtrisScore, type LeaderboardRow } from "./actions";

const HI = '"Nirmala UI", "Noto Sans Devanagari", system-ui, sans-serif';
const KD = '"Kruti Dev 010", "Nirmala UI", sans-serif';

// A real teardrop silhouette (sampled bottom-half ellipse tangent to a
// single point at the top), not the rounded pill/bubble shape this
// replaced -- percent-based points, so it scales cleanly to whatever
// width/height the box around it ends up being (sized by its own text).
const DROP_POINTS = "50,0 8,68 9.43,76.28 13.63,84 20.3,90.63 29,95.71 39.13,98.91 50,100 60.87,98.91 71,95.71 79.7,90.63 86.37,84 90.57,76.28 92,68";


// Small decorative drops drifting down behind the real, interactive one --
// purely atmosphere, fixed (not random) so they don't reshuffle every
// render. Non-interactive: aria-hidden and never read from.
const AMBIENT_DROPS = Array.from({ length: 5 }, (_, i) => ({
  left: `${6 + i * 21}%`,
  duration: `${3 + (i % 3) * 0.7}s`,
  delay: `${i * 0.6}s`,
}));

// Real reported reference (a screen recording of an existing typing-rain
// game): one word falls at a time, dead center, not several concurrent
// lanes -- the next one spawns shortly after the current one resolves
// (caught or missed). See the spawn effect in WordtrisGame.
const NEXT_DROP_DELAY_MS = 250;

// Keys that shouldn't, by themselves, count as "the student started
// typing" for the awaiting-first-key gate below -- a lone modifier is
// almost always incidental (adjusting posture, a stuck Shift), not an
// actual attempt to type the falling word.
const MODIFIER_ONLY_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "Tab"]);

function shuffledPool(list: string[]) {
  const pool = [...list];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

type Step = "setup" | "playing" | "gameover";
type Props = { words: Record<WordtrisLanguage, Record<WordtrisCategory, string[]>>; characterPool: Record<CharacterPoolLanguage, CharacterPoolForLanguage> };
type ActiveDrop = { id: number; text: string; target: string; fallMs: number; spawnedAt: number };

function FallingDropView({ drop, fontFamily, typedLength, onMiss }: { drop: ActiveDrop; fontFamily?: string; typedLength: number; onMiss: (id: number) => void }) {
  const [falling, setFalling] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setFalling(true)));
  }, []);
  const locked = typedLength > 0;
  return (
    <div
      className="absolute left-1/2"
      style={{
        top: falling ? "calc(100% - 4.75rem)" : "1rem",
        transform: "translateX(-50%)",
        // No transition while snapping to the top on mount -- only while
        // actually falling. Without this, appearing itself animates too
        // (CSS transitions apply to any style change, not just the fall).
        transition: falling ? `top ${drop.fallMs}ms linear` : "none",
      }}
      onTransitionEnd={() => { if (falling) onMiss(drop.id); }}
    >
      <div className={`relative min-w-24 rounded-2xl px-7 pb-5 pt-11 text-center text-2xl drop-shadow-[0_6px_18px_rgba(8,145,178,0.6)] transition ${locked ? "ring-4 ring-amber-300" : ""}`} style={{ fontFamily }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 -z-10 h-full w-full" aria-hidden="true">
          <defs>
            {/* Unique id per drop -- a new one mounts before the previous
                one's exit transition always finishes, so a shared id would
                risk a duplicate DOM id. */}
            <linearGradient id={`wordtris-drop-fill-${drop.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={locked ? "#fbbf24" : "#22d3ee"} />
              <stop offset="100%" stopColor={locked ? "#b45309" : "#0e7490"} />
            </linearGradient>
          </defs>
          <polygon points={DROP_POINTS} fill={`url(#wordtris-drop-fill-${drop.id})`} />
          <ellipse cx="30" cy="58" rx="9" ry="15" fill="rgba(255,255,255,0.25)" />
        </svg>
        {/* Real reported reference: the typed-so-far portion of the word
            turns bold and dark against the remaining, still-plain letters
            -- not a color swap. This used to be one span PER CHARACTER,
            but Kruti Dev is a legacy 8-bit "font trick" encoding: several
            of its bytes only draw the intended glyph (घ, ओ-matra, ड़'s
            nukta dot, ...) by visually overlapping the NEXT character in
            the same shaped text run -- splitting every character into its
            own element broke that adjacency for any such word, leaving
            visible gaps between letters that render fine as one string
            (confirmed live: घोड़ा/बाघ/भेड़ all rendered correctly
            contiguous, but visibly gapped once split like this). Two
            spans -- typed-so-far, then the rest -- gives the identical
            progressive bold effect while keeping each portion's own
            glyphs adjacent to each other. */}
        <span className="relative">
          <span className="font-black text-slate-900">{drop.target.slice(0, typedLength)}</span>
          <span className="font-bold text-white/90">{drop.target.slice(typedLength)}</span>
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

export function WordtrisGame({ words, characterPool }: Props) {
  const [mode, setMode] = useState<WordtrisMode>("word");
  const [step, setStep] = useState<Step>("setup");
  const [language, setLanguage] = useState<WordtrisLanguage>("english");
  const [category, setCategory] = useState<WordtrisCategory>("easy_words");

  const [lives, setLives] = useState<number>(WORDTRIS_STARTING_LIVES);
  const [score, setScore] = useState(0);
  const [wordsCaught, setWordsCaught] = useState(0);
  const [streak, setStreak] = useState(0);
  // Current typing speed the falling drop is paced to, in real WPM (see
  // lib/wordtris-content.ts) -- shown live in the HUD, adjustable from the
  // setup screen before a round starts.
  const [wpm, setWpm] = useState<number>(WORDTRIS_WPM_MILESTONES[0]);
  // Real reported request: clicking Start used to drop the first word
  // immediately -- now the play field appears paused ("Press any key to
  // start") and nothing falls until the student's first keystroke.
  const [awaitingFirstKey, setAwaitingFirstKey] = useState(false);
  // Real reported reference: only one word falls at a time, dead center --
  // not several concurrent lanes -- so there is at most one active drop.
  const [activeDrop, setActiveDrop] = useState<ActiveDrop | null>(null);
  const [typed, setTyped] = useState("");
  const [flash, setFlash] = useState<"catch" | "miss" | null>(null);
  const [inputShake, setInputShake] = useState(false);
  // Every missed drop stacks up as its own labeled block at the bottom of
  // the bucket (the same "missed words pile up" visual the reference game
  // uses) -- one more block per life lost, six blocks fill it completely.
  const [missedStack, setMissedStack] = useState<{ id: number; text: string }[]>([]);
  const [splash, setSplash] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [leaderboardLimit, setLeaderboardLimit] = useState<10 | 20 | 50>(10);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const poolRef = useRef<string[]>([]);
  const poolCursorRef = useRef(0);
  // True only for character mode when the admin has set an explicit,
  // ordered key list (see characterPool prop / /admin/character-pool) --
  // the pool then plays back in that exact sequence, looping from the
  // start once exhausted, instead of reshuffling. Word mode (and
  // character mode's own untouched default full keyboard) is unaffected,
  // still a fresh random shuffle every time the pool runs out.
  const poolSequentialRef = useRef(false);
  const nextIdRef = useRef(0);
  const wpmRef = useRef<number>(WORDTRIS_WPM_MILESTONES[0]);
  const catchesSinceBumpRef = useRef(0);
  const activeDropRef = useRef<ActiveDrop | null>(null);
  useEffect(() => { wpmRef.current = wpm; }, [wpm]);

  const startingLives = WORDTRIS_STARTING_LIVES;
  const fontFamily = language === "hindi" ? KD : undefined;

  const nextPoolItem = useCallback(() => {
    if (poolRef.current.length === 0) return "";
    if (poolCursorRef.current >= poolRef.current.length) {
      if (!poolSequentialRef.current) poolRef.current = shuffledPool(poolRef.current);
      poolCursorRef.current = 0;
    }
    const item = poolRef.current[poolCursorRef.current];
    poolCursorRef.current += 1;
    return item;
  }, []);

  // Only word mode's Hindi content is stored as Unicode needing conversion
  // -- character mode's Hindi pool (characterPool prop, admin-editable at
  // /admin/character-pool) is already raw, typeable Kruti Dev bytes, so
  // converting it again would mangle it.
  const buildTarget = useCallback((raw: string, m: WordtrisMode, lang: WordtrisLanguage) => {
    if (m === "word" && lang === "hindi") {
      try { return toTypeableKrutiDev(raw); } catch { return raw; }
    }
    return raw;
  }, []);

  const spawnDrop = useCallback((m: WordtrisMode, lang: WordtrisLanguage) => {
    if (activeDropRef.current) return;
    const raw = nextPoolItem();
    if (!raw) return;

    const target = buildTarget(raw, m, lang);
    const fallMs = wordtrisFallMs(target, wpmRef.current, m);

    const drop: ActiveDrop = { id: nextIdRef.current++, text: raw, target, fallMs, spawnedAt: Date.now() };
    activeDropRef.current = drop;
    setActiveDrop(drop);
  }, [nextPoolItem, buildTarget]);

  const startRound = useCallback((m: WordtrisMode, lang: WordtrisLanguage, cat: WordtrisCategory) => {
    setMode(m);
    setLanguage(lang);
    setCategory(cat);
    const sequential = m === "character" && characterPool[lang].sequential;
    poolSequentialRef.current = sequential;
    const basePool = m === "character" ? characterPool[lang].keys : words[lang][cat];
    poolRef.current = sequential ? [...basePool] : shuffledPool(basePool);
    poolCursorRef.current = 0;
    nextIdRef.current = 0;
    activeDropRef.current = null;
    setActiveDrop(null);
    setLives(WORDTRIS_STARTING_LIVES);
    setScore(0);
    setWordsCaught(0);
    setStreak(0);
    setMissedStack([]);
    wpmRef.current = WORDTRIS_WPM_MILESTONES[0];
    setWpm(WORDTRIS_WPM_MILESTONES[0]);
    catchesSinceBumpRef.current = 0;
    setTyped("");
    setSubmitted(false);
    setAwaitingFirstKey(true);
    setStep("playing");
    if (m === "character") {
      try { setPersonalBest(Number(localStorage.getItem(`wordtris-best-character-${lang}`)) || null); } catch { setPersonalBest(null); }
    }
  }, [words, characterPool]);

  const onCatch = useCallback((drop: ActiveDrop) => {
    const points = wordtrisPoints(drop.text);
    setScore((s) => s + points);
    setWordsCaught((w) => w + 1);
    setStreak((s) => s + 1);
    activeDropRef.current = null;
    setActiveDrop(null);
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
    // already cleared) can't actually reach here -- React unmounting the
    // element aborts its in-flight CSS transition instead of firing the
    // event -- but the guard costs nothing and documents why double-
    // counting a miss isn't possible.
    const missed = activeDropRef.current;
    if (!missed || missed.id !== dropId) return;
    activeDropRef.current = null;
    setActiveDrop(null);
    setTyped("");
    setStreak(0);
    setFlash("miss");
    window.setTimeout(() => setFlash(null), 300);
    setMissedStack((s) => [...s, { id: missed.id, text: missed.target }]);
    setSplash(missed.id);
    window.setTimeout(() => setSplash((id) => (id === missed.id ? null : id)), 550);
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

  // The next drop spawns a short beat after the field is clear (caught or
  // missed) -- not on a separate spawn-interval schedule, since only one
  // is ever on screen at a time. Held off entirely while awaitingFirstKey
  // -- the very first drop only spawns once the student actually presses
  // a key, not the instant they click Start.
  useEffect(() => {
    if (step !== "playing" || activeDrop || awaitingFirstKey) return;
    const timer = window.setTimeout(() => spawnDrop(mode, language), NEXT_DROP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [step, activeDrop, mode, language, spawnDrop, awaitingFirstKey]);

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

  // A stray keystroke that doesn't continue the one falling word must not
  // be accepted -- it should simply not type at all, the same way a real
  // word-processor's autocomplete would refuse an impossible continuation.
  // Backspacing is always allowed so the field can still be cleared/retried.
  const isValidPrefix = useCallback((value: string) => {
    const norm = normalize(value);
    if (!norm) return true;
    return activeDropRef.current ? dropText(activeDropRef.current).startsWith(norm) : false;
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
    if (!typed || !activeDropRef.current) return;
    const normalizedTyped = normalize(typed);
    if (dropText(activeDropRef.current) !== normalizedTyped) {
      setInputShake(true);
      window.setTimeout(() => setInputShake(false), 320);
      return;
    }
    onCatch(activeDropRef.current);
  }, [typed, normalize, dropText, onCatch]);

  // Real reported gap: a multi-word word-bank entry ("दमकल गाड़ी", "पानी का
  // टैंकर", ...) could never actually be caught -- Space always meant
  // "submit now", so the moment a student finished the first word and
  // pressed Space to continue to the second, it was treated as a
  // (mismatched) final answer instead of a mid-phrase space. A space is
  // only treated as confirm-and-submit when the word is already a
  // complete match (unchanged from before, since a single word's target
  // never contains a space and this branch alone covers all of today's
  // single-word behavior) or when adding a literal space wouldn't
  // continue toward the target at all (a genuinely wrong/premature
  // guess, same shake-and-reject as always). Otherwise the space is a
  // real continuation of the target phrase, so it's left to type
  // normally instead of being intercepted.
  const handleTypedKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Real reported request: the first drop shouldn't fall the instant
    // Start is clicked -- the play field waits until the student actually
    // presses a key (any real key, not just a lone modifier).
    if (awaitingFirstKey && !MODIFIER_ONLY_KEYS.has(event.key)) setAwaitingFirstKey(false);
    if (event.key !== " " && event.code !== "Space") return;
    const activeDrop = activeDropRef.current;
    const isCompleteMatch = Boolean(activeDrop) && dropText(activeDrop!) === normalize(typed);
    const continuesPhrase = Boolean(activeDrop) && isValidPrefix(`${typed} `);
    if (!isCompleteMatch && continuesPhrase) return;
    event.preventDefault();
    trySubmit();
  };

  // How many of the falling word's own characters are "typed so far" --
  // drives the letter-by-letter color feedback in both FallingDropView
  // and the enlarged readout below the bucket. handleTyped already
  // guarantees `typed` is always a valid prefix of the active drop, so
  // this is just its length.
  const typedLength = activeDrop ? typed.length : 0;

  const displayCategories = CATEGORIES;

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
              <p className="mt-2 text-sm leading-6 text-slate-300">One word falls from the cloud at a time, starting slow -- type it and press Space to catch it before it lands. Miss one and it stacks up inside the bucket; string catches together and it speeds back up. Six stacked misses and the bucket is full.</p>
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

              {/* Real reported request: starting speed and the speed-up
                  interval used to be adjustable here -- both are fixed in
                  code now (WORDTRIS_WPM_MILESTONES[0], WORDTRIS_CATCHES_
                  PER_MILESTONE), not exposed as a setting. */}

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
                past one another -- purely atmospheric, the drop visually
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

            {/* The bucket body: the falling-drop play field, with metal
                side straps and missed words stacking up as labeled blocks
                from the bottom -- one block per life lost (6 blocks fill
                it completely), the same "misses pile up" visual the
                reference game uses instead of a continuous fill level. */}
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-3 left-0 z-20 w-2.5 rounded-full bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500 sm:w-3" />
              <div className="pointer-events-none absolute inset-y-3 right-0 z-20 w-2.5 rounded-full bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500 sm:w-3" />
              <div className={`wordtris-rain-lane relative h-[28rem] overflow-hidden rounded-[2rem] ring-1 ring-slate-700 transition sm:h-[34rem] ${flash === "catch" ? "ring-4 ring-emerald-400" : flash === "miss" ? "ring-4 ring-rose-400" : ""}`}>
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
                {activeDrop && (
                  <FallingDropView key={activeDrop.id} drop={activeDrop} fontFamily={fontFamily} typedLength={typedLength} onMiss={onMiss} />
                )}
                {splash !== null && (
                  <span aria-hidden="true" className="animate-wordtris-splash pointer-events-none absolute bottom-2 left-1/2 z-10 h-12 w-12 rounded-full border-2 border-cyan-100" />
                )}
                {/* Missed words, stacked bottom-up -- oldest at the floor,
                    newest on top of the pile (flex-col-reverse renders the
                    last DOM child at the container's start edge, which for
                    a bottom-anchored column is the bottom). */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col-reverse" aria-hidden="true">
                  {missedStack.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-center overflow-hidden border-t border-slate-400/50 bg-slate-300/95 px-3 text-sm font-bold text-slate-600"
                      style={{ height: `${100 / startingLives}%`, fontFamily }}
                    >
                      {m.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Base plate. */}
            <div className="mx-auto -mt-2 h-3 w-[86%] rounded-full bg-gradient-to-b from-slate-500 to-slate-700 shadow-md sm:w-[82%]" />

            {/* Real reported request: this used to be a small "letters
                left to type" readout, and the actual typing happened in a
                separate bordered text box below it. Removed that box --
                this readout IS the interactive surface now (a click
                refocuses the hidden input backing it). It shows the FULL
                falling word, not just what's left: the typed-so-far
                portion changes COLOR instead of being removed from view
                (matching the same two-span technique FallingDropView
                uses, for the same Kruti Dev glyph-adjacency reason --
                splitting per character would break some legacy bytes'
                rendering). The whole thing only clears once the word is
                actually caught (a real Space-confirmed exact match), not
                as each letter is typed. Real reported follow-up (twice):
                sized too big at first, cut roughly in half, then reduced
                again to a compact pill (min-h-8, text-base/sm:text-lg,
                max-w-[12rem]) that stays proportionate at every viewport
                width instead of stretching edge to edge. */}
            <button
              type="button"
              onClick={() => inputRef.current?.focus()}
              tabIndex={-1}
              aria-hidden="true"
              className={`mx-auto mt-3 flex min-h-8 w-full max-w-[12rem] items-center justify-center rounded-xl bg-slate-50 px-3 py-1.5 text-center text-base font-black outline-none ring-1 ring-slate-200 transition focus:ring-2 focus:ring-blue-500 sm:text-lg ${inputShake ? "animate-wordtris-shake ring-rose-400" : ""}`}
              style={{ fontFamily }}
            >
              {activeDrop ? (
                <span className="break-words">
                  <span className="text-emerald-600">{activeDrop.target.slice(0, typedLength)}</span>
                  <span className="text-slate-900">{activeDrop.target.slice(typedLength)}</span>
                </span>
              ) : (
                <span className="text-xs font-bold text-slate-400">{awaitingFirstKey ? "⌨ Press any key to start…" : "Get ready…"}</span>
              )}
            </button>

            {/* The actual keystroke-capturing input -- carries the real
                accessible label (the button above is purely decorative,
                aria-hidden) and is visually hidden with a standard sr-only
                clip pattern (not display:none, so it still reliably
                receives focus and mobile virtual keyboards) rather than
                shown as its own box; the enlarged readout above is the
                visible surface now. */}
            <input
              ref={inputRef}
              value={typed}
              onChange={(event) => handleTyped(event.target.value)}
              onKeyDown={handleTypedKeyDown}
              spellCheck={false}
              autoFocus
              aria-label={`Type the falling ${mode === "character" ? "character" : "word"}, then press Space`}
              className="absolute h-px w-px overflow-hidden whitespace-nowrap opacity-0"
              style={{ clip: "rect(0,0,0,0)" }}
            />
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
