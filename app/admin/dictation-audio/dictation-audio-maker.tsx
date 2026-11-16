"use client";

import { useEffect, useState } from "react";

type Voice = { id: string; label: string; language: "Hindi" | "English" };
const field = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900";

export function DictationAudioMaker({ voices, ready }: { voices: Voice[]; ready: boolean }) {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(voices[0]?.id ?? "");
  const [encoding, setEncoding] = useState<"unicode" | "krutidev">("unicode");
  const [wpm, setWpm] = useState("80");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; words: number; seconds: number; target: number } | null>(null);
  const hindi = voices.find((item) => item.id === voice)?.language === "Hindi";
  const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
  const speed = Number(wpm) || 0;
  const minutes = speed > 0 ? words / speed : 0;

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const make = async () => {
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/admin/dictation-audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, wpm: speed, encoding: hindi ? encoding : "unicode" }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: `Error ${response.status}` }));
        throw new Error(data.error ?? `Error ${response.status}`);
      }
      const blob = await response.blob();
      setResult({ url: URL.createObjectURL(blob), words: Number(response.headers.get("X-Dictation-Words")), seconds: Number(response.headers.get("X-Dictation-Seconds")), target: Number(response.headers.get("X-Dictation-Target-Seconds")) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Audio could not be made.");
    } finally {
      setBusy(false);
    }
  };

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
  const fileName = `${(title.trim() || "dictation").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "")}-${speed}wpm.mp3`;

  return (
    <section className="mt-6 space-y-5 rounded-2xl bg-white p-6 shadow">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Name (for the file)<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Legal-44" className={field} /></label>
        <label className="text-sm font-semibold text-slate-700">Voice<select value={voice} onChange={(e) => setVoice(e.target.value)} className={field}>{voices.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Dictation speed (WPM)<input inputMode="numeric" value={wpm} onChange={(e) => setWpm(e.target.value)} className={field} /></label>
        {hindi && (
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">The Hindi passage below is typed in
            <select value={encoding} onChange={(e) => setEncoding(e.target.value as "unicode" | "krutidev")} className={field}>
              <option value="unicode">Normal Hindi (Unicode / Mangal)</option>
              <option value="krutidev">Kruti Dev 010 — it will be converted for the voice automatically</option>
            </select>
          </label>
        )}
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Passage
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} className={field} placeholder="Paste the dictation passage here…" />
        </label>
      </div>
      <p className="text-sm text-slate-600">{words} words{speed > 0 && words > 0 ? ` at ${speed} WPM = ${mmss(minutes * 60)} of dictation` : ""}</p>
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}
      <button type="button" disabled={!ready || busy || words < 5 || speed < 30 || speed > 200} onClick={make} className="rounded-xl bg-violet-700 px-6 py-3 font-black text-white disabled:opacity-50">
        {busy ? "Making the audio… (can take a minute)" : "🎙 Make dictation audio"}
      </button>
      {result && (
        <div className="space-y-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-bold text-emerald-900">Ready: {result.words} words · {mmss(result.seconds)} long (target {mmss(result.target)} for {speed} WPM)</p>
          <audio controls src={result.url} className="w-full" />
          <a href={result.url} download={fileName} className="inline-block rounded-xl bg-emerald-700 px-5 py-2.5 font-black text-white">⬇ Download {fileName}</a>
          <p className="text-xs text-emerald-900">Next: open the test in Stenography Tests and upload this file as its audio.</p>
        </div>
      )}
    </section>
  );
}
