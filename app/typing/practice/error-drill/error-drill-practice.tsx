"use client";
import { useState } from "react";

// Real requested feature: after a typing/stenography test, a student
// wants to drill the specific words they got wrong -- copy the mistake
// words off their result page, paste them here, and practice each one
// across a chosen number of lines (classic typing-class drill sheet
// style: one word repeated across a line, several lines, then the next
// word). Deliberately a free-typing scratchpad, not a scored test -- no
// WPM/accuracy tracking, matching the explicit "just practice" request.
// A plain <textarea> (not a rich contentEditable surface) keeps this
// simple and robust; font family/size are just CSS on that textarea, the
// same fontStack values lib/typing-curriculum.ts's real input systems use
// so Kruti Dev bytes render through the correct licensed font.
type ScriptOption = { id: string; label: string; fontFamily: string };
const SCRIPT_OPTIONS: ScriptOption[] = [
  { id: "english", label: "English", fontFamily: "Arial, Helvetica, sans-serif" },
  { id: "hindi-unicode", label: "Hindi (Unicode)", fontFamily: '"Nirmala UI", Mangal, "Noto Sans Devanagari", sans-serif' },
  { id: "hindi-krutidev", label: "Hindi (Kruti Dev)", fontFamily: '"Kruti Dev 010", sans-serif' },
];
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 48;
const FONT_SIZE_STEP = 2;

function buildDrill(pastedText: string, linesPerWord: number, repeatsPerLine: number) {
  const words = pastedText.split(/[\s,]+/).map((word) => word.trim()).filter(Boolean);
  if (!words.length) return "";
  return words
    .map((word) => Array.from({ length: linesPerWord }, () => Array(repeatsPerLine).fill(word).join(" ")).join("\n"))
    .join("\n\n");
}

export function ErrorDrillPractice() {
  const [scriptId, setScriptId] = useState(SCRIPT_OPTIONS[0].id);
  const [fontSize, setFontSize] = useState(20);
  const [pastedText, setPastedText] = useState("");
  const [linesPerWord, setLinesPerWord] = useState(5);
  const [repeatsPerLine, setRepeatsPerLine] = useState(10);
  const [practiceText, setPracticeText] = useState("");

  const script = SCRIPT_OPTIONS.find((option) => option.id === scriptId) ?? SCRIPT_OPTIONS[0];

  function handleGenerate() {
    const drill = buildDrill(pastedText, linesPerWord, repeatsPerLine);
    if (!drill) return;
    setPracticeText((current) => (current ? `${current}\n\n${drill}` : drill));
  }

  return (
    <div className="mt-6 space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">1. Paste your error words</h2>
        <p className="mt-1 text-sm text-slate-600">Copy the words you got wrong from your result page and paste them below (any spacing works).</p>
        <textarea
          value={pastedText}
          onChange={(event) => setPastedText(event.target.value)}
          rows={3}
          placeholder="e.g. payments convenient through because"
          className="input mt-3 w-full font-mono text-sm"
        />
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="text-xs font-bold text-slate-600">
            Lines per word
            <input type="number" min={1} max={50} value={linesPerWord} onChange={(event) => setLinesPerWord(Math.min(50, Math.max(1, Number(event.target.value) || 1)))} className="input mt-1 block w-24" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Repeats per line
            <input type="number" min={1} max={50} value={repeatsPerLine} onChange={(event) => setRepeatsPerLine(Math.min(50, Math.max(1, Number(event.target.value) || 1)))} className="input mt-1 block w-24" />
          </label>
          <button type="button" onClick={handleGenerate} disabled={!pastedText.trim()} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
            Generate Practice Sheet
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">2. Practice</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Language / script" className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {SCRIPT_OPTIONS.map((option) => (
                <button key={option.id} type="button" role="tab" aria-selected={scriptId === option.id} onClick={() => setScriptId(option.id)} className={`rounded-lg px-3 py-1.5 text-xs font-black ${scriptId === option.id ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
              <button type="button" aria-label="Decrease font size" onClick={() => setFontSize((size) => Math.max(MIN_FONT_SIZE, size - FONT_SIZE_STEP))} className="rounded-lg px-2.5 py-1.5 text-sm font-black text-slate-700 hover:bg-white">A-</button>
              <span className="w-10 text-center text-xs font-bold text-slate-500">{fontSize}px</span>
              <button type="button" aria-label="Increase font size" onClick={() => setFontSize((size) => Math.min(MAX_FONT_SIZE, size + FONT_SIZE_STEP))} className="rounded-lg px-2.5 py-1.5 text-sm font-black text-slate-700 hover:bg-white">A+</button>
            </div>
            <button type="button" onClick={() => setPracticeText("")} disabled={!practiceText} className="rounded-lg px-3 py-1.5 text-xs font-black text-slate-500 hover:text-red-600 disabled:cursor-not-allowed disabled:text-slate-300">Clear</button>
          </div>
        </div>
        <textarea
          value={practiceText}
          onChange={(event) => setPracticeText(event.target.value)}
          placeholder="Your generated practice lines will appear here -- type freely, edit, or add more."
          style={{ fontFamily: script.fontFamily, fontSize: `${fontSize}px`, lineHeight: 1.8 }}
          className="mt-3 min-h-[360px] w-full resize-y rounded-xl border border-slate-300 p-4 focus:border-blue-500 focus:outline-none"
        />
      </section>
    </div>
  );
}
