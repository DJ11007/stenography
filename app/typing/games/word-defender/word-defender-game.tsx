"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toTypeableKrutiDev } from "@/lib/hindi-font-converter";
import { CATEGORIES, type WordtrisCategory, type WordtrisLanguage } from "@/lib/wordtris-content";
import { WORDDEFENDER_STARTING_HEALTH, WORDDEFENDER_LANES, WORDDEFENDER_KILLS_PER_WAVE, worddefenderFallMs, worddefenderSpawnMs } from "@/lib/worddefender-content";
import { TypingBrandHeader } from "../../_components/typing-brand";

const HI = '"Nirmala UI", "Noto Sans Devanagari", system-ui, sans-serif';
const KD = '"Kruti Dev 010", "Nirmala UI", sans-serif';

// A jagged asteroid silhouette -- deliberately not the teardrop WordTris
// uses, so the two games read as visually distinct even though both are
// "type it before it reaches the bottom".
const ROCK_POINTS = "20,5 45,0 70,8 92,25 100,50 90,75 68,95 40,100 15,88 0,60 4,30";

const LANE_POSITIONS = Array.from({ length: WORDDEFENDER_LANES }, (_, i) => 12 + (i * 76) / (WORDDEFENDER_LANES - 1));
const SPAWN_TICK_MS = 120;

type Step = "setup" | "playing" | "gameover";
type Props = { words: Record<WordtrisLanguage, Record<WordtrisCategory, string[]>> };
type Enemy = { id: number; text: string; target: string; lane: number; fallMs: number; spawnedAt: number };

function shuffledPool(list: string[]) {
  const pool = [...list];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function EnemyView({ enemy, fontFamily, typedLength, onImpact }: { enemy: Enemy; fontFamily?: string; typedLength: number; onImpact: (id: number) => void }) {
  const [falling, setFalling] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setFalling(true)));
  }, []);
  const locked = typedLength > 0;
  return (
    <div
      className="absolute"
      style={{
        left: `${LANE_POSITIONS[enemy.lane]}%`,
        top: falling ? "calc(100% - 4.5rem)" : "1rem",
        transform: "translateX(-50%)",
        transition: falling ? `top ${enemy.fallMs}ms linear` : "none",
      }}
      onTransitionEnd={() => { if (falling) onImpact(enemy.id); }}
    >
      <div className={`relative flex min-w-20 items-center justify-center rounded-full px-5 py-4 text-center text-lg drop-shadow-[0_6px_16px_rgba(190,18,60,0.55)] transition ${locked ? "ring-4 ring-amber-300" : ""}`} style={{ fontFamily }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 -z-10 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id={`worddefender-rock-fill-${enemy.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={locked ? "#fbbf24" : "#f87171"} />
              <stop offset="100%" stopColor={locked ? "#b45309" : "#7f1d1d"} />
            </linearGradient>
          </defs>
          <polygon points={ROCK_POINTS} fill={`url(#worddefender-rock-fill-${enemy.id})`} />
        </svg>
        <span className="relative font-black">
          {[...enemy.target].map((ch, i) => (
            <span key={i} className={i < typedLength ? "font-black text-slate-900" : "font-bold text-white"}>{ch}</span>
          ))}
        </span>
      </div>
    </div>
  );
}

export function WordDefenderGame({ words }: Props) {
  const [step, setStep] = useState<Step>("setup");
  const [language, setLanguage] = useState<WordtrisLanguage>("english");
  const [category, setCategory] = useState<WordtrisCategory>("easy_words");

  const [health, setHealth] = useState(WORDDEFENDER_STARTING_HEALTH);
  const [score, setScore] = useState(0);
  const [kills, setKills] = useState(0);
  const [wave, setWave] = useState(1);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [typed, setTyped] = useState("");
  const [flash, setFlash] = useState<"kill" | "impact" | null>(null);
  const [explosions, setExplosions] = useState<{ id: number; lane: number }[]>([]);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const poolRef = useRef<string[]>([]);
  const poolCursorRef = useRef(0);
  const nextIdRef = useRef(0);
  const waveRef = useRef(1);
  const scoreRef = useRef(0);
  const enemiesRef = useRef<Enemy[]>([]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  const fontFamily = language === "hindi" ? KD : undefined;
  const bestKey = `worddefender-best-${language}-${category}`;

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(bestKey));
      setPersonalBest(Number.isFinite(v) && v > 0 ? v : null);
    } catch { setPersonalBest(null); }
  }, [bestKey]);

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

  const buildTarget = useCallback((raw: string, lang: WordtrisLanguage) => {
    if (lang !== "hindi") return raw;
    try { return toTypeableKrutiDev(raw); } catch { return raw; }
  }, []);

  const spawnEnemy = useCallback((lang: WordtrisLanguage) => {
    const used = new Set(enemiesRef.current.map((e) => e.lane));
    const freeLanes = Array.from({ length: WORDDEFENDER_LANES }, (_, i) => i).filter((i) => !used.has(i));
    if (!freeLanes.length) return;
    const lane = freeLanes[Math.floor(Math.random() * freeLanes.length)];

    const activeTexts = new Set(enemiesRef.current.map((e) => e.text));
    let raw = nextPoolItem();
    for (let attempt = 0; attempt < 5 && activeTexts.has(raw); attempt += 1) raw = nextPoolItem();
    if (!raw) return;

    const target = buildTarget(raw, lang);
    const fallMs = worddefenderFallMs(target, waveRef.current);
    const enemy: Enemy = { id: nextIdRef.current++, text: raw, target, lane, fallMs, spawnedAt: Date.now() };
    enemiesRef.current = [...enemiesRef.current, enemy];
    setEnemies(enemiesRef.current);
  }, [nextPoolItem, buildTarget]);

  const startGame = useCallback((lang: WordtrisLanguage, cat: WordtrisCategory) => {
    setLanguage(lang);
    setCategory(cat);
    poolRef.current = shuffledPool(words[lang]?.[cat] ?? []);
    poolCursorRef.current = 0;
    nextIdRef.current = 0;
    enemiesRef.current = [];
    setEnemies([]);
    setHealth(WORDDEFENDER_STARTING_HEALTH);
    setScore(0);
    setKills(0);
    setWave(1);
    waveRef.current = 1;
    scoreRef.current = 0;
    setIsNewBest(false);
    setTyped("");
    setStep("playing");
  }, [words]);

  const onKill = useCallback((enemy: Enemy) => {
    setScore((s) => s + 10 + [...enemy.text].length * 2);
    setKills((k) => {
      const next = k + 1;
      if (next % WORDDEFENDER_KILLS_PER_WAVE === 0) {
        waveRef.current += 1;
        setWave(waveRef.current);
      }
      return next;
    });
    enemiesRef.current = enemiesRef.current.filter((e) => e.id !== enemy.id);
    setEnemies(enemiesRef.current);
    setTyped("");
    setFlash("kill");
    window.setTimeout(() => setFlash(null), 250);
    setExplosions((s) => [...s, { id: enemy.id, lane: enemy.lane }]);
    window.setTimeout(() => setExplosions((s) => s.filter((x) => x.id !== enemy.id)), 500);
  }, []);

  const onImpact = useCallback((enemyId: number) => {
    const hit = enemiesRef.current.find((e) => e.id === enemyId);
    if (!hit) return;
    enemiesRef.current = enemiesRef.current.filter((e) => e.id !== enemyId);
    setEnemies(enemiesRef.current);
    setFlash("impact");
    window.setTimeout(() => setFlash(null), 250);
    setHealth((h) => {
      const left = h - 1;
      if (left <= 0) {
        setStep("gameover");
        try {
          const prev = Number(localStorage.getItem(bestKey)) || 0;
          if (scoreRef.current > prev) {
            localStorage.setItem(bestKey, String(scoreRef.current));
            setPersonalBest(scoreRef.current);
            setIsNewBest(true);
          }
        } catch { /* private browsing / storage disabled -- personal best just won't persist */ }
      }
      return Math.max(0, left);
    });
  }, [bestKey]);

  useEffect(() => {
    if (step !== "playing") return;
    let nextSpawnAt = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() < nextSpawnAt) return;
      if (enemiesRef.current.length >= WORDDEFENDER_LANES) return;
      spawnEnemy(language);
      nextSpawnAt = Date.now() + worddefenderSpawnMs(waveRef.current);
    }, SPAWN_TICK_MS);
    return () => window.clearInterval(timer);
  }, [step, language, spawnEnemy]);

  useEffect(() => {
    if (step === "playing") requestAnimationFrame(() => inputRef.current?.focus());
  }, [step]);

  const normalize = useCallback((value: string) => (language === "hindi" ? value : value.trim().toLowerCase()), [language]);
  const enemyText = useCallback((e: Enemy) => (language === "hindi" ? e.target : e.target.toLowerCase()), [language]);

  // Real design intent: a shooter fires the instant a word is finished --
  // no separate confirm keypress (unlike WordTris's deliberate Space
  // confirm) -- so onChange itself both rejects impossible continuations
  // and detects a completed kill.
  const handleTyped = (value: string) => {
    if (step !== "playing") return;
    const isShrinking = value.length < typed.length && typed.startsWith(value);
    const norm = normalize(value);
    if (!isShrinking && norm && !enemiesRef.current.some((e) => enemyText(e).startsWith(norm))) return;
    setTyped(value);
    if (!norm) return;
    const killed = enemiesRef.current.find((e) => enemyText(e) === norm);
    if (killed) onKill(killed);
  };

  const normalizedTyped = normalize(typed);
  const lockedProgress = new Map<number, number>();
  if (normalizedTyped) for (const e of enemies) if (enemyText(e).startsWith(normalizedTyped)) lockedProgress.set(e.id, typed.length);

  const displayCategories = CATEGORIES;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <TypingBrandHeader backHref="/typing/games" backLabel="Games" />
      <section className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-rose-400 shadow-sm">
            🛡 Word Defender
          </span>
        </div>

        {step === "setup" && (
          <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="bg-slate-900 px-6 py-5">
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="text-2xl">☄️</span>
                <h1 className="text-2xl font-black text-white">Word Defender</h1>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">Waves of word-asteroids fall at once -- type any one to destroy it instantly, no need to press anything else. Start typing and the game locks onto whichever asteroid matches; a stray letter for a different one won't register. Every {WORDDEFENDER_KILLS_PER_WAVE} kills the wave speeds up. {WORDDEFENDER_STARTING_HEALTH} hits and your base is destroyed.</p>
            </div>
            <div className="p-6">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Language</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setLanguage("english")} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${language === "english" ? "bg-rose-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>English</button>
                <button type="button" onClick={() => setLanguage("hindi")} style={{ fontFamily: HI }} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${language === "hindi" ? "bg-rose-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>हिन्दी</button>
              </div>

              <p className="mt-5 text-xs font-black uppercase tracking-wider text-slate-500">Category</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {displayCategories.map((cat) => (
                  <button key={cat.id} type="button" onClick={() => setCategory(cat.id)} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${category === cat.id ? "bg-rose-50 text-rose-800 ring-2 ring-rose-600" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`} style={{ fontFamily: language === "hindi" ? HI : undefined }}>
                    {language === "hindi" ? cat.hi : cat.en}
                  </button>
                ))}
              </div>
              {personalBest && <p className="mt-4 text-xs text-slate-500">Your best on this category: <b className="text-slate-700">{personalBest} points</b>.</p>}

              <button type="button" onClick={() => startGame(language, category)} className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-3 text-base font-black text-white shadow-lg transition hover:bg-slate-800">Start →</button>
            </div>
          </div>
        )}

        {step === "playing" && (
          <div className="mt-6 rounded-3xl bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1.5" aria-label={`${health} base health left`}>
                {Array.from({ length: WORDDEFENDER_STARTING_HEALTH }).map((_, i) => (
                  <span key={i} aria-hidden="true" className={`text-lg ${i < health ? "" : "opacity-20 grayscale"}`}>🛡</span>
                ))}
              </div>
              <div className="flex items-center gap-4 text-sm font-black text-slate-700">
                <span>Wave <b className="text-lg text-slate-950">{wave}</b></span>
                <span>Score <b className="text-lg text-slate-950">{score}</b></span>
              </div>
            </div>

            <div className={`relative mt-4 h-96 overflow-hidden rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 ring-1 ring-slate-700 transition sm:h-[28rem] ${flash === "kill" ? "ring-4 ring-emerald-400" : flash === "impact" ? "ring-4 ring-rose-500" : ""}`}>
              {enemies.map((enemy) => (
                <EnemyView key={enemy.id} enemy={enemy} fontFamily={fontFamily} typedLength={lockedProgress.get(enemy.id) ?? 0} onImpact={onImpact} />
              ))}
              {explosions.map((x) => (
                <span key={x.id} aria-hidden="true" className="animate-wordtris-splash pointer-events-none absolute bottom-6 h-14 w-14 rounded-full border-2 border-orange-300" style={{ left: `${LANE_POSITIONS[x.lane]}%`, transform: "translateX(-50%)" }} />
              ))}
              <div className="absolute inset-x-0 bottom-0 h-3 bg-slate-700" aria-hidden="true" />
            </div>

            <div className="mt-3">
              <input
                ref={inputRef}
                value={typed}
                onChange={(event) => handleTyped(event.target.value)}
                spellCheck={false}
                autoFocus
                aria-label="Type any falling asteroid's word to destroy it"
                className="w-full rounded-xl border-2 border-slate-200 p-3 text-lg outline-none focus:border-slate-500"
                style={{ fontFamily }}
                placeholder="Type any falling word to destroy it…"
              />
            </div>
          </div>
        )}

        {step === "gameover" && (
          <div className="mt-6 space-y-5">
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="bg-slate-900 px-6 py-6 text-center">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Base destroyed</h2>
                <p className="mt-1 text-4xl font-black text-rose-400">{score}</p>
                <p className="mt-1 text-sm font-bold text-slate-400">Wave {wave} · {kills} {kills === 1 ? "asteroid" : "asteroids"} destroyed</p>
                {isNewBest && <p className="mt-3 inline-block rounded-full bg-rose-500/20 px-4 py-1.5 text-xs font-black text-rose-300">🏆 New personal best!</p>}
              </div>
              <div className="flex flex-wrap justify-center gap-2 p-5">
                <button type="button" onClick={() => startGame(language, category)} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800">Play again</button>
                <button type="button" onClick={() => setStep("setup")} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">Change setup</button>
              </div>
            </div>
            <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-500">Personal-best scores are kept on this device only, per language and category.</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
