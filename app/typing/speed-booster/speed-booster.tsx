"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BURST_LEVELS, BURST_PASS_WPM, COMMON_EXAM_WORDS, RHYTHM_PASSAGES, commonWordsDrill, keyStatsFrom, levelPassed, mergeKeyStats,
  practiceStreak, repeatWordsDrill, rhythmScore, scoreTyping, weakKeyDrill, weakestKeys, weeklyProgress,
  type KeyStats, type SessionLog, type TypingResult,
} from "@/lib/speed-booster";

// Speed Booster: the owner's request (23 Nov 2026) -- everything from the "stuck at 35-40 WPM, how do I reach 50+" advice,
// built as practice tools: the plan and technique check, burst training, common words, weak keys, rhythm and read-ahead.
// Progress is kept in this browser (localStorage): it is a practice tool, not a test, and nothing here is scored or saved
// to the student's results.

type Tab = "plan" | "burst" | "words" | "keys" | "rhythm";
const TABS: { id: Tab; label: string }[] = [
  { id: "plan", label: "Plan & Tips" },
  { id: "burst", label: "Burst Training" },
  { id: "words", label: "Common Words" },
  { id: "keys", label: "Weak Keys" },
  { id: "rhythm", label: "Rhythm & Read-ahead" },
];

type Store = {
  sessions: SessionLog[];
  keyStats: KeyStats;
  bestBurst: Record<string, number>; // best net WPM per sentence (any mistakes)
  bestCleanBurst: Record<string, number>; // best net WPM per sentence with no mistakes
  checklist: Record<string, boolean>;
  planDone: Record<string, string[]>; // date -> steps done that day
};
const EMPTY_STORE: Store = { sessions: [], keyStats: {}, bestBurst: {}, bestCleanBurst: {}, checklist: {}, planDone: {} };
const STORE_KEY = "sct-speed-booster-v1";
const todayKey = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

function readStore(): Store {
  try { const raw = localStorage.getItem(STORE_KEY); return raw ? { ...EMPTY_STORE, ...JSON.parse(raw) } : EMPTY_STORE; } catch { return EMPTY_STORE; }
}

function useStore() {
  // Rendered only in the browser (SpeedBoosterClient below), so the saved progress is read straight away.
  const [store, setStore] = useState<Store>(readStore);
  const update = useCallback((change: (current: Store) => Store) => {
    setStore((current) => {
      const next = change(current);
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* not remembered */ }
      return next;
    });
  }, []);
  return [store, update] as const;
}

// Browser-only: progress lives in localStorage, so the page is not rendered on the server.
export const SpeedBoosterClient = dynamic(() => Promise.resolve(SpeedBooster), { ssr: false, loading: () => <p className="mt-6 text-sm font-bold text-slate-500">Loading...</p> });

function SpeedBooster() {
  const [tab, setTab] = useState<Tab>("plan");
  const [store, update] = useStore();
  const recordSession = useCallback((kind: SessionLog["kind"], target: string, typed: string, result: TypingResult) => {
    update((current) => ({
      ...current,
      sessions: [...current.sessions, { date: todayKey(), kind, wpm: result.netWpm, accuracy: result.accuracy }].slice(-1000),
      keyStats: mergeKeyStats(current.keyStats, keyStatsFrom(target, typed)),
    }));
  }, [update]);

  return <div className="mt-6">
    <div role="tablist" aria-label="Speed Booster sections" className="flex flex-wrap gap-2">
      {TABS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
        className={`rounded-xl px-4 py-2 text-sm font-black ${tab === item.id ? "bg-blue-700 text-white shadow" : "bg-white text-slate-700 hover:bg-blue-50"}`}>{item.label}</button>)}
    </div>
    <div className="mt-5">
      {tab === "plan" && <PlanTab store={store} update={update} goTo={setTab} />}
      {tab === "burst" && <BurstTab store={store} update={update} recordSession={recordSession} />}
      {tab === "words" && <WordsTab recordSession={recordSession} />}
      {tab === "keys" && <KeysTab store={store} recordSession={recordSession} />}
      {tab === "rhythm" && <RhythmTab recordSession={recordSession} />}
    </div>
  </div>;
}

// ---------------------------------------------------------------- Plan & Tips

const TECHNIQUE_CHECKS = [
  { id: "no-look", text: "I never look at the keyboard while typing (cover your hands with a cloth for a week if needed)." },
  { id: "fingers", text: "Every key is pressed with its own finger (B with the left index, Y with the right index)." },
  { id: "shift", text: "I press Shift with the opposite hand from the letter." },
  { id: "home-row", text: "My fingers return to ASDF - JKL; after every key (feel the bumps on F and J)." },
  { id: "thumb", text: "The Space bar is pressed with a thumb, without moving my hands." },
];

const TIPS = [
  { title: "1. Fix your technique first", text: "Below 40 WPM the cause is almost always looking at the keyboard, wrong fingers or hands leaving the home row. Fixing these slows you for 1-2 weeks, then takes you well past 40." },
  { title: "2. Accuracy before speed", text: "In an exam one mistake costs about 10 words. Aim for 97%+ accuracy. If you make more than 2-3 mistakes a minute, slow down until it feels easy, then build up." },
  { title: "3. Type in a steady rhythm", text: "Fast typists do not hit each key faster -- they never stop. Type like a clock: tick-tick-tick, even on hard words. Do not rush easy words and then freeze." },
  { title: "4. Read one or two words ahead", text: "While your fingers type one word, your eyes should already be on the next. This alone can add 5-8 WPM. Train it in Rhythm & Read-ahead." },
  { title: "5. Train your weak keys", text: "Note the letters and words you get wrong most and drill them for 5 minutes a day. The Weak Keys tab finds them for you." },
  { title: "6. Burst training", text: "Type one short sentence as fast as you can for 15-20 seconds, rest, repeat. Then do one normal test at a comfortable speed. Bursts teach your fingers what 50+ feels like." },
  { title: "7. Small things", text: "Back straight, wrists not resting on the desk, screen at eye level, light touch on the keys. Practise commas, brackets, apostrophes and Shift on purpose." },
  { title: "8. Track weekly, not daily", text: "Daily scores go up and down. The weekly average shows the real trend. Most students go from about 38 to 50 WPM in 6-10 weeks of daily practice." },
];

const PLAN_STEPS: { id: string; minutes: number; text: string; tab?: Tab; href?: string }[] = [
  { id: "warmup", minutes: 5, text: "Warm-up: weak-key drill", tab: "keys" },
  { id: "words", minutes: 10, text: "Slow, perfect typing of common words (100% accuracy)", tab: "words" },
  { id: "burst", minutes: 5, text: "Burst sprints", tab: "burst" },
  { id: "test", minutes: 10, text: "One full 10-minute exam-style test", href: "/typing/exams" },
  { id: "review", minutes: 5, text: "Check your mistakes and drill the wrong words", href: "/typing/practice/error-drill" },
];

function PlanTab({ store, update, goTo }: { store: Store; update: (change: (current: Store) => Store) => void; goTo: (tab: Tab) => void }) {
  const today = todayKey();
  const doneToday = store.planDone[today] ?? [];
  const toggleStep = (id: string) => update((current) => {
    const list = current.planDone[today] ?? [];
    return { ...current, planDone: { ...current.planDone, [today]: list.includes(id) ? list.filter((step) => step !== id) : [...list, id] } };
  });
  const toggleCheck = (id: string) => update((current) => ({ ...current, checklist: { ...current.checklist, [id]: !current.checklist[id] } }));
  const weeks = weeklyProgress(store.sessions);
  const streak = practiceStreak(store.sessions, today);
  const checked = TECHNIQUE_CHECKS.filter((item) => store.checklist[item.id]).length;

  return <div className="grid gap-5 lg:grid-cols-2">
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">Today&apos;s 35-minute plan</h2>
      <p className="mt-1 text-sm text-slate-600">Every day beats a long session once a week. Tick each step when it is done.</p>
      <ol className="mt-4 space-y-2">
        {PLAN_STEPS.map((step) => <li key={step.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <input type="checkbox" aria-label={`Done: ${step.text}`} checked={doneToday.includes(step.id)} onChange={() => toggleStep(step.id)} className="h-5 w-5" />
          <span className="w-14 shrink-0 text-xs font-black text-blue-700">{step.minutes} min</span>
          <span className={`flex-1 text-sm font-bold ${doneToday.includes(step.id) ? "text-slate-400 line-through" : "text-slate-800"}`}>{step.text}</span>
          {step.tab && <button type="button" onClick={() => goTo(step.tab!)} className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 hover:bg-blue-100">Open</button>}
          {step.href && <Link href={step.href} className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 hover:bg-blue-100">Open</Link>}
        </li>)}
      </ol>
      <p className="mt-3 text-sm font-bold text-slate-700">{doneToday.length === PLAN_STEPS.length ? "All done for today. Well done!" : `${doneToday.length} of ${PLAN_STEPS.length} steps done today.`}</p>
    </section>

    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">Your progress</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Practice streak" value={`${streak} day${streak === 1 ? "" : "s"}`} />
        <Stat label="Drills done" value={String(store.sessions.length)} />
      </div>
      {weeks.length ? <table className="mt-4 w-full text-left text-sm">
        <thead><tr className="text-xs uppercase text-slate-500"><th className="py-1">Week from</th><th>Drills</th><th>Average WPM</th><th>Best WPM</th></tr></thead>
        <tbody>{weeks.map((week) => <tr key={week.weekStart} className="border-t border-slate-100"><td className="py-1.5 font-bold">{week.weekStart}</td><td>{week.sessions}</td><td className="font-black text-blue-700">{week.averageWpm}</td><td>{week.bestWpm}</td></tr>)}</tbody>
      </table> : <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Your weekly average appears here after your first drill. Watch the weekly average, not single scores.</p>}
      <p className="mt-3 text-xs text-slate-500">Progress is kept in this browser on this device.</p>
    </section>

    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">Technique self-check</h2>
      <p className="mt-1 text-sm text-slate-600">Be honest. Each unticked line is holding your speed down. Learn the correct finger for every key in the <Link href="/typing/learn" className="font-bold text-blue-700 underline">Learn Typing</Link> lessons.</p>
      <ul className="mt-3 space-y-2">
        {TECHNIQUE_CHECKS.map((item) => <li key={item.id}><label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-800">
          <input type="checkbox" checked={Boolean(store.checklist[item.id])} onChange={() => toggleCheck(item.id)} className="mt-0.5 h-5 w-5" />{item.text}</label></li>)}
      </ul>
      <p className={`mt-3 rounded-xl p-3 text-sm font-bold ${checked === TECHNIQUE_CHECKS.length ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}>
        {checked === TECHNIQUE_CHECKS.length ? "Technique is right. Now speed comes from daily practice." : "Fix the unticked habits first. You will slow down for 1-2 weeks, then pass 40 WPM."}
      </p>
    </section>

    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">8 tips to go from 40 to 50+ WPM</h2>
      <div className="mt-3 space-y-3">{TIPS.map((tip) => <div key={tip.title}><h3 className="text-sm font-black text-slate-900">{tip.title}</h3><p className="text-sm leading-6 text-slate-600">{tip.text}</p></div>)}</div>
    </section>
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-blue-50 p-3"><p className="text-xs font-bold uppercase text-blue-700">{label}</p><p className="text-2xl font-black text-slate-950">{value}</p></div>;
}

// ---------------------------------------------------------------- Typing drill engine

type DrillDone = { result: TypingResult; typed: string; wordTimes: number[] };

function TypingDrill({ target, timeLimitSec, readAhead = false, metronomeWpm = 0, onDone, hint }: {
  target: string; timeLimitSec?: number; readAhead?: boolean; metronomeWpm?: number; onDone: (done: DrillDone) => void; hint?: string;
}) {
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [finished, setFinished] = useState(false);
  const wordTimes = useRef<number[]>([]);
  const typedRef = useRef("");
  const startedRef = useRef<number | null>(null); // also set when a whole word arrives in one input event
  const finishRef = useRef<(value: string) => void>(() => {});
  const lastBoundary = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const targetWords = useMemo(() => target.trim().split(/\s+/u), [target]);

  const finish = useCallback((value: string) => {
    if (finished || startedRef.current === null) return;
    setFinished(true);
    const elapsed = Date.now() - startedRef.current;
    onDone({ result: scoreTyping(target, value, elapsed), typed: value, wordTimes: wordTimes.current });
  }, [finished, onDone, target]);

  useEffect(() => { finishRef.current = finish; }, [finish]);
  // The clock: updates the time shown and ends a timed burst when its time is up.
  useEffect(() => {
    if (startedAt === null || finished) return;
    const timer = window.setInterval(() => {
      const time = Date.now(); setNow(time);
      if (timeLimitSec && time - startedAt >= timeLimitSec * 1000) finishRef.current(typedRef.current.trimEnd());
    }, 200);
    return () => window.clearInterval(timer);
  }, [startedAt, finished, timeLimitSec]);

  // Metronome: one soft click per word at the chosen speed.
  useEffect(() => {
    if (!metronomeWpm || startedAt === null || finished) return;
    let context: AudioContext | null = null;
    try { context = new AudioContext(); } catch { return; }
    const click = () => {
      if (!context) return;
      const oscillator = context.createOscillator(); const gain = context.createGain();
      oscillator.frequency.value = 880; gain.gain.setValueAtTime(0.15, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.05);
      oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.06);
    };
    const timer = window.setInterval(click, 60000 / metronomeWpm);
    return () => { window.clearInterval(timer); void context?.close(); };
  }, [metronomeWpm, startedAt, finished]);

  const change = (value: string) => {
    if (finished) return;
    const time = Date.now();
    if (startedRef.current === null) { startedRef.current = time; setStartedAt(time); setNow(time); lastBoundary.current = time; }
    if (value.endsWith(" ") && !typed.endsWith(" ") && value.length > typed.length) { wordTimes.current.push(time - lastBoundary.current); lastBoundary.current = time; }
    setTyped(value); typedRef.current = value;
    const typedWords = value.trim().split(/\s+/u).filter(Boolean);
    if (typedWords.length >= targetWords.length && value.trimEnd().length >= target.trim().length && (value.endsWith(" ") || typedWords.at(-1) === targetWords.at(-1))) finish(value.trimEnd());
  };

  const reset = () => { setTyped(""); typedRef.current = ""; startedRef.current = null; setStartedAt(null); setFinished(false); wordTimes.current = []; inputRef.current?.focus(); };
  const elapsedSec = startedAt === null ? 0 : ((finished ? now : now || startedAt) - startedAt) / 1000;
  const live = startedAt !== null && elapsedSec > 1 ? scoreTyping(target, typed, elapsedSec * 1000) : null;
  const typedWords = typed.split(/\s+/u);
  // "the ca" -> ["the", "ca"] and "the cat " -> ["the", "cat", ""]: the word being typed is always the last entry.
  const currentIndex = typed.trim() ? typedWords.length - 1 : 0;
  const startedCurrent = !typed.endsWith(" ") && typed.length > 0;

  return <div>
    <p className="rounded-xl border border-slate-200 bg-white p-4 text-xl leading-10 text-slate-900" style={{ fontFamily: "Arial, Helvetica, sans-serif" }} aria-label="Text to type">
      {targetWords.map((word, index) => {
        const done = index < currentIndex || finished;
        const typedWord = typedWords[index];
        const isCurrent = index === currentIndex && !done;
        const color = done && typedWord !== undefined ? (typedWord === word ? "text-green-700" : "bg-red-100 text-red-700") : "";
        const hidden = readAhead && isCurrent && startedCurrent;
        return <span key={index}><span className={`${color} ${isCurrent ? "rounded bg-yellow-100 px-0.5 underline decoration-2" : ""}`}>{hidden ? "•".repeat(word.length) : word}</span>{" "}</span>;
      })}
    </p>
    {hint && <p className="mt-2 text-xs font-bold text-slate-500">{hint}</p>}
    <textarea ref={inputRef} autoFocus value={typed} disabled={finished} onChange={(event) => change(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); finish(typed.trimEnd()); } }}
      onPaste={(event) => event.preventDefault()} spellCheck={false} aria-label="Type here" rows={3}
      placeholder="Start typing -- the timer starts with your first key. Press Enter to finish early."
      className="mt-3 w-full resize-none rounded-xl border-2 border-blue-300 p-3 text-lg outline-none focus:border-blue-600" style={{ fontFamily: "Arial, Helvetica, sans-serif" }} />
    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-bold text-slate-700">
      <span>Time: {elapsedSec.toFixed(1)}s{timeLimitSec ? ` / ${timeLimitSec}s` : ""}</span>
      {live && <span>Speed: <strong className="text-blue-700">{live.netWpm} WPM</strong></span>}
      {live && <span>Mistakes: {live.mistakes}</span>}
      <button type="button" onClick={reset} className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-black hover:bg-slate-50">Restart</button>
    </div>
  </div>;
}

function ResultBox({ result, extra }: { result: TypingResult; extra?: React.ReactNode }) {
  return <div className="mt-4 rounded-xl bg-blue-50 p-4" role="status">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Net speed" value={`${result.netWpm} WPM`} />
      <Stat label="Gross speed" value={`${result.grossWpm} WPM`} />
      <Stat label="Accuracy" value={`${result.accuracy}%`} />
      <Stat label="Mistakes" value={String(result.mistakes)} />
    </div>
    {extra}
  </div>;
}

// ---------------------------------------------------------------- Burst Training

function BurstTab({ store, update, recordSession }: { store: Store; update: (change: (current: Store) => Store) => void; recordSession: (kind: SessionLog["kind"], target: string, typed: string, result: TypingResult) => void }) {
  const [levelId, setLevelId] = useState(1);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [rep, setRep] = useState(1);
  const [run, setRun] = useState(0);
  const [last, setLast] = useState<TypingResult | null>(null);
  const level = BURST_LEVELS.find((item) => item.id === levelId) ?? BURST_LEVELS[0];
  const sentence = level.sentences[sentenceIndex];

  const done = ({ result, typed }: DrillDone) => {
    setLast(result);
    recordSession("burst", sentence, typed, result);
    update((current) => ({
      ...current,
      bestBurst: { ...current.bestBurst, [sentence]: Math.max(current.bestBurst[sentence] ?? 0, result.netWpm) },
      bestCleanBurst: result.mistakes === 0 && result.totalWords >= sentence.split(/\s+/u).length
        ? { ...current.bestCleanBurst, [sentence]: Math.max(current.bestCleanBurst[sentence] ?? 0, result.netWpm) } : current.bestCleanBurst,
    }));
  };
  const again = () => { setLast(null); setRun((value) => value + 1); setRep((value) => Math.min(3, value + 1)); };
  const pick = (index: number) => { setSentenceIndex(index); setRep(1); setLast(null); setRun((value) => value + 1); };
  const next = () => pick((sentenceIndex + 1) % level.sentences.length);
  const changeLevel = (id: number) => { setLevelId(id); setSentenceIndex(0); setRep(1); setLast(null); setRun((value) => value + 1); };

  return <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">Burst Training</h2>
      <p className="mt-1 text-sm text-slate-600">Type the sentence as fast as you can (20 seconds at most), rest a few seconds, and repeat it 3 times. More than one mistake? Type it once slowly and perfectly before the next burst. A level is passed when every sentence is typed at {BURST_PASS_WPM}+ WPM with no mistakes.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {BURST_LEVELS.map((item) => <button key={item.id} type="button" aria-pressed={item.id === levelId} onClick={() => changeLevel(item.id)}
          className={`rounded-lg px-3 py-1.5 text-xs font-black ${item.id === levelId ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-blue-50"}`}>
          Level {item.id}{levelPassed(item, store.bestCleanBurst) ? " ✓" : ""}</button>)}
      </div>
      <p className="mt-3 text-sm font-black text-slate-900">Level {level.id}: {level.title}</p>
      <p className="text-sm text-slate-600">{level.goal}</p>
      <p className="mt-4 text-xs font-black uppercase tracking-wide text-blue-700">Sentence {sentenceIndex + 1} of {level.sentences.length} · Burst {rep} of 3</p>
      <div className="mt-2"><TypingDrill key={`${levelId}-${sentenceIndex}-${run}`} target={sentence} timeLimitSec={20} onDone={done} /></div>
      {last && <ResultBox result={last} extra={<div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm font-bold text-slate-700">{last.mistakes > 1 ? "Too many mistakes: type it once slowly and perfectly." : last.netWpm >= BURST_PASS_WPM && last.mistakes === 0 ? "Excellent burst!" : "Good. Try to beat it in the next burst."}</p>
        {rep < 3 && <button type="button" onClick={again} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">Next burst</button>}
        <button type="button" onClick={next} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-black text-white">Next sentence</button>
      </div>} />}
    </section>
    <aside className="rounded-2xl bg-white p-5 shadow-sm">
      <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Sentences in this level</h3>
      <ul className="mt-3 space-y-2">
        {level.sentences.map((item, index) => {
          const clean = store.bestCleanBurst[item] ?? 0; const best = store.bestBurst[item] ?? 0;
          return <li key={item}><button type="button" onClick={() => pick(index)} className={`w-full rounded-xl p-2 text-left text-xs ${index === sentenceIndex ? "bg-blue-50 ring-2 ring-blue-500" : "bg-slate-50 hover:bg-blue-50"}`}>
            <span className="block font-bold text-slate-800">{item}</span>
            <span className={`mt-1 block font-black ${clean >= BURST_PASS_WPM ? "text-green-700" : "text-slate-500"}`}>{best ? `Best ${best} WPM${clean ? ` · no-mistake best ${clean}` : ""}` : "Not typed yet"}</span>
          </button></li>;
        })}
      </ul>
    </aside>
  </div>;
}

// ---------------------------------------------------------------- Common Words

function WordsTab({ recordSession }: { recordSession: (kind: SessionLog["kind"], target: string, typed: string, result: TypingResult) => void }) {
  const [text, setText] = useState(() => commonWordsDrill(30));
  const [run, setRun] = useState(0);
  const [outcome, setOutcome] = useState<{ result: TypingResult; slow: string[]; wrong: string[] } | null>(null);
  const done = ({ result, typed, wordTimes }: DrillDone) => {
    recordSession("words", text, typed, result);
    const target = text.split(" "); const typedWords = typed.trim().split(/\s+/u);
    const wrong = [...new Set(target.filter((word, index) => typedWords[index] !== undefined && typedWords[index] !== word))];
    const perChar = wordTimes.map((ms, index) => ({ word: target[index], speed: ms / Math.max(1, (target[index] ?? "").length + 1) })).filter((item) => item.word);
    const slow = [...new Set(perChar.sort((a, b) => b.speed - a.speed).slice(0, 6).map((item) => item.word))];
    setOutcome({ result, slow, wrong });
  };
  const fresh = (value: string) => { setText(value); setOutcome(null); setRun((count) => count + 1); };

  return <section className="rounded-2xl bg-white p-5 shadow-sm">
    <h2 className="text-lg font-black text-slate-950">Common Words</h2>
    <p className="mt-1 text-sm text-slate-600">The {COMMON_EXAM_WORDS.length} words that come again and again in exam passages. Type slowly and perfectly (100% accuracy) until each word feels like one movement. After each line you get your slowest and wrong words to drill.</p>
    <div className="mt-4"><TypingDrill key={run} target={text} onDone={done} /></div>
    {outcome && <ResultBox result={outcome.result} extra={<div className="mt-3 space-y-2 text-sm">
      {outcome.wrong.length > 0 && <p><strong className="text-red-700">Wrong words:</strong> {outcome.wrong.join(", ")}</p>}
      {outcome.slow.length > 0 && <p><strong className="text-amber-700">Slowest words:</strong> {outcome.slow.join(", ")}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        {(outcome.wrong.length > 0 || outcome.slow.length > 0) && <button type="button" onClick={() => fresh(repeatWordsDrill([...new Set([...outcome.wrong, ...outcome.slow])], 4))} className="rounded-lg bg-blue-700 px-4 py-2 font-black text-white">Drill these words</button>}
        <button type="button" onClick={() => fresh(commonWordsDrill(30))} className="rounded-lg bg-slate-800 px-4 py-2 font-black text-white">New line</button>
      </div>
    </div>} />}
  </section>;
}

// ---------------------------------------------------------------- Weak Keys

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

function KeysTab({ store, recordSession }: { store: Store; recordSession: (kind: SessionLog["kind"], target: string, typed: string, result: TypingResult) => void }) {
  const weakest = weakestKeys(store.keyStats, 5);
  const [chosen, setChosen] = useState<string[]>(() => weakest.length ? weakest.map((item) => item.key) : ["b", "v", "y", "q", "x"]);
  const [text, setText] = useState(() => weakKeyDrill(chosen, 24));
  const [run, setRun] = useState(0);
  const [last, setLast] = useState<TypingResult | null>(null);
  const toggle = (key: string) => setChosen((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  const build = (letters: string[]) => { setText(weakKeyDrill(letters, 24)); setLast(null); setRun((count) => count + 1); };

  return <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">Your weak keys</h2>
      <p className="mt-1 text-sm text-slate-600">Worked out from every drill you type here. Red keys are missed most. Tap keys to choose what to drill.</p>
      <div className="mt-4 space-y-1.5">
        {KEY_ROWS.map((row, rowIndex) => <div key={row} className="flex gap-1.5" style={{ paddingLeft: `${rowIndex * 14}px` }}>
          {[...row].map((key) => {
            const stat = store.keyStats[key]; const seen = stat ? stat.hits + stat.misses : 0; const rate = seen ? stat!.misses / seen : 0;
            const tone = seen < 5 ? "bg-slate-100 text-slate-500" : rate >= 0.08 ? "bg-red-500 text-white" : rate >= 0.03 ? "bg-amber-400 text-slate-900" : "bg-green-500 text-white";
            return <button key={key} type="button" aria-pressed={chosen.includes(key)} title={seen ? `${key.toUpperCase()}: ${Math.round(rate * 100)}% missed of ${seen}` : `${key.toUpperCase()}: not enough data yet`} onClick={() => toggle(key)}
              className={`h-9 w-9 rounded-lg text-sm font-black uppercase ${tone} ${chosen.includes(key) ? "ring-4 ring-blue-600" : ""}`}>{key}</button>;
          })}
        </div>)}
      </div>
      <p className="mt-3 text-xs text-slate-500">Green: fine · Amber: sometimes missed · Red: missed often · Grey: not enough typing yet.</p>
      {weakest.length > 0 ? <p className="mt-3 text-sm font-bold text-slate-800">Weakest now: {weakest.map((item) => `${item.key.toUpperCase()} (${Math.round(item.missRate * 100)}%)`).join(", ")}</p>
        : <p className="mt-3 text-sm text-slate-600">Type a few drills (any tab) and your weak keys will show here. Until then, start with B, V, Y, Q and X.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {weakest.length > 0 && <button type="button" onClick={() => { const keys = weakest.map((item) => item.key); setChosen(keys); build(keys); }} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-black text-white">Drill my weakest keys</button>}
        <button type="button" onClick={() => build(chosen)} disabled={!chosen.length} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-black text-white disabled:bg-slate-300">Drill chosen keys ({chosen.map((key) => key.toUpperCase()).join(" ") || "none"})</button>
      </div>
    </section>
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">Weak-key drill</h2>
      <p className="mt-1 text-sm text-slate-600">Words full of the chosen letters. Keep the same rhythm on the hard keys -- do not stop before them.</p>
      <div className="mt-4"><TypingDrill key={run} target={text} onDone={({ result, typed }) => { setLast(result); recordSession("keys", text, typed, result); }} /></div>
      {last && <ResultBox result={last} extra={<div className="mt-3"><button type="button" onClick={() => build(chosen)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">New drill</button></div>} />}
    </section>
  </div>;
}

// ---------------------------------------------------------------- Rhythm & Read-ahead

function RhythmTab({ recordSession }: { recordSession: (kind: SessionLog["kind"], target: string, typed: string, result: TypingResult) => void }) {
  const [passageIndex, setPassageIndex] = useState(0);
  const [readAhead, setReadAhead] = useState(true);
  const [metronome, setMetronome] = useState(0);
  const [run, setRun] = useState(0);
  const [outcome, setOutcome] = useState<{ result: TypingResult; rhythm: number } | null>(null);
  const text = RHYTHM_PASSAGES[passageIndex];
  const restart = () => { setOutcome(null); setRun((count) => count + 1); };

  return <section className="rounded-2xl bg-white p-5 shadow-sm">
    <h2 className="text-lg font-black text-slate-950">Rhythm & Read-ahead</h2>
    <p className="mt-1 text-sm text-slate-600"><strong>Read-ahead:</strong> as soon as you start a word it is hidden, so you must have read it already -- this trains your eyes to stay one word ahead. <strong>Metronome:</strong> one click per word at your target speed; type in time with the beat. Your <strong>rhythm score</strong> shows how steady you were (100 = a perfect, even beat).</p>
    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-bold">
      <label className="flex items-center gap-2"><input type="checkbox" checked={readAhead} onChange={(event) => { setReadAhead(event.target.checked); restart(); }} className="h-5 w-5" />Read-ahead (hide the word I am typing)</label>
      <label className="flex items-center gap-2">Metronome
        <select value={metronome} onChange={(event) => { setMetronome(Number(event.target.value)); restart(); }} className="input py-1">
          <option value={0}>Off</option>{[35, 40, 45, 50, 55, 60].map((wpm) => <option key={wpm} value={wpm}>{wpm} WPM</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2">Passage
        <select value={passageIndex} onChange={(event) => { setPassageIndex(Number(event.target.value)); restart(); }} className="input py-1">
          {RHYTHM_PASSAGES.map((passage, index) => <option key={index} value={index}>{index + 1}. {passage.split(" ").slice(0, 4).join(" ")}...</option>)}
        </select>
      </label>
    </div>
    <div className="mt-4"><TypingDrill key={`${run}-${passageIndex}-${readAhead}-${metronome}`} target={text} readAhead={readAhead} metronomeWpm={metronome}
      hint={metronome ? "Tip: start at your current speed, then raise the metronome by 5 WPM each week." : undefined}
      onDone={({ result, typed, wordTimes }) => { recordSession("rhythm", text, typed, result); setOutcome({ result, rhythm: rhythmScore(wordTimes) }); }} /></div>
    {outcome && <ResultBox result={outcome.result} extra={<div className="mt-3 flex flex-wrap items-center gap-3">
      <Stat label="Rhythm score" value={`${outcome.rhythm} / 100`} />
      <p className="flex-1 text-sm font-bold text-slate-700">{outcome.rhythm >= 75 ? "Very steady rhythm. Now raise the metronome a little." : outcome.rhythm >= 55 ? "Fairly steady. Try not to stop before long words." : "Uneven: you rush some words and stop on others. Use the metronome at a slower speed."}</p>
      <button type="button" onClick={restart} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">Type again</button>
    </div>} />}
  </section>;
}
