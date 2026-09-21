"use client";

import { useEffect, useRef, useState } from "react";
import type { CharacterPoolLanguage } from "@/lib/character-pool-content";
import { KEYHUNTER_SESSION_LENGTH, keyHunterWeakness, keyHunterPickNext, keyHunterRecord, type KeyHunterStatsMap } from "@/lib/keyhunter-content";
import { TypingBrandHeader } from "../../_components/typing-brand";

const HI = '"Nirmala UI", "Noto Sans Devanagari", system-ui, sans-serif';
const KD = '"Kruti Dev 010", "Nirmala UI", sans-serif';

type Language = CharacterPoolLanguage;
type Step = "setup" | "drilling" | "finished";
type Props = { characterPool: Record<CharacterPoolLanguage, string[]> };

function KeyCell({ label, weakness, fontFamily }: { label: string; weakness: number; fontFamily?: string }) {
  const clamped = Math.min(1, weakness / 4);
  const hue = 140 - clamped * 140; // 140 = green (strong) -> 0 = red (weak)
  return (
    <span
      className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-black text-white shadow-sm"
      style={{ backgroundColor: `hsl(${hue}, 65%, 45%)`, fontFamily }}
      title={label}
    >
      {label}
    </span>
  );
}

export function KeyHunterGame({ characterPool }: Props) {
  const [step, setStep] = useState<Step>("setup");
  const [language, setLanguage] = useState<Language>("english");
  const [statsMap, setStatsMap] = useState<KeyHunterStatsMap>({});
  const [currentKey, setCurrentKey] = useState("");
  const [typed, setTyped] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);
  const [correctPresses, setCorrectPresses] = useState(0);
  const [totalPresses, setTotalPresses] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const statsMapRef = useRef<KeyHunterStatsMap>({});
  const promptShownAtRef = useRef(0);
  const fontFamily = language === "hindi" ? KD : undefined;
  const statsKey = `keyhunter-stats-${language}`;
  const pool = characterPool[language];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(statsKey);
      const parsed = raw ? JSON.parse(raw) : {};
      statsMapRef.current = parsed;
      setStatsMap(parsed);
    } catch { statsMapRef.current = {}; setStatsMap({}); }
  }, [statsKey]);

  const startDrill = (lang: Language) => {
    setLanguage(lang);
    setPromptIndex(0);
    setCorrectPresses(0);
    setTotalPresses(0);
    setStreak(0);
    setBestStreak(0);
    setTyped("");
    const firstKey = keyHunterPickNext(characterPool[lang], statsMapRef.current);
    setCurrentKey(firstKey);
    promptShownAtRef.current = Date.now();
    setStep("drilling");
  };

  useEffect(() => {
    if (step === "drilling") requestAnimationFrame(() => inputRef.current?.focus());
  }, [step]);

  // Real design intent (researched from Keybr): accuracy comes first --
  // a wrong press flashes and must be retyped correctly before advancing,
  // rather than being allowed through like Speed Race/Word Defender.
  const handleTyped = (value: string) => {
    if (step !== "drilling") return;
    if (!value) { setTyped(""); return; }
    const correct = value === currentKey;
    const ms = Date.now() - promptShownAtRef.current;
    const updatedStats = keyHunterRecord(statsMapRef.current, currentKey, correct, ms);
    statsMapRef.current = updatedStats;
    setStatsMap(updatedStats);
    try { localStorage.setItem(statsKey, JSON.stringify(updatedStats)); } catch { /* private browsing / storage disabled -- stats just won't persist */ }
    setTotalPresses((t) => t + 1);
    setTyped("");
    if (correct) {
      setCorrectPresses((c) => c + 1);
      setStreak((s) => { const next = s + 1; setBestStreak((b) => Math.max(b, next)); return next; });
      setFlash("correct");
      window.setTimeout(() => setFlash(null), 150);
      setPromptIndex((i) => {
        const next = i + 1;
        if (next >= KEYHUNTER_SESSION_LENGTH) { setStep("finished"); return i; }
        const nextKey = keyHunterPickNext(pool, statsMapRef.current, currentKey);
        promptShownAtRef.current = Date.now();
        setCurrentKey(nextKey);
        return next;
      });
    } else {
      setStreak(0);
      setFlash("wrong");
      window.setTimeout(() => setFlash(null), 150);
    }
  };

  const accuracy = totalPresses > 0 ? Math.round((correctPresses / totalPresses) * 100) : 100;
  const sortedByWeakness = [...pool].sort((a, b) => keyHunterWeakness(statsMap[b]) - keyHunterWeakness(statsMap[a]));

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <TypingBrandHeader backHref="/typing/games" backLabel="Games" />
      <section className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-violet-400 shadow-sm">
            🎯 Key Hunter
          </span>
        </div>

        {step === "setup" && (
          <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="bg-slate-900 px-6 py-5">
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="text-2xl">🎯</span>
                <h1 className="text-2xl font-black text-white">Key Hunter</h1>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">Drills the keys you're genuinely slow or wrong on more often than the ones you've already mastered -- it remembers your per-key speed and accuracy on this device and adapts every session. A key must be typed correctly to advance.</p>
            </div>
            <div className="p-6">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Language</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setLanguage("english")} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${language === "english" ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>English</button>
                <button type="button" onClick={() => setLanguage("hindi")} style={{ fontFamily: HI }} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${language === "hindi" ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>हिन्दी</button>
              </div>

              <p className="mt-5 text-xs font-black uppercase tracking-wider text-slate-500">Your key heatmap so far</p>
              <div className="mt-2 flex flex-wrap gap-1.5 rounded-2xl bg-slate-50 p-3">
                {pool.map((k) => <KeyCell key={k} label={k} weakness={keyHunterWeakness(statsMap[k])} fontFamily={language === "hindi" ? KD : undefined} />)}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">Red = weak or slow, green = strong. Untried keys start red -- Key Hunter shows them first.</p>

              <button type="button" onClick={() => startDrill(language)} className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-3 text-base font-black text-white shadow-lg transition hover:bg-slate-800">Start Drill →</button>
            </div>
          </div>
        )}

        {step === "drilling" && (
          <div className="mt-6 rounded-3xl bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-black text-slate-700">
              <span>Key <b className="text-lg text-slate-950">{promptIndex + 1}</b> / {KEYHUNTER_SESSION_LENGTH}</span>
              <span>Streak <b className="text-lg text-slate-950">{streak}</b></span>
              <span>Accuracy <b className="text-lg text-slate-950">{accuracy}%</b></span>
            </div>

            <div className={`mt-5 flex h-48 items-center justify-center rounded-2xl transition ${flash === "correct" ? "bg-emerald-100" : flash === "wrong" ? "bg-rose-100" : "bg-slate-900"}`}>
              <span className={`text-7xl font-black ${flash ? "text-slate-900" : "text-white"}`} style={{ fontFamily }}>{currentKey}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5 rounded-2xl bg-slate-50 p-3">
              {pool.map((k) => <KeyCell key={k} label={k} weakness={keyHunterWeakness(statsMap[k])} fontFamily={language === "hindi" ? KD : undefined} />)}
            </div>

            <div className="mt-4">
              <input
                ref={inputRef}
                value={typed}
                onChange={(event) => handleTyped(event.target.value)}
                spellCheck={false}
                autoFocus
                aria-label="Type the highlighted key"
                className="w-full rounded-xl border-2 border-slate-200 p-3 text-lg outline-none focus:border-slate-500"
                style={{ fontFamily }}
                placeholder="Type the key shown above…"
              />
            </div>
          </div>
        )}

        {step === "finished" && (
          <div className="mt-6 space-y-5">
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="bg-slate-900 px-6 py-6 text-center">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Drill complete</h2>
                <p className="mt-1 text-4xl font-black text-violet-400">{accuracy}%</p>
                <p className="mt-1 text-sm font-bold text-slate-400">accuracy · best streak {bestStreak}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 p-5">
                <button type="button" onClick={() => startDrill(language)} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800">Drill again</button>
                <button type="button" onClick={() => setStep("setup")} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">Change setup</button>
              </div>
            </div>
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h3 className="font-black text-slate-950">Your weakest keys</h3>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {sortedByWeakness.map((k) => <KeyCell key={k} label={k} weakness={keyHunterWeakness(statsMap[k])} fontFamily={language === "hindi" ? KD : undefined} />)}
              </div>
              <p className="mt-4 text-xs text-slate-400">Stats are kept on this device only, per language, and carry over into your next drill.</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
