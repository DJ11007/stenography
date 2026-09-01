"use client";

import { useEffect, useRef, useState } from "react";
import type { ExamPreset } from "@/lib/typing-curriculum";
import { ALL_HALF_ERROR_CATEGORIES, HALF_ERROR_CATEGORY_LABELS, type HalfErrorCategory } from "@/lib/typing-test";
import { TypingBrandHeader } from "./typing-brand";

const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export const DICTATION_SPEEDS = [
  { value: 0.5, label: "Half 0.5×" },
  { value: 0.7, label: "-30%" },
  { value: 0.8, label: "-20%" },
  { value: 0.85, label: "-15%" },
  { value: 0.9, label: "-10%" },
  { value: 0.95, label: "-05%" },
  { value: 1, label: "Original" },
  { value: 1.05, label: "+05%" },
  { value: 1.1, label: "+10%" },
  { value: 1.15, label: "+15%" },
  { value: 1.2, label: "+20%" },
  { value: 1.3, label: "+30%" },
  { value: 2, label: "Double 2×" },
];

// The pre-typing "dictation" phase of a stenography test: play the audio
// (with speed control, matching a real dictation drill), pick which finer
// mistake categories should be graded, then unlock typing once the audio
// has been played through to the end at least once. The reference passage
// is never rendered anywhere on this screen -- this is a real dictation,
// not copy-typing. Rendered as a full page (same weight as ExamStart)
// rather than an overlay, specifically so the typing textarea underneath
// genuinely doesn't exist in the DOM until Start Typing is clicked.
export function DictationGate({ preset, url, selectedCategories, onCategoriesChange, onStartTyping }: {
  preset: ExamPreset;
  url: string;
  selectedCategories: HalfErrorCategory[];
  onCategoriesChange: (next: HalfErrorCategory[]) => void;
  onStartTyping: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playedThrough, setPlayedThrough] = useState(false);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
    (audio as HTMLAudioElement & { preservesPitch?: boolean; mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean }).preservesPitch = true;
    (audio as HTMLAudioElement & { mozPreservesPitch?: boolean }).mozPreservesPitch = true;
    (audio as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
  }, [speed]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play(); else audio.pause();
  };
  const seek = (fraction: number) => { const audio = audioRef.current; if (audio && duration) audio.currentTime = fraction * duration; };

  // capitalization is meaningless for Hindi (Devanagari has no case);
  // halant (viram) is meaningless for English (a Latin-script concept has
  // no such thing) -- each is only ever offered for the language it
  // actually applies to. On top of that language filter, the admin can
  // narrow which categories are offered at all for this specific test
  // (preset.dictationCategories.available) -- undefined means "not
  // configured", which falls back to offering everything, same as before
  // this was ever admin-controllable.
  const languageAppropriate = ALL_HALF_ERROR_CATEGORIES.filter((category) => preset.language === "English" ? category !== "halant" : category !== "capitalization");
  const availableCategories = preset.dictationCategories ? languageAppropriate.filter((category) => preset.dictationCategories!.available.includes(category)) : languageAppropriate;
  // Comma is the punctuation mark that actually matters in Hindi
  // dictation -- relabeling the existing punctuation checkbox for Hindi
  // tests is simpler and clearer than adding a whole separate category
  // that would only ever catch commas anyway.
  const categoryLabel = (category: HalfErrorCategory) => category === "punctuation" && preset.language !== "English" ? "Comma Count" : HALF_ERROR_CATEGORY_LABELS[category];
  const toggle = (category: HalfErrorCategory) => onCategoriesChange(selectedCategories.includes(category) ? selectedCategories.filter((item) => item !== category) : [...selectedCategories, category]);

  return <main className="min-h-screen bg-slate-100">
    <TypingBrandHeader/>
    <section className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-3xl bg-white p-6 shadow-xl sm:p-10">
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">Dictation phase</span>
        <h1 className="mt-5 text-3xl font-black text-slate-900">Listen to the dictation</h1>
        <p className="mt-2 text-slate-600">Play the audio at whichever speed suits you. The passage will not be shown on screen — this is a real dictation, not copy-typing. Listen all the way to the end before typing can begin.</p>

        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onEnded={() => { setPlaying(false); setPlayedThrough(true); }}
          onError={() => setAudioError(true)}
        />
        <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl bg-slate-50 p-6">
          <button type="button" onClick={togglePlay} aria-label={playing ? "Pause dictation" : "Play dictation"} className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-700 text-2xl text-white shadow-lg hover:bg-blue-800">{playing ? "⏸" : "▶"}</button>
          <div className="flex w-full max-w-md items-center gap-3">
            <span className="w-12 text-right text-xs font-black text-slate-500">{formatTime(current)}</span>
            <input type="range" min={0} max={1} step={0.001} value={duration ? current / duration : 0} onChange={(event) => seek(Number(event.target.value))} className="flex-1" aria-label="Seek dictation audio"/>
            <span className="w-12 text-xs font-black text-slate-500">{formatTime(duration)}</span>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
            Speed
            <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="input py-1.5">
              {DICTATION_SPEEDS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          {playedThrough && <p role="status" className="text-xs font-bold text-green-700">✓ Dictation complete — you can listen again, or start typing when ready.</p>}
        </div>
        {audioError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 font-bold text-red-800">The dictation audio could not be loaded. Please refresh the page; if this keeps happening, contact your administrator.</p>}

        <fieldset className="mt-8">
          <legend className="mb-2 text-sm font-black text-slate-900">Which mistakes should be graded in this attempt?</legend>
          <p className="mb-3 text-xs text-slate-500">Wrong, missing, extra, and repeated words are always graded. Choose which of these finer details should also count as mistakes.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {availableCategories.map((category) => <label key={category} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-800">
              <input type="checkbox" checked={selectedCategories.includes(category)} onChange={() => toggle(category)}/>
              {categoryLabel(category)}
            </label>)}
          </div>
        </fieldset>

        <button type="button" disabled={!playedThrough} onClick={onStartTyping} className="mt-8 w-full rounded-xl bg-green-600 py-4 text-lg font-black text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-400">
          {playedThrough ? "Start Typing" : "Listen to the full dictation to continue"}
        </button>
      </div>
    </section>
  </main>;
}
