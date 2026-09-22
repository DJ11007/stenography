"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateTypingScore, type TypingScore } from "@/lib/typing-test";
import { DEMO_ENGLISH_PASSAGE, DEMO_HINDI_KRUTIDEV_PASSAGE } from "@/lib/homepage-typing-demo-content";
import { GLYPH_KEYS as ENGLISH_GLYPH_KEYS, KEYBOARD_ROWS as ENGLISH_KEYBOARD_ROWS, FINGER_COLORS as ENGLISH_FINGER_COLORS, type Finger } from "@/lib/english-tutor-content";
import { GLYPH_KEYS as KRUTIDEV_GLYPH_KEYS, KEYBOARD_ROWS as KRUTIDEV_KEYBOARD_ROWS, FINGER_COLORS as KRUTIDEV_FINGER_COLORS } from "@/lib/krutidev-tutor-content";
import { KeyboardDiagram } from "./keyboard-diagram";

const KD_FONT = '"Kruti Dev 010", "Nirmala UI", sans-serif';
const MONO_FONT = 'ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace';

// Purely decorative background flair -- a scattered mix of large, faint,
// colorful English letters and Kruti Dev glyph keys (single consonant
// bytes, not real words, so there's nothing here for a student to
// mis-learn) sitting behind the actual demo card. Fixed, hardcoded
// positions/rotations rather than Math.random() so a client-rendered
// component never risks a different layout between renders.
const BACKGROUND_KEYCAPS: { char: string; kd?: boolean; top: string; left: string; size: string; rotate: number; color: string }[] = [
  { char: "A", top: "6%", left: "8%", size: "5rem", rotate: -12, color: "#22d3ee" },
  { char: "d", kd: true, top: "14%", left: "82%", size: "6rem", rotate: 10, color: "#a78bfa" },
  { char: "K", top: "68%", left: "4%", size: "4.5rem", rotate: 8, color: "#fb923c" },
  { char: "g", kd: true, top: "78%", left: "90%", size: "5.5rem", rotate: -8, color: "#4ade80" },
  { char: "S", top: "40%", left: "94%", size: "4rem", rotate: 15, color: "#f472b6" },
  { char: "j", kd: true, top: "4%", left: "45%", size: "4rem", rotate: -6, color: "#38bdf8" },
  { char: "T", top: "85%", left: "35%", size: "5rem", rotate: 6, color: "#facc15" },
  { char: "l", kd: true, top: "55%", left: "18%", size: "4.5rem", rotate: 14, color: "#f87171" },
  { char: "E", top: "22%", left: "2%", size: "3.5rem", rotate: -10, color: "#2dd4bf" },
  { char: "v", kd: true, top: "90%", left: "65%", size: "4rem", rotate: -14, color: "#c084fc" },
  { char: "R", top: "8%", left: "65%", size: "3.5rem", rotate: 12, color: "#34d399" },
  { char: "s", kd: true, top: "48%", left: "55%", size: "3.5rem", rotate: -4, color: "#fbbf24" },
];

function BackgroundKeyboardDecoration() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.12]">
      {BACKGROUND_KEYCAPS.map((cap, i) => (
        <span
          key={i}
          className="absolute font-black leading-none"
          style={{
            top: cap.top,
            left: cap.left,
            fontSize: cap.size,
            color: cap.color,
            transform: `rotate(${cap.rotate}deg)`,
            fontFamily: cap.kd ? KD_FONT : MONO_FONT,
          }}
        >
          {cap.char}
        </span>
      ))}
    </div>
  );
}

type Language = "english" | "hindi-krutidev";
type Phase = "setup" | "running" | "done";
const DURATIONS = [1, 5, 10] as const;

// This entire component is deliberately public: no import from @/lib/auth,
// no server action, no persistence -- a genuinely anonymous visitor can
// use it end to end, and nothing here reads or shows any signed-in state.
// It reuses calculateTypingScore (lib/typing-test.ts) directly so the
// Gross/Net WPM figures shown here are computed exactly the same way the
// real typing tests compute them.
export function HomepageTypingDemo() {
  const [language, setLanguage] = useState<Language>("english");
  const [durationMinutes, setDurationMinutes] = useState<(typeof DURATIONS)[number]>(1);
  const [phase, setPhase] = useState<Phase>("setup");
  const [typedText, setTypedText] = useState("");
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(60);
  const [score, setScore] = useState<TypingScore | null>(null);
  const endTimestampRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const passage = language === "english" ? DEMO_ENGLISH_PASSAGE : DEMO_HINDI_KRUTIDEV_PASSAGE;
  const fontFamily = language === "hindi-krutidev" ? KD_FONT : MONO_FONT;
  const keyboardRows = language === "english" ? ENGLISH_KEYBOARD_ROWS : KRUTIDEV_KEYBOARD_ROWS;
  const glyphKeys = language === "english" ? ENGLISH_GLYPH_KEYS : KRUTIDEV_GLYPH_KEYS;
  const fingerColors = language === "english" ? ENGLISH_FINGER_COLORS : KRUTIDEV_FINGER_COLORS;

  const finish = useCallback(() => {
    setPhase((current) => {
      if (current !== "running") return current;
      const elapsedSeconds = Math.max(1, durationMinutes * 60 - timeLeftSeconds);
      setScore((prevScore) => prevScore ?? calculateTypingScore({
        typedText,
        passage,
        elapsedSeconds,
        wordMethod: "characters",
        includeUntypedWords: true,
      }));
      return "done";
    });
  }, [durationMinutes, timeLeftSeconds, typedText, passage]);

  useEffect(() => {
    if (phase !== "running") return;
    const timer = window.setInterval(() => {
      const end = endTimestampRef.current;
      if (!end) return;
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      setTimeLeftSeconds(left);
      if (left <= 0) finish();
    }, 250);
    return () => window.clearInterval(timer);
  }, [phase, finish]);

  useEffect(() => {
    if (phase === "running") textareaRef.current?.focus();
  }, [phase]);

  const start = () => {
    setTypedText("");
    setScore(null);
    setTimeLeftSeconds(durationMinutes * 60);
    endTimestampRef.current = Date.now() + durationMinutes * 60_000;
    setPhase("running");
  };

  const tryAgain = () => {
    setPhase("setup");
    setTypedText("");
    setScore(null);
  };

  // Same array + startsWith-prefix-match technique the Kruti Dev tutor
  // uses (a strict superset of the English tutor's simpler single-
  // character Map -- prefix matching over 1-character entries behaves
  // identically to an exact lookup) so one lookup works for both scripts,
  // since one Kruti Dev key can emit a multi-byte legacy sequence for a
  // matra/conjunct that a plain character-by-character map can't express.
  const lookup = useMemo(() => {
    const rows: Array<[string, { key: string; shift: boolean; finger: Finger }]> = [];
    for (const cap of glyphKeys) {
      if (cap.normal) rows.push([cap.normal, { key: cap.key, shift: false, finger: cap.finger }]);
      if (cap.shift && cap.shift !== cap.normal) rows.push([cap.shift, { key: cap.key, shift: true, finger: cap.finger }]);
    }
    rows.push([" ", { key: " ", shift: false, finger: "thumb" }]);
    return rows.sort((a, b) => b[0].length - a[0].length);
  }, [glyphKeys]);

  const nextKeyHint = useMemo(() => {
    if (phase !== "running") return null;
    const rest = passage.slice(typedText.length);
    if (!rest) return null;
    for (const [out, info] of lookup) if (out && rest.startsWith(out)) return info;
    return null;
  }, [phase, passage, typedText, lookup]);

  const handleTyped = (value: string) => {
    if (phase !== "running" || value.length > passage.length) return;
    setTypedText(value);
    if (value.length >= passage.length) finish();
  };

  return (
    <section id="try-free-typing-test" className="relative overflow-hidden bg-slate-950 px-6 py-16 text-white">
      <BackgroundKeyboardDecoration />
      <div className="relative z-10 mx-auto max-w-5xl">
        <span className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-cyan-300">
          Speed Evaluation
        </span>
        <h2 className="mt-4 bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
          Try a Free Typing Test
        </h2>
        <p className="mt-2 max-w-2xl text-white/70">
          No sign-up needed. Pick a duration, type, and see your Gross and Net WPM instantly -- the exact same formula our real typing tests use.
        </p>

        {phase === "setup" && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-black uppercase tracking-wide text-white/50">Language</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setLanguage("english")} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black transition ${language === "english" ? "bg-cyan-400 text-slate-950" : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"}`}>
                English
              </button>
              <button type="button" onClick={() => setLanguage("hindi-krutidev")} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black transition ${language === "hindi-krutidev" ? "bg-cyan-400 text-slate-950" : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"}`}>
                <span style={{ fontFamily: KD_FONT }}>fganh</span> (Kruti Dev)
              </button>
            </div>

            <p className="mt-5 text-xs font-black uppercase tracking-wide text-white/50">Duration</p>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {DURATIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setDurationMinutes(minutes)}
                  className={`rounded-2xl border p-4 text-center transition ${durationMinutes === minutes ? "border-cyan-400 bg-cyan-400/10 text-cyan-200" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"}`}
                >
                  <span className="block text-2xl font-black">{minutes}</span>
                  <span className="text-xs font-bold uppercase tracking-wide">min</span>
                </button>
              ))}
            </div>

            <button type="button" onClick={start} className="mt-6 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-violet-400 px-5 py-3 text-base font-black text-slate-950 shadow-lg transition hover:brightness-105 sm:w-auto">
              Start Free Test →
            </button>
          </div>
        )}

        {phase === "running" && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between text-sm font-black">
              <span className="rounded-full bg-white/10 px-3 py-1 text-cyan-300">⏱ {String(Math.floor(timeLeftSeconds / 60)).padStart(2, "0")}:{String(timeLeftSeconds % 60).padStart(2, "0")}</span>
              <button type="button" onClick={finish} className="rounded-full border border-white/20 px-3 py-1 text-xs font-bold text-white/70 hover:bg-white/10">Finish now</button>
            </div>

            <div aria-hidden className="mt-4 max-h-40 overflow-y-auto rounded-2xl bg-slate-900 p-4 text-lg leading-8 tracking-wide" style={{ fontFamily }}>
              {/* Only the passage's own text is ever rendered character-by-
                  character (a real typing surface, same technique the real
                  product's typing workspaces already use at this scale) --
                  capped generously above what even a very fast typist could
                  reach within the longest (10 min) demo, purely to avoid
                  building thousands of span elements for text nobody will
                  ever see or type. */}
              {[...passage.slice(0, 4000)].map((ch, i) => {
                const cls = i < typedText.length
                  ? (typedText[i] === ch ? "text-emerald-400" : "rounded bg-rose-500/40 text-rose-200")
                  : i === typedText.length
                    ? "rounded bg-cyan-400/60 text-slate-950"
                    : "text-white/40";
                return <span key={i} className={cls}>{ch === " " ? " " : ch}</span>;
              })}
            </div>

            <textarea
              ref={textareaRef}
              value={typedText}
              onChange={(event) => handleTyped(event.target.value)}
              onPaste={(event) => event.preventDefault()}
              spellCheck={false}
              autoFocus
              aria-label="Type the passage above"
              style={{ fontFamily }}
              className="mt-3 min-h-24 w-full resize-none rounded-2xl border-2 border-white/10 bg-slate-900 p-4 text-lg text-white outline-none focus:border-cyan-400"
              placeholder="Start typing here…"
            />

            <div className="mt-4 overflow-x-auto">
              <KeyboardDiagram
                keyboardRows={keyboardRows}
                fingerColor={(finger) => fingerColors[finger]}
                activeKey={nextKeyHint?.key ?? null}
                activeShift={Boolean(nextKeyHint?.shift)}
                fontFamily={fontFamily}
                compact
              />
            </div>
          </div>
        )}

        {phase === "done" && score && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                <p className="text-xs font-black uppercase tracking-wide text-white/50">Gross Speed</p>
                <p className="mt-1 text-3xl font-black text-cyan-300">{score.grossWpm} <span className="text-sm font-bold text-white/50">WPM</span></p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                <p className="text-xs font-black uppercase tracking-wide text-white/50">Net Speed</p>
                <p className="mt-1 text-3xl font-black text-violet-300">{score.netWpm} <span className="text-sm font-bold text-white/50">WPM</span></p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                <p className="text-xs font-black uppercase tracking-wide text-white/50">Accuracy</p>
                <p className="mt-1 text-3xl font-black text-emerald-300">{score.accuracy}<span className="text-sm font-bold text-white/50">%</span></p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={tryAgain} className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-black text-white hover:bg-white/10">Try again</button>
              <Link href="/signup" className="rounded-xl bg-gradient-to-r from-cyan-400 to-violet-400 px-5 py-2.5 text-sm font-black text-slate-950 hover:brightness-105">Sign up to save your results →</Link>
              <Link href="/typing" className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-black text-white/80 hover:bg-white/10">Take the full typing test →</Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
