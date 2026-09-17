"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Finger, FingerInfo, KeyCap } from "@/lib/english-tutor-content";
import { TypingBrandHeader } from "../../_components/typing-brand";

const UI = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, "Courier New", monospace';

type Exercise = { id: string; title: string; target: string; focusKeys?: string[] };

type Props = {
  keyboardRows: KeyCap[][];
  glyphKeys: KeyCap[];
  fingers: FingerInfo[];
  lessons: Exercise[];
  wordSets: Exercise[];
  paragraphs: Exercise[];
};

const STEPS = [
  { label: "Read Instructions" },
  { label: "Learn Keys" },
  { label: "Practice Words" },
  { label: "Type Paragraphs" },
];

export function EnglishTutor({ keyboardRows, glyphKeys, fingers, lessons, wordSets, paragraphs }: Props) {
  const [step, setStep] = useState(0);
  const [lessonIdx, setLessonIdx] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);
  const [paraIdx, setParaIdx] = useState(0);

  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ seconds: number; errors: number; grossWpm: number; netWpm: number; accuracy: number } | null>(null);
  const [now, setNow] = useState(0);

  const [showKeyboard, setShowKeyboard] = useState(true);
  const [moveOnError, setMoveOnError] = useState(true);
  const [bold, setBold] = useState(false);
  const [sound, setSound] = useState(false);
  const [fontPx, setFontPx] = useState(28);
  const [backspaceEnabled, setBackspaceEnabled] = useState(true);
  const [backspaceCount, setBackspaceCount] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  };

  const fingerName = useCallback((finger: Finger) => fingers.find((f) => f.id === finger)?.en ?? "", [fingers]);
  const fingerColor = useCallback((finger: Finger) => fingers.find((f) => f.id === finger)?.color ?? "#94a3b8", [fingers]);

  const tone = useCallback((freq: number, ms: number, gain = 0.05) => {
    if (!sound) return;
    try {
      const ctx = audioRef.current ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioRef.current = ctx;
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.connect(vol);
      vol.connect(ctx.destination);
      osc.frequency.value = freq;
      vol.gain.value = gain;
      osc.start();
      osc.stop(ctx.currentTime + ms / 1000);
    } catch {
      /* ignore */
    }
  }, [sound]);

  // character -> the key + finger that produces it. Unlike the Kruti Dev
  // tutor, every character is exactly one physical keystroke (with Shift
  // for uppercase letters and the shifted symbols), so this is a plain
  // one-character lookup rather than a byte-sequence match.
  const reverse = useMemo(() => {
    const map = new Map<string, { key: string; shift: boolean; finger: Finger }>();
    for (const cap of glyphKeys) {
      if (cap.normal && !map.has(cap.normal)) map.set(cap.normal, { key: cap.key, shift: false, finger: cap.finger });
      if (cap.shift && !map.has(cap.shift)) map.set(cap.shift, { key: cap.key, shift: true, finger: cap.finger });
    }
    map.set(" ", { key: "Space", shift: false, finger: "thumb" });
    return map;
  }, [glyphKeys]);

  const exercises = step === 1 ? lessons : step === 2 ? wordSets : step === 3 ? paragraphs : [];
  const idx = step === 1 ? lessonIdx : step === 2 ? wordIdx : paraIdx;
  const setIdx = step === 1 ? setLessonIdx : step === 2 ? setWordIdx : setParaIdx;
  const exercise: Exercise | undefined = exercises[idx];
  const target = exercise?.target ?? "";

  const reset = useCallback(() => {
    setTyped("");
    setStartedAt(null);
    setDone(false);
    setResult(null);
    setNow(0);
    setBackspaceCount(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // reset whenever the active exercise or step changes
  useEffect(() => { reset(); }, [step, idx, reset]);

  // live clock while a drill is in progress
  useEffect(() => {
    if (!startedAt || done) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [startedAt, done]);

  const caret = typed.length;
  const nextKey = useMemo(() => {
    const char = target[caret];
    if (char === undefined) return null;
    return reverse.get(char) ?? { rawKey: char };
  }, [target, caret, reverse]);

  const activeKey = nextKey && "key" in nextKey ? nextKey.key : null;

  const finish = useCallback((value: string) => {
    const seconds = Math.max(1, (Date.now() - (startedAt ?? Date.now())) / 1000);
    let correct = 0;
    for (let i = 0; i < target.length; i += 1) if (value[i] === target[i]) correct += 1;
    const minutes = seconds / 60;
    setResult({
      seconds: Math.round(seconds),
      errors: target.length - correct,
      grossWpm: Math.max(0, Math.round(value.length / 5 / minutes)),
      netWpm: Math.max(0, Math.round(correct / 5 / minutes)),
      accuracy: target.length ? Math.round((correct / target.length) * 100) : 0,
    });
    setDone(true);
    tone(660, 90);
    window.setTimeout(() => tone(880, 120), 100);
  }, [startedAt, target, tone]);

  const handleChange = (raw: string) => {
    if (done) return;
    const value = raw.length > target.length ? raw.slice(0, target.length) : raw;
    if (!moveOnError && value.length > typed.length) {
      const i = value.length - 1;
      if (value[i] !== target[i]) { tone(200, 90, 0.06); return; }
    }
    if (startedAt === null && value.length > 0) setStartedAt(Date.now());
    setTyped(value);
    if (value.length === target.length && target.length > 0) finish(value);
  };

  const live = useMemo(() => {
    let correct = 0;
    for (let i = 0; i < typed.length; i += 1) if (typed[i] === target[i]) correct += 1;
    const seconds = startedAt ? Math.max(1, ((done ? startedAt : now || startedAt) - startedAt) / 1000 || 1) : 0;
    const activeSeconds = startedAt && !done ? Math.max(1, (Date.now() - startedAt) / 1000) : seconds;
    const minutes = activeSeconds / 60;
    return {
      correct,
      errors: typed.length - correct,
      accuracy: typed.length ? Math.round((correct / typed.length) * 100) : 100,
      wpm: activeSeconds ? Math.max(0, Math.round(correct / 5 / minutes)) : 0,
      grossWpm: activeSeconds ? Math.max(0, Math.round(typed.length / 5 / minutes)) : 0,
      progress: target.length ? Math.round((typed.length / target.length) * 100) : 0,
    };
  }, [typed, target, startedAt, done, now]);

  const total = exercises.length;
  const kbdVisible = step !== 3 && showKeyboard;

  return (
    <main ref={rootRef} className="min-h-screen overflow-y-auto bg-slate-100" style={{ fontFamily: UI }}>
      {!isFullscreen && <TypingBrandHeader />}
      <section className="mx-auto max-w-6xl px-3 py-5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/typing/learn/english" className="text-sm font-bold text-blue-700">← All English Lessons</Link>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-600 shadow-sm">QWERTY · English Typing Tutor</span>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-pressed={isFullscreen}
              title={isFullscreen ? "Exit full screen" : "Full screen"}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            >
              {isFullscreen ? (
                <span aria-hidden className="text-sm font-black leading-none">✕</span>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <StepRail step={step} onPick={setStep} />

        {step === 0 ? (
          <InstructionsStep
            keyboardRows={keyboardRows}
            fingers={fingers}
            fingerColor={fingerColor}
            onStart={() => setStep(1)}
          />
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-white px-3 py-2.5 shadow-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-slate-600">
                <span>Progress</span>
                <span className="text-slate-900">Speed <b className="text-sm">{live.wpm}</b><span className="text-slate-400"> / {live.grossWpm}</span></span>
                <span className={live.errors ? "text-rose-600" : "text-emerald-600"}>Accuracy <b className="text-sm">{live.accuracy}%</b></span>
                <span>Errors <b className="text-sm text-slate-900">{live.errors}</b></span>
                <span>Backspace <b className="text-sm text-slate-900">{backspaceCount}</b></span>
                <span>Complete <b className="text-sm text-slate-900">{live.progress}%</b></span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all" style={{ width: `${live.progress}%` }} />
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-black text-slate-600 disabled:opacity-40">«</button>
                    <label className="text-sm font-bold text-slate-700">
                      <span className="sr-only">Choose an exercise</span>
                      <select
                        value={idx}
                        onChange={(event) => setIdx(Number(event.target.value))}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold text-slate-800"
                      >
                        {exercises.map((item, position) => (
                          <option key={item.id} value={position}>{`Exercise ${position + 1}/${total} — ${item.title}`}</option>
                        ))}
                      </select>
                    </label>
                    <button type="button" onClick={() => setIdx(Math.min(total - 1, idx + 1))} disabled={idx >= total - 1} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-black text-slate-600 disabled:opacity-40">»</button>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-black text-slate-600">
                    <button type="button" onClick={() => setFontPx((value) => Math.max(16, value - 2))} className="rounded-md bg-slate-100 px-2 py-1">A−</button>
                    <span className="w-10 text-center">{fontPx}</span>
                    <button type="button" onClick={() => setFontPx((value) => Math.min(48, value + 2))} className="rounded-md bg-slate-100 px-2 py-1">A+</button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700">
                  <Toggle checked={bold} onChange={setBold} label="Bold text" />
                  {step !== 3 && <Toggle checked={showKeyboard} onChange={setShowKeyboard} label="Show keyboard" />}
                  <Toggle checked={moveOnError} onChange={setMoveOnError} label="Move on past mistakes" />
                  <Toggle checked={sound} onChange={setSound} label="Sound" />
                  <Toggle checked={backspaceEnabled} onChange={setBackspaceEnabled} label="Backspace" />
                  {step === 3 && <p className="w-full rounded-lg bg-blue-50 p-2 text-xs font-bold text-blue-800">Test mode — no on-screen keyboard in this step.</p>}
                </div>

                <div
                  className="mt-4 min-h-56 w-full max-w-full overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-blue-50/70 p-4 ring-1 ring-blue-100 sm:min-h-64 md:min-h-72 lg:min-h-80"
                  style={{ fontFamily: MONO, fontSize: `${fontPx}px`, lineHeight: 1.9, fontWeight: bold ? 700 : 400, maxHeight: "min(45vh, 34rem)" }}
                  aria-hidden
                >
                  {[...target].map((char, position) => {
                    const state = position < typed.length
                      ? (typed[position] === char ? "ok" : "bad")
                      : position === caret ? "cur" : "todo";
                    const cls = state === "ok" ? "text-emerald-600"
                      : state === "bad" ? "rounded bg-rose-200 text-rose-700"
                      : state === "cur" ? "rounded bg-amber-300 text-slate-900"
                      : "text-slate-400";
                    return <span key={position} className={cls}>{char === " " ? " " : char}</span>;
                  })}
                </div>

                <textarea
                  ref={inputRef}
                  value={typed}
                  onChange={(event) => handleChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Backspace") return;
                    setBackspaceCount((value) => value + 1);
                    if (!backspaceEnabled) event.preventDefault();
                  }}
                  onPaste={(event) => event.preventDefault()}
                  spellCheck={false}
                  autoFocus
                  aria-label="Typing area"
                  className="mt-3 h-52 w-full resize-y rounded-xl border-2 border-slate-200 p-3 outline-none focus:border-blue-500 sm:h-60 md:h-64 lg:h-72"
                  style={{ fontFamily: MONO, fontSize: `${fontPx}px`, lineHeight: 1.8, fontWeight: bold ? 700 : 400 }}
                  placeholder="Start typing here…"
                />

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-bold text-slate-500">Press:</span>
                  {nextKey && "key" in nextKey ? (
                    <span className="font-black text-slate-900">
                      {nextKey.key === "Space"
                        ? "Space"
                        : nextKey.shift
                          ? `Shift + ${nextKey.key.toUpperCase()}`
                          : nextKey.key}
                      <span className="ml-2 font-bold text-slate-500">({fingerName(nextKey.finger)})</span>
                    </span>
                  ) : nextKey && "rawKey" in nextKey ? (
                    <span className="font-black text-slate-900">{nextKey.rawKey}</span>
                  ) : (
                    <span className="font-black text-emerald-600">Complete ✓</span>
                  )}
                </div>
              </div>

              {done && result && (
                <ResultCard
                  result={result}
                  isTest={step === 3}
                  hasNext={idx < total - 1}
                  onRetry={reset}
                  onNext={() => setIdx(Math.min(total - 1, idx + 1))}
                />
              )}

              {kbdVisible && (
                <div className="overflow-x-auto">
                  <KeyboardDiagram
                    keyboardRows={keyboardRows}
                    fingerColor={fingerColor}
                    activeKey={activeKey}
                    activeShift={Boolean(nextKey && "shift" in nextKey && nextKey.shift)}
                    compact
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function StepRail({ step, onPick }: { step: number; onPick: (value: number) => void }) {
  return (
    <div className="mt-4 flex items-stretch gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-sm sm:gap-2">
      {STEPS.map((item, position) => {
        const active = position === step;
        const doneStep = position < step;
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onPick(position)}
            className={`flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition sm:text-sm ${
              active ? "bg-blue-600 text-white shadow" : doneStep ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${active ? "bg-white/25" : doneStep ? "bg-emerald-200 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
              {doneStep ? "✓" : position + 1}
            </span>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function InstructionsStep({
  keyboardRows,
  fingers,
  fingerColor,
  onStart,
}: {
  keyboardRows: KeyCap[][];
  fingers: FingerInfo[];
  fingerColor: (finger: Finger) => string;
  onStart: () => void;
}) {
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
        <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">Correct Finger Position for English Typing</h1>
        <p className="mt-2 text-slate-600">Rest your fingers on the keyboard exactly as shown below. Your left hand rests on <b>A S D F</b> and your right hand rests on <b>J K L ;</b>. Keep your thumbs on the space bar.</p>

        <div className="mt-5 overflow-x-auto">
          <KeyboardDiagram keyboardRows={keyboardRows} fingerColor={fingerColor} activeKey={null} activeShift={false} />
        </div>

        <div className="mt-5">
          <div>
            <h2 className="text-sm font-black text-slate-800">Fingers and Colours</h2>
            <ul className="mt-2 grid grid-cols-2 gap-1.5 text-sm font-bold text-slate-700 sm:grid-cols-3 lg:grid-cols-4">
              {fingers.map((finger) => (
                <li key={finger.id} className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full" style={{ background: finger.color }} />
                  {finger.en}
                </li>
              ))}
            </ul>
            <h2 className="mt-4 text-sm font-black text-slate-800">How this tutor works</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Every key on a standard QWERTY keyboard types the exact letter, number or symbol shown on it — there is no font conversion involved.
              Hold Shift for capital letters and the upper symbol on a key (e.g. Shift + 1 → !). Keep your eyes on the screen, not the keyboard,
              and let each finger return to its home-row key after every keystroke.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-base font-black text-white shadow-lg transition hover:brightness-105 sm:w-auto"
        >
          Start Learning to Type →
        </button>
      </div>
    </div>
  );
}

function KeyboardDiagram({
  keyboardRows,
  fingerColor,
  activeKey,
  activeShift,
  compact = false,
}: {
  keyboardRows: KeyCap[][];
  fingerColor: (finger: Finger) => string;
  activeKey: string | null;
  activeShift: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-2xl bg-slate-800 p-2 shadow-sm sm:p-3 ${compact ? "min-w-[560px]" : "min-w-[680px]"}`}>
      <div className="space-y-1.5">
        {keyboardRows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1.5">
            {row.map((cap) => {
              const isGlyph = cap.key.length === 1;
              const isActive = activeKey != null && cap.key.trim() === activeKey.trim();
              const color = fingerColor(cap.finger);
              return (
                <div
                  key={cap.key}
                  style={{
                    flexGrow: cap.width ?? 1,
                    flexBasis: 0,
                    background: isActive ? color : isGlyph ? `${color}2e` : "rgba(255,255,255,0.06)",
                    borderColor: isActive ? "#fff" : "transparent",
                  }}
                  className={`relative flex ${compact ? "h-10 sm:h-11" : "h-12 sm:h-14"} min-w-0 flex-col items-center justify-center rounded-md border text-white`}
                >
                  {isGlyph && cap.shift && cap.shift !== cap.normal && (
                    <span
                      className={`absolute right-1 top-0 text-[13px] leading-none ${isActive && activeShift ? "text-slate-900" : "text-white/50"}`}
                      style={{ fontFamily: MONO }}
                    >
                      {cap.shift}
                    </span>
                  )}
                  {isGlyph ? (
                    <span className={`mt-1 text-lg leading-none ${isActive ? "text-slate-900" : "text-white"}`} style={{ fontFamily: MONO }}>
                      {cap.normal === " " ? "" : cap.normal}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-white/70">{cap.key.trim() || "Space"}</span>
                  )}
                  {cap.home && <span className="absolute bottom-1 h-0.5 w-3 rounded-full bg-white/70" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultCard({
  result,
  isTest,
  hasNext,
  onRetry,
  onNext,
}: {
  result: { seconds: number; errors: number; grossWpm: number; netWpm: number; accuracy: number };
  isTest: boolean;
  hasNext: boolean;
  onRetry: () => void;
  onNext: () => void;
}) {
  const passed = result.accuracy >= 90;
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${passed ? "bg-emerald-50" : "bg-amber-50"}`}>
      <h2 className={`text-lg font-black ${passed ? "text-emerald-800" : "text-amber-800"}`}>
        {passed ? "Great job!" : "Keep practising"}
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Net Speed" value={`${result.netWpm}`} />
        <Stat label="Gross Speed" value={`${result.grossWpm}`} />
        <Stat label="Accuracy" value={`${result.accuracy}%`} tone={passed ? "ok" : "bad"} />
        <Stat label="Time" value={`${result.seconds}s`} />
      </div>
      <p className="mt-2 text-sm font-bold text-slate-600">Errors: {result.errors}{isTest ? " · This is an exam-style exercise." : ""}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onRetry} className="rounded-lg bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm">Retry</button>
        {hasNext && <button type="button" onClick={onNext} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm">Next exercise →</button>}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <strong className={`mt-0.5 block text-base ${tone === "ok" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : "text-slate-900"}`}>{value}</strong>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span>{label}</span>
      <span
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-blue-600" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "left-4" : "left-0.5"}`} />
      </span>
    </label>
  );
}
