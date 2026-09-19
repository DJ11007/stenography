"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Finger, FingerInfo, KeyCap } from "@/lib/krutidev-tutor-content";
import { TypingBrandHeader } from "../../_components/typing-brand";
import { TypingSettingsPopup } from "../../_components/configurable-typing-exam";

const HI = '"Nirmala UI", "Noto Sans Devanagari", system-ui, sans-serif';
const KD = '"Kruti Dev 010", "Nirmala UI", sans-serif';

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
  { hi: "निर्देश पढ़ें", en: "Read Instructions" },
  { hi: "कुंजियाँ सीखें", en: "Learn Keys" },
  { hi: "शब्द अभ्यास", en: "Practice Words" },
  { hi: "अनुच्छेद टाइप करें", en: "Type Paragraphs" },
];

// Legacy bytes that no ordinary key emits -- surfaced in the Alt-code
// helper. Found incomplete by a systematic audit of every character this
// converter can actually produce (checked at the user's request): only 2
// of the 11 real Alt-code-only bytes were listed here, leaving a student
// with no in-app reference for 9 of them if their passage happened to
// contain कृ/ट्ट/ड्ड/ट्ठ/त्त्/the ट-cluster rakar/क्र/न्न/ह्म.
const ALT_CODES: Array<{ glyph: string; code: string; note: string }> = [
  { glyph: "ँ", code: "Alt + 0161", note: "चन्द्रबिंदु (ँ), जैसे पाँच" },
  { glyph: "ॉ", code: "Alt + 0130", note: "ऑ की मात्रा (ॉ), जैसे डॉक्टर" },
  { glyph: "कृ", code: "Alt + 0209", note: "कृ, जैसे कृषि" },
  { glyph: "ट्ट", code: "Alt + 0205", note: "ट्ट, जैसे खट्टा" },
  { glyph: "ड्ड", code: "Alt + 0236", note: "ड्ड, जैसे हड्डी" },
  { glyph: "ट्ठ", code: "Alt + 0235", note: "ट्ठ, जैसे चिट्ठी" },
  { glyph: "त्त्", code: "Alt + 0217", note: "त्त् (आधा), जैसे वित्तीय" },
  { glyph: "्र", code: "Alt + 0170", note: "ट-रकार, जैसे राष्ट्रीय" },
  { glyph: "क्र", code: "Alt + 0216", note: "क्र, जैसे क्रम, चक्रवात" },
  { glyph: "न्न", code: "Alt + 0233", note: "न्न, जैसे अन्न" },
  { glyph: "ह्म", code: "Alt + 0227", note: "ह्म, जैसे ब्रह्म" },
];

export function KrutiDevTutor({ keyboardRows, glyphKeys, fingers, lessons, wordSets, paragraphs }: Props) {
  const [step, setStep] = useState(0);
  const [lessonIdx, setLessonIdx] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);
  const [paraIdx, setParaIdx] = useState(0);

  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ seconds: number; errors: number; grossWpm: number; netWpm: number; accuracy: number } | null>(null);

  const [showKeyboard, setShowKeyboard] = useState(false);
  const [moveOnError, setMoveOnError] = useState(true);
  const [bold, setBold] = useState(false);
  const [sound, setSound] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [fontPx, setFontPx] = useState(30);
  const [altOpen, setAltOpen] = useState(false);
  const [backspaceEnabled, setBackspaceEnabled] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const caretElRef = useRef<HTMLSpanElement | null>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Same floating popup the real typing-test workspace opens its own
  // Settings from (TypingSettingsPopup, configurable-typing-exam.tsx) --
  // mirrors the English tutor's own Settings, which used to be an inline
  // panel that pushed the drill down.
  const closeSettings = (restoreFocus = false) => {
    setSettingsOpen(false);
    if (restoreFocus) window.setTimeout(() => settingsTriggerRef.current?.focus(), 0);
  };

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  };

  const fingerName = useCallback((finger: Finger) => fingers.find((f) => f.id === finger)?.hi ?? "", [fingers]);
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

  // physical-key lookup: legacy byte -> the key + finger that produces it.
  const reverse = useMemo(() => {
    const rows: Array<[string, { key: string; shift: boolean; finger: Finger }]> = [];
    for (const cap of glyphKeys) {
      if (cap.normal) rows.push([cap.normal, { key: cap.key, shift: false, finger: cap.finger }]);
      if (cap.shift) rows.push([cap.shift, { key: cap.key, shift: true, finger: cap.finger }]);
    }
    rows.push([" ", { key: "Space", shift: false, finger: "thumb" }]);
    return rows.sort((a, b) => b[0].length - a[0].length || Number(a[1].shift) - Number(b[1].shift));
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
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // reset whenever the active exercise or step changes
  useEffect(() => { reset(); }, [step, idx, reset]);

  const caret = typed.length;

  // Keeps the current position visible in the drill box as it advances --
  // real reported need for long paragraphs/word sets, where the
  // highlighted character can otherwise scroll out of the small box's
  // view, forcing a manual scroll mid-drill. Toggleable (Settings ->
  // Auto scroll) since some students prefer to scroll by hand.
  useEffect(() => {
    if (autoScroll) caretElRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [caret, autoScroll, idx, step]);

  const nextKey = useMemo(() => {
    const rest = target.slice(caret);
    if (!rest) return null;
    for (const [out, info] of reverse) if (out && rest.startsWith(out)) return info;
    const cp = rest.codePointAt(0) ?? 0;
    if (cp > 127) return { alt: `Alt + 0${cp}` } as const;
    return { rawKey: rest[0] } as const;
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

  const total = exercises.length;
  const kbdVisible = step !== 3 && showKeyboard;

  return (
    <main ref={rootRef} className={`bg-slate-100 ${isFullscreen ? "flex h-[100dvh] flex-col overflow-hidden" : "min-h-screen overflow-y-auto"}`} style={{ fontFamily: HI }}>
      {!isFullscreen && <TypingBrandHeader backHref="/typing/learn/hindi" backLabel="सभी हिन्दी पाठ" />}
      <section className={`mx-auto w-full max-w-6xl px-3 py-5 sm:px-5 ${isFullscreen ? "flex min-h-0 flex-1 flex-col" : ""}`}>
        {/* Step rail + badge/fullscreen controls -- back navigation now
            lives in the header itself (backHref/backLabel above), always
            in the same spot under the logo on every page. */}
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <StepRail step={step} onPick={setStep} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-orange-600 shadow-sm">कृतिदेव 010 · हिन्दी टंकण प्रशिक्षक</span>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-pressed={isFullscreen}
              title={isFullscreen ? "पूर्ण स्क्रीन बंद करें" : "पूर्ण स्क्रीन"}
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

        {step === 0 ? (
          <InstructionsStep
            keyboardRows={keyboardRows}
            fingers={fingers}
            fingerColor={fingerColor}
            onStart={() => setStep(1)}
          />
        ) : (
          <div className={`mt-5 space-y-4 ${isFullscreen ? "flex min-h-0 flex-1 flex-col" : ""}`}>
            <div className={`min-w-0 space-y-4 ${isFullscreen ? "flex min-h-0 flex-1 flex-col" : ""}`}>
              <div className={`rounded-2xl bg-white p-4 shadow-sm sm:p-5 ${isFullscreen ? "flex min-h-0 flex-1 flex-col" : ""}`}>
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-black text-slate-600 disabled:opacity-40">«</button>
                    <label className="text-sm font-bold text-slate-700">
                      <span className="sr-only">अभ्यास चुनें</span>
                      <select
                        value={idx}
                        onChange={(event) => setIdx(Number(event.target.value))}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold text-slate-800"
                      >
                        {exercises.map((item, position) => (
                          <option key={item.id} value={position}>{`अभ्यास ${position + 1}/${total} — ${item.title}`}</option>
                        ))}
                      </select>
                    </label>
                    <button type="button" onClick={() => setIdx(Math.min(total - 1, idx + 1))} disabled={idx >= total - 1} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-black text-slate-600 disabled:opacity-40">»</button>
                  </div>
                  <button
                    ref={settingsTriggerRef}
                    type="button"
                    aria-haspopup="dialog"
                    aria-expanded={settingsOpen}
                    aria-controls="typing-settings-dialog"
                    aria-label={settingsOpen ? "सेटिंग्स बंद करें" : "सेटिंग्स"}
                    title={settingsOpen ? "सेटिंग्स बंद करें" : "सेटिंग्स"}
                    onClick={() => setSettingsOpen((value) => !value)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  >
                    {settingsOpen ? (
                      <span aria-hidden className="text-base font-black leading-none">✕</span>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 13a7.7 7.7 0 0 0 0-2l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-1.7-1L15 3.6h-4l-.4 2.4a7.6 7.6 0 0 0-1.7 1l-2.3-.9-2 3.4L6.6 11a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9a7.6 7.6 0 0 0 1.7 1l.4 2.4h4l.4-2.4a7.6 7.6 0 0 0 1.7-1l2.3.9 2-3.4z" />
                      </svg>
                    )}
                  </button>
                  {settingsOpen && (
                    <TypingSettingsPopup triggerRef={settingsTriggerRef} onClose={closeSettings}>
                      <div className="space-y-3">
                        <Toggle checked={bold} onChange={setBold} label="बोल्ड अक्षर" />
                        {step !== 3 && <Toggle checked={showKeyboard} onChange={setShowKeyboard} label="कीबोर्ड दिखाएँ" />}
                        <Toggle checked={moveOnError} onChange={setMoveOnError} label="गलती पर आगे बढ़ें" />
                        <Toggle checked={sound} onChange={setSound} label="ध्वनि" />
                        <Toggle checked={autoScroll} onChange={setAutoScroll} label="ऑटो स्क्रॉल" />
                        <div className="flex items-center justify-between gap-3 text-sm font-bold text-slate-700">
                          <span>बैकस्पेस</span>
                          <BackspaceOption enabled={backspaceEnabled} onChange={setBackspaceEnabled} onLabel="बैकस्पेस चालू" offLabel="बैकस्पेस बंद" />
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm font-bold text-slate-700">
                          <span>फ़ॉन्ट आकार</span>
                          <span className="flex items-center gap-1">
                            <button type="button" onClick={() => setFontPx((value) => Math.max(18, value - 2))} className="rounded-md bg-slate-100 px-2 py-1 text-sm font-black text-slate-700">A−</button>
                            <span className="w-10 text-center">{fontPx}</span>
                            <button type="button" onClick={() => setFontPx((value) => Math.min(56, value + 2))} className="rounded-md bg-slate-100 px-2 py-1 text-sm font-black text-slate-700">A+</button>
                          </span>
                        </div>
                        <button type="button" onClick={() => setAltOpen(true)} className="w-full rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-black text-slate-700 hover:bg-slate-200">Alt कोड दिखाएँ</button>
                      </div>
                    </TypingSettingsPopup>
                  )}
                </div>

                {step === 3 && <p className="mt-3 shrink-0 rounded-lg bg-blue-50 p-2 text-xs font-bold text-blue-800">परीक्षा मोड — इस चरण में कीबोर्ड नहीं दिखता।</p>}

                <div
                  className={`mt-4 w-full max-w-full overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-amber-50/70 p-4 ring-1 ring-amber-100 ${isFullscreen ? "min-h-0 flex-1" : ""}`}
                  style={isFullscreen ? { fontFamily: KD, fontSize: `${fontPx}px`, lineHeight: 1.9, fontWeight: bold ? 700 : 400 } : { fontFamily: KD, fontSize: `${fontPx}px`, lineHeight: 1.9, fontWeight: bold ? 700 : 400, height: "clamp(14rem, 45vh, 34rem)" }}
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
                    return <span key={position} ref={state === "cur" ? caretElRef : undefined} className={cls}>{char === " " ? " " : char}</span>;
                  })}
                </div>

                <textarea
                  ref={inputRef}
                  value={typed}
                  onChange={(event) => handleChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Backspace") return;
                    if (!backspaceEnabled) event.preventDefault();
                  }}
                  onPaste={(event) => event.preventDefault()}
                  spellCheck={false}
                  autoFocus
                  aria-label="टाइपिंग क्षेत्र"
                  className={`mt-3 w-full max-w-full resize-y rounded-xl border-2 border-slate-200 p-3 outline-none focus:border-blue-500 ${isFullscreen ? "min-h-0 flex-1" : ""}`}
                  style={isFullscreen ? { fontFamily: KD, fontSize: `${fontPx}px`, lineHeight: 1.8, fontWeight: bold ? 700 : 400 } : { fontFamily: KD, fontSize: `${fontPx}px`, lineHeight: 1.8, fontWeight: bold ? 700 : 400, height: "clamp(14rem, 45vh, 34rem)" }}
                  placeholder="यहाँ टाइप करना शुरू करें…"
                />

                <div className="mt-3 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-bold text-slate-500">दबाएँ:</span>
                  {nextKey && "key" in nextKey ? (
                    <span className="font-black text-slate-900">
                      {nextKey.key === "Space"
                        ? "Space"
                        : nextKey.shift
                          ? `Shift + ${nextKey.key.toUpperCase()}`
                          : nextKey.key}
                      <span className="ml-2 font-bold text-slate-500">({fingerName(nextKey.finger)})</span>
                    </span>
                  ) : nextKey && "alt" in nextKey ? (
                    <span className="font-black text-orange-600">{nextKey.alt}</span>
                  ) : nextKey && "rawKey" in nextKey ? (
                    <span className="font-black text-slate-900">{nextKey.rawKey}</span>
                  ) : (
                    <span className="font-black text-emerald-600">पूरा हुआ ✓</span>
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

      {altOpen && <AltCodesModal onClose={() => setAltOpen(false)} />}
    </main>
  );
}

function StepRail({ step, onPick }: { step: number; onPick: (value: number) => void }) {
  return (
    <div className="flex items-stretch gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-sm sm:gap-2">
      {STEPS.map((item, position) => {
        const active = position === step;
        const doneStep = position < step;
        return (
          <button
            key={item.en}
            type="button"
            onClick={() => onPick(position)}
            className={`flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition sm:text-sm ${
              active ? "bg-orange-500 text-white shadow" : doneStep ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${active ? "bg-white/25" : doneStep ? "bg-emerald-200 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
              {doneStep ? "✓" : position + 1}
            </span>
            {item.hi}
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
        <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">हिन्दी टाइपिंग में अंगुलियों की सही स्थिति</h1>
        <p className="mt-2 text-slate-600">अपनी अंगुलियों को कीबोर्ड पर नीचे दिखाई गई तस्वीर के अनुसार रखें। बायें हाथ की अंगुलियाँ <b>S D F G</b> पर और दायें हाथ की अंगुलियाँ <b>J K L ;</b> पर टिकाएँ — कृतिदेव में बायीं ओर की A कुंजी उपयोग में नहीं आती। अंगूठे स्पेस-बार पर रहें।</p>

        <div className="mt-5 overflow-x-auto">
          <KeyboardDiagram keyboardRows={keyboardRows} fingerColor={fingerColor} activeKey={null} activeShift={false} />
        </div>

        <div className="mt-5">
          <div>
            <h2 className="text-sm font-black text-slate-800">अंगुली और रंग</h2>
            <ul className="mt-2 grid grid-cols-2 gap-1.5 text-sm font-bold text-slate-700 sm:grid-cols-3 lg:grid-cols-4">
              {fingers.map((finger) => (
                <li key={finger.id} className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full" style={{ background: finger.color }} />
                  {finger.hi}
                </li>
              ))}
            </ul>
            <h2 className="mt-4 text-sm font-black text-slate-800">कृतिदेव 010 कैसे काम करता है</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              कृतिदेव एक <b>फ़ॉन्ट-एन्कोडिंग</b> है — आप अंग्रेज़ी कुंजियाँ दबाते हैं और कृतिदेव फ़ॉन्ट उन्हें देवनागरी अक्षर बना देता है।
              जैसे <b>d → क</b>, <b>g → ह</b>, <b>j → र</b>, <b>k → ा</b>। अधिकांश अक्षर किसी भी कीबोर्ड पर काम करते हैं;
              आधे अक्षरों के लिए <b>Shift</b> दबाएँ (जैसे Shift + D → क्) और कुछ दुर्लभ चिह्नों के लिए <b>Alt कोड</b>।
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-base font-black text-white shadow-lg transition hover:brightness-105 sm:w-auto"
        >
          टाइपिंग सीखना शुरू करें →
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
                  <span className={`absolute left-1 top-0.5 text-[9px] font-bold ${isActive ? "text-slate-900" : "text-white/45"}`}>
                    {isGlyph ? cap.key.toUpperCase() : cap.key}
                  </span>
                  {isGlyph && cap.shift && cap.shift !== cap.normal && (
                    <span
                      className={`absolute right-1 top-0 text-[13px] leading-none ${isActive && activeShift ? "text-slate-900" : "text-white/50"}`}
                      style={{ fontFamily: KD }}
                    >
                      {cap.shift}
                    </span>
                  )}
                  {isGlyph ? (
                    <span className={`mt-1 text-lg leading-none ${isActive ? "text-slate-900" : "text-white"}`} style={{ fontFamily: KD }}>
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
        {passed ? "बहुत बढ़िया!" : "अभ्यास जारी रखें"}
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="शुद्ध गति" value={`${result.netWpm}`} />
        <Stat label="कुल गति" value={`${result.grossWpm}`} />
        <Stat label="शुद्धता" value={`${result.accuracy}%`} tone={passed ? "ok" : "bad"} />
        <Stat label="समय" value={`${result.seconds}s`} />
      </div>
      <p className="mt-2 text-sm font-bold text-slate-600">गलतियाँ: {result.errors}{isTest ? " · यह परीक्षा-शैली अभ्यास है।" : ""}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onRetry} className="rounded-lg bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm">फिर से</button>
        {hasNext && <button type="button" onClick={onNext} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white shadow-sm">अगला अभ्यास →</button>}
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
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-orange-500" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "left-4" : "left-0.5"}`} />
      </span>
    </label>
  );
}

// Real requested polish: the Backspace setting used to be an ordinary
// label + switch, no different from Bold/Sound/Move-on-error -- but
// disabling Backspace is a much bigger behavioural change (it locks the
// student into forward-only typing, the same as a real exam's backspace
// rule), so it gets its own pill-shaped button with a backspace glyph
// (⌫) instead, so its current state reads clearly at a glance.
function BackspaceOption({ enabled, onChange, onLabel, offLabel }: { enabled: boolean; onChange: (value: boolean) => void; onLabel: string; offLabel: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      aria-pressed={enabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-sm font-black transition ${enabled ? "border-orange-300 bg-orange-50 text-orange-700" : "border-slate-200 bg-white text-slate-400"}`}
    >
      <span aria-hidden className="text-base leading-none">⌫</span>
      {enabled ? onLabel : offLabel}
    </button>
  );
}

function AltCodesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900">Alt कोड</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <p className="mt-2 text-xs font-bold text-slate-500">
          कुछ चिह्न किसी कुंजी पर नहीं होते। <b>Alt</b> दबाकर संख्या-पैड से नीचे दिया कोड लिखें।
        </p>
        <ul className="mt-3 space-y-2">
          {ALT_CODES.map((item) => (
            <li key={item.code} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="text-2xl" style={{ fontFamily: HI }}>{item.glyph}</span>
              <span className="font-bold text-slate-600">{item.note}</span>
              <span className="font-black text-slate-900">{item.code}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">बाकी संयुक्त अक्षर (क्ष, त्र, ज्ञ, श्र) कुंजियों से ही बनते हैं — अभ्यास में संकेत मिलेगा।</p>
      </div>
    </div>
  );
}
