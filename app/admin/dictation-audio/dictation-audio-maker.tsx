"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { krutiDevToUnicode } from "@/lib/hindi-font-converter";

// Text-to-speech dictation maker that runs entirely in the admin's browser (Web Speech API), so it needs no
// account or key. Best in Microsoft Edge, whose "Online (Natural)" voices (e.g. Hindi Madhur / Swara, English India
// Prabhat / Neerja) sound close to a real person; Chrome offers Google voices.
//
// Timing: the passage is split into phrases (at full stops, commas, and every few words). Each phrase is spoken at
// the chosen voice speed; after each one the remaining time is re-planned from how long speech has actually taken
// so far, and that time is put into the pauses (longest at sentence ends) -- so the whole dictation ends at the
// chosen total time, the way a real dictator keeps to a speed.
//
// Recording: the browser can't save its own speech directly, so "Record" captures THIS tab's sound (the admin picks
// "This tab" and ticks "Share tab audio" when asked) and saves it as a WebM audio file, which the stenography test
// upload accepts.

type Phrase = { text: string; words: number; weight: number; start: number };
const SENTENCE_END = /[.!?।॥]["')\]]*$/u;
const CLAUSE_END = /[,;:—-]["')\]]*$/u;
const PHRASE_WORDS = 6;

function splitPhrases(text: string): Phrase[] {
  const words = text.replace(/\s+/gu, " ").trim().split(" ").filter(Boolean);
  const phrases: Phrase[] = [];
  let current: string[] = [];
  let start = 0;
  words.forEach((word, index) => {
    current.push(word);
    const sentence = SENTENCE_END.test(word), clause = CLAUSE_END.test(word);
    if (sentence || clause || current.length >= PHRASE_WORDS || index === words.length - 1) {
      phrases.push({ text: current.join(" "), words: current.length, weight: sentence ? 3 : clause ? 2 : 1, start });
      start += current.length;
      current = [];
    }
  });
  return phrases;
}

const mmss = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}`;
const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900";

export function DictationAudioMaker() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [language, setLanguage] = useState<"Hindi" | "English">("Hindi");
  const [voiceName, setVoiceName] = useState("");
  const [encoding, setEncoding] = useState<"unicode" | "krutidev">("unicode");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [timing, setTiming] = useState<"minutes" | "wpm">("minutes");
  const [minutes, setMinutes] = useState("8");
  const [wpm, setWpm] = useState("80");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [state, setState] = useState<"idle" | "playing" | "recording">("idle");
  const [progress, setProgress] = useState({ elapsed: 0, word: 0 });
  const [file, setFile] = useState<{ url: string; name: string; seconds: number } | null>(null);
  const [error, setError] = useState("");
  const stopRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Known only in the browser (the server can't tell), so it starts as "checking".
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => { setSupported("speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"); }, []);
  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  const languageVoices = useMemo(() => {
    const code = language === "Hindi" ? "hi" : "en";
    return voices
      .filter((voice) => voice.lang.toLowerCase().startsWith(code))
      .sort((a, b) => Number(/natural|online/i.test(b.name)) - Number(/natural|online/i.test(a.name)) || Number(/IN/i.test(b.lang)) - Number(/IN/i.test(a.lang)) || a.name.localeCompare(b.name));
  }, [voices, language]);
  useEffect(() => { if (!languageVoices.some((voice) => voice.name === voiceName)) setVoiceName(languageVoices[0]?.name ?? ""); }, [languageVoices, voiceName]);

  const spokenText = language === "Hindi" && encoding === "krutidev" ? krutiDevToUnicode(text) : text;
  const phrases = useMemo(() => splitPhrases(spokenText), [spokenText]);
  const words = phrases.reduce((sum, phrase) => sum + phrase.words, 0);
  const targetSeconds = timing === "minutes" ? (Number(minutes) || 0) * 60 : words && Number(wpm) ? (words / Number(wpm)) * 60 : 0;
  const effectiveWpm = targetSeconds > 0 ? Math.round((words / targetSeconds) * 60) : 0;

  const speakPhrase = (phrase: string, voice: SpeechSynthesisVoice | undefined, speed: number) => new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(phrase);
    if (voice) { utterance.voice = voice; utterance.lang = voice.lang; } else utterance.lang = language === "Hindi" ? "hi-IN" : "en-IN";
    utterance.rate = speed; utterance.pitch = pitch; utterance.volume = volume;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
  const wait = (ms: number) => new Promise<void>((resolve) => {
    const until = performance.now() + ms;
    const tick = () => { if (stopRef.current || performance.now() >= until) resolve(); else window.setTimeout(tick, Math.min(100, until - performance.now())); };
    tick();
  });

  // Speaks the whole dictation so it ends at targetSeconds. Returns the real length in seconds.
  const runDictation = useCallback(async () => {
    const voice = languageVoices.find((item) => item.name === voiceName);
    window.speechSynthesis.cancel();
    stopRef.current = false;
    const begin = performance.now();
    let speechSeconds = 0, spokenWords = 0, speed = rate;
    for (let index = 0; index < phrases.length; index++) {
      if (stopRef.current) break;
      const phrase = phrases[index];
      setProgress({ elapsed: (performance.now() - begin) / 1000, word: phrase.start });
      const t0 = performance.now();
      await speakPhrase(phrase.text, voice, speed);
      speechSeconds += (performance.now() - t0) / 1000;
      spokenWords += phrase.words;
      if (index === phrases.length - 1 || stopRef.current) break;
      // Re-plan: time left, minus the speech still to come (at the pace measured so far), goes into the pauses.
      const elapsed = (performance.now() - begin) / 1000;
      const secondsPerWord = speechSeconds / spokenWords;
      const remainingWords = words - spokenWords;
      const remainingSpeech = secondsPerWord * remainingWords;
      const remainingWeight = phrases.slice(index, phrases.length - 1).reduce((sum, item) => sum + item.weight, 0) || 1;
      const freeTime = targetSeconds - elapsed - remainingSpeech;
      if (freeTime < 0 && speed < 1.6) speed = Math.min(1.6, speed * 1.05); // running late even without pauses: speak a little faster
      const pause = Math.max(0.08, (freeTime * phrase.weight) / remainingWeight);
      await wait(Math.min(pause, 8) * 1000);
    }
    const total = (performance.now() - begin) / 1000;
    setProgress({ elapsed: total, word: words });
    return total;
  }, [languageVoices, voiceName, phrases, words, rate, targetSeconds, pitch, volume]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = supported && words >= 5 && targetSeconds >= 30;
  const play = async () => {
    setError(""); setState("playing");
    try { await runDictation(); } finally { setState("idle"); }
  };
  const stop = () => {
    stopRef.current = true;
    window.speechSynthesis.cancel();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const record = async () => {
    setError(""); setFile(null);
    let stream: MediaStream;
    try {
      // Chrome/Edge: pick "This tab" and tick "Share tab audio". Video is required by the browser but not used.
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, preferCurrentTab: true, selfBrowserSurface: "include", systemAudio: "include" } as DisplayMediaStreamOptions);
    } catch {
      setError("Recording needs permission to capture this tab's sound. Press Record again and choose \"This tab\", with \"Share tab audio\" ticked.");
      return;
    }
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) {
      stream.getTracks().forEach((track) => track.stop());
      setError("No sound was shared. Press Record again, choose \"This tab\" and tick \"Share tab audio\".");
      return;
    }
    stream.getVideoTracks().forEach((track) => track.stop());
    streamRef.current = stream;
    const recorder = new MediaRecorder(new MediaStream(audioTracks), { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm", audioBitsPerSecond: 64000 });
    recorderRef.current = recorder;
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    const finished = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
    recorder.start(1000);
    setState("recording");
    await new Promise((resolve) => window.setTimeout(resolve, 600)); // let the recorder settle before the first word
    const seconds = await runDictation();
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    if (recorder.state === "recording") recorder.stop();
    await finished;
    audioTracks.forEach((track) => track.stop());
    setState("idle");
    if (stopRef.current) { setError("Recording stopped before the end, so nothing was saved."); return; }
    const blob = new Blob(chunks, { type: "audio/webm" });
    const safe = (title.trim() || "dictation").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
    setFile({ url: URL.createObjectURL(blob), name: `${safe}-${effectiveWpm}wpm.webm`, seconds });
  };
  useEffect(() => () => { if (file) URL.revokeObjectURL(file.url); }, [file]);

  const wordsList = useMemo(() => spokenText.replace(/\s+/gu, " ").trim().split(" ").filter(Boolean), [spokenText]);
  const busy = state !== "idle";

  if (supported === null) return <p className="mt-6 rounded-2xl bg-white p-5 text-slate-500 shadow">Loading voices…</p>;
  if (!supported) return <p className="mt-6 rounded-2xl bg-rose-50 p-5 font-bold text-rose-800">This browser has no text-to-speech. Please open this page in Microsoft Edge or Google Chrome on a computer.</p>;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="space-y-4 rounded-2xl bg-white p-5 shadow sm:p-6">
        <label className="block text-sm font-semibold text-slate-700">Name (for the file)<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Legal-44" className={field} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">Language
            <select value={language} onChange={(e) => setLanguage(e.target.value as "Hindi" | "English")} className={field}><option>Hindi</option><option>English</option></select>
          </label>
          {language === "Hindi" && (
            <label className="block text-sm font-semibold text-slate-700">Matter is typed in
              <select value={encoding} onChange={(e) => setEncoding(e.target.value as "unicode" | "krutidev")} className={field}>
                <option value="unicode">Normal Hindi (Unicode / Mangal)</option>
                <option value="krutidev">Kruti Dev 010 (converted for the voice)</option>
              </select>
            </label>
          )}
        </div>
        <label className="block text-sm font-semibold text-slate-700">Dictation matter
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} disabled={busy} className={field} placeholder="Paste the dictation matter here…" style={language === "Hindi" && encoding === "krutidev" ? { fontFamily: '"Kruti Dev 010", sans-serif', fontSize: 20 } : undefined} />
        </label>
        {busy && words > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm leading-7 text-slate-800" aria-live="off">
            {wordsList.map((word, index) => <span key={index} className={index === progress.word ? "rounded bg-yellow-300 px-0.5" : index < progress.word ? "text-slate-400" : ""}>{word} </span>)}
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <section className="space-y-4 rounded-2xl bg-white p-5 shadow">
          <h2 className="text-sm font-black uppercase tracking-wider text-violet-700">Voice</h2>
          <label className="block text-sm font-semibold text-slate-700">Speaker
            <select value={voiceName} onChange={(e) => setVoiceName(e.target.value)} disabled={busy} className={field}>
              {languageVoices.length === 0 && <option value="">No {language} voice in this browser</option>}
              {languageVoices.map((voice) => <option key={voice.name} value={voice.name}>{voice.name.replace(/^Microsoft /, "").replace(/ - .*$/, "")}{/natural/i.test(voice.name) ? " ★" : ""}</option>)}
            </select>
          </label>
          {languageVoices.length === 0 && <p className="text-xs font-bold text-amber-800">Open this page in Microsoft Edge for natural Hindi and English (India) voices.</p>}
          <Slider label="Voice speed" value={rate} min={0.6} max={1.4} step={0.05} onChange={setRate} display={`${rate.toFixed(2)}×`} disabled={busy} />
          <Slider label="Pitch" value={pitch} min={0.6} max={1.4} step={0.05} onChange={setPitch} display={pitch.toFixed(2)} disabled={busy} />
          <Slider label="Volume" value={volume} min={0.2} max={1} step={0.05} onChange={setVolume} display={`${Math.round(volume * 100)}%`} disabled={busy} />
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-5 shadow">
          <h2 className="text-sm font-black uppercase tracking-wider text-violet-700">⏱ Dictation timer</h2>
          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <button type="button" disabled={busy} onClick={() => setTiming("minutes")} className={`rounded-lg border px-2 py-2 ${timing === "minutes" ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-slate-50"}`}>Finish in a set time</button>
            <button type="button" disabled={busy} onClick={() => setTiming("wpm")} className={`rounded-lg border px-2 py-2 ${timing === "wpm" ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-slate-50"}`}>Set a WPM speed</button>
          </div>
          {timing === "minutes" ? (
            <label className="block text-sm font-semibold text-slate-700">Total dictation time (minutes)
              <input type="number" min={0.5} max={60} step={0.5} value={minutes} disabled={busy} onChange={(e) => setMinutes(e.target.value)} className={field} />
              <span className="mt-2 flex flex-wrap gap-1.5">{[4, 5, 6, 7, 8, 9, 10].map((m) => <button key={m} type="button" disabled={busy} onClick={() => setMinutes(String(m))} className={`rounded-full px-2.5 py-1 text-xs font-bold ${Number(minutes) === m ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-700"}`}>{m} min</button>)}</span>
            </label>
          ) : (
            <label className="block text-sm font-semibold text-slate-700">Dictation speed (WPM)
              <input type="number" min={30} max={200} value={wpm} disabled={busy} onChange={(e) => setWpm(e.target.value)} className={field} />
            </label>
          )}
          <p className="rounded-lg bg-violet-50 p-3 text-sm font-bold text-violet-900">{words} words · {mmss(targetSeconds)} total{effectiveWpm ? ` · ${effectiveWpm} WPM` : ""}</p>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-5 shadow">
          {busy && <p className="text-center font-mono text-3xl font-black text-violet-800">{mmss(progress.elapsed)} <span className="text-base text-slate-400">/ {mmss(targetSeconds)}</span></p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={play} disabled={!ready || busy} className="rounded-xl border-2 border-violet-600 px-3 py-2.5 font-black text-violet-700 disabled:opacity-40">▶ Listen</button>
            <button type="button" onClick={stop} disabled={!busy} className="rounded-xl border-2 border-slate-300 px-3 py-2.5 font-black text-slate-700 disabled:opacity-40">■ Stop</button>
          </div>
          <button type="button" onClick={record} disabled={!ready || busy} className="w-full rounded-xl bg-rose-600 px-4 py-3 font-black text-white disabled:opacity-40">● Record &amp; save audio file</button>
          <p className="text-xs leading-5 text-slate-500">When the browser asks, choose <b>“This tab”</b> and tick <b>“Share tab audio”</b>. Keep this tab open and don&apos;t play other sounds until it finishes.</p>
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-800">{error}</p>}
          {file && (
            <div className="space-y-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-bold text-emerald-900">Recorded: {mmss(file.seconds)} long</p>
              <audio controls src={file.url} className="w-full" />
              <a href={file.url} download={file.name} className="block rounded-lg bg-emerald-700 px-4 py-2 text-center font-black text-white">⬇ Download {file.name}</a>
              <p className="text-xs text-emerald-900">Then upload this file as the test&apos;s audio in Stenography Tests.</p>
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}

function Slider({ label, value, min, max, step, display, disabled, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; disabled?: boolean; onChange: (value: number) => void }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      <span className="flex justify-between">{label}<span className="text-violet-700">{display}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-violet-600" />
    </label>
  );
}
