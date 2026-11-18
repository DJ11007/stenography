"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { krutiDevToUnicode } from "@/lib/hindi-font-converter";

// Text-to-speech dictation maker that runs entirely in the admin's browser (Web Speech API), so it needs no
// account or key. Best in Microsoft Edge, whose "Online (Natural)" voices (e.g. Hindi Madhur / Swara, English India
// Prabhat / Neerja) sound close to a real person; Chrome offers Google voices.
//
// Timing works like a real dictator (measured from a recorded 5.8-minute legal dictation: speech filled ~62% of the
// time, pauses were short and even -- mostly 0.2-0.5 s, almost never over 1 s). The passage is split into small word
// groups (4 words by default, adjustable 1-6, always breaking at commas and full stops). The VOICE ITSELF is slowed or sped up so the
// speech fills ~62% of the time, and the rest becomes short gaps between groups (a bit longer at commas, longest at
// full stops). Speed and gaps are re-planned after every group from how long the voice actually took, so the
// dictation ends at the chosen total time. (Earlier it spoke 6 words at normal speed and then waited: fast bursts with
// long silences.)
//
// Recording: the browser can't save its own speech directly, and the voice is played by Windows' speech system, not
// by the page -- so "This tab" + "Share tab audio" records SILENCE (a 10-minute silent file was the result, 18 Nov
// 2026). "Record" therefore asks for the system sound: the admin picks "Entire screen" and ticks "Also share system
// audio". The result is saved as a WebM (and optionally WAV) file, which the stenography test upload accepts. A
// recording with no sound in it is reported instead of being offered for download.

type Phrase = { text: string; words: number; weight: number; start: number };
const SENTENCE_END = /[.!?।॥]["')\]]*$/u;
const CLAUSE_END = /[,;:—-]["')\]]*$/u;
// Share of the dictation time that is speech (the rest is the gaps), from the recorded human dictation.
const SPEECH_SHARE = 0.62;
// Gap limits in seconds. Longer gaps are only used when the voice is already at its slowest.
const MIN_GAP = 0.12, MAX_GAP = 1.6;
// Voice speed limits (SpeechSynthesisUtterance.rate). Above ~1.3 Edge's natural voices clip words (owner's report,
// 18 Nov 2026: "speaking so fast that words can't be heard, not speaking full words"); below ~0.6 they drag.
const MIN_RATE = 0.6, MAX_RATE = 1.3;
// Above this WPM a synthetic voice can't stay clear at a human-like pace (shown as a warning).
const CLEAR_WPM_LIMIT = 110;

function splitPhrases(text: string, groupWords: number): Phrase[] {
  const words = text.replace(/\s+/gu, " ").trim().split(" ").filter(Boolean);
  const phrases: Phrase[] = [];
  let current: string[] = [];
  let start = 0;
  words.forEach((word, index) => {
    current.push(word);
    const sentence = SENTENCE_END.test(word), clause = CLAUSE_END.test(word);
    if (sentence || clause || current.length >= groupWords || index === words.length - 1) {
      phrases.push({ text: current.join(" "), words: current.length, weight: sentence ? 2.5 : clause ? 1.6 : 1, start });
      start += current.length;
      current = [];
    }
  });
  return phrases;
}

// Turns the recorded WebM into a WAV file (16-bit mono, 22.05 kHz), which every phone, PC and media player can play.
async function webmToWav(blob: Blob): Promise<Blob> {
  const decoded = await new AudioContext().decodeAudioData(await blob.arrayBuffer());
  const sampleRate = 22050;
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * sampleRate), sampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded; source.connect(offline.destination); source.start();
  const samples = (await offline.startRendering()).getChannelData(0);
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (at: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i)); };
  text(0, "RIFF"); view.setUint32(4, 36 + samples.length * 2, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  return new Blob([view], { type: "audio/wav" });
}

// True when a recording is (practically) silent. If it can't be decoded, it is not called silent.
async function isSilent(blob: Blob): Promise<boolean> {
  try {
    const decoded = await new AudioContext().decodeAudioData(await blob.arrayBuffer());
    let peak = 0;
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
      const data = decoded.getChannelData(channel);
      for (let i = 0; i < data.length; i += 7) { const level = Math.abs(data[i]); if (level > peak) peak = level; }
    }
    return peak < 0.002;
  } catch {
    return false;
  }
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
  // Fine-tune on top of the automatic speed: above 1 = words a little quicker with longer gaps, below 1 = slower words.
  const [rate, setRate] = useState(1);
  // 4 words per group: Edge's natural voices pause 0.3-1 s before every group while they are fetched, so very small
  // groups (the recorded human used 1-2 words) leave too little time for clear speech.
  const [groupWords, setGroupWords] = useState(4);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [state, setState] = useState<"idle" | "playing" | "recording">("idle");
  const [progress, setProgress] = useState({ elapsed: 0, word: 0 });
  const [file, setFile] = useState<{ url: string; name: string; seconds: number; blob: Blob } | null>(null);
  const [wav, setWav] = useState<{ url: string; name: string } | null>(null);
  const [converting, setConverting] = useState(false);
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
  const phrases = useMemo(() => splitPhrases(spokenText, groupWords), [spokenText, groupWords]);
  const words = phrases.reduce((sum, phrase) => sum + phrase.words, 0);
  const targetSeconds = timing === "minutes" ? (Number(minutes) || 0) * 60 : words && Number(wpm) ? (words / Number(wpm)) * 60 : 0;
  const effectiveWpm = targetSeconds > 0 ? Math.round((words / targetSeconds) * 60) : 0;

  // Speaks one group and reports, in seconds, the silent start-up delay before the sound began (Edge's natural voices
  // are fetched online, often 0.3-1 s per group) and how long the voice actually spoke.
  const speakPhrase = (phrase: string, voice: SpeechSynthesisVoice | undefined, speed: number) => new Promise<{ delay: number; speech: number }>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(phrase);
    if (voice) { utterance.voice = voice; utterance.lang = voice.lang; } else utterance.lang = language === "Hindi" ? "hi-IN" : "en-IN";
    utterance.rate = speed; utterance.pitch = pitch; utterance.volume = volume;
    const asked = performance.now();
    let started = 0;
    utterance.onstart = () => { started = performance.now(); };
    const done = () => { const end = performance.now(); const from = started || asked; resolve({ delay: (from - asked) / 1000, speech: (end - from) / 1000 }); };
    utterance.onend = done;
    utterance.onerror = done;
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
    // How long this voice takes per word at speed 1.0 (seconds). Starts from a typical value and is then measured.
    let perWordAtOne = language === "Hindi" ? 0.42 : 0.36;
    // The voice's own silent start-up delay before each group (counted as part of that group's pause, not as speech).
    let startDelay = 0;
    let measured = false, spokenWords = 0;
    const clampRate = (value: number) => Math.min(MAX_RATE, Math.max(MIN_RATE, value));
    // Speed for the rest: speech gets ~62% of the time left, but never so much that the start-up delays plus short
    // pauses no longer fit -- then the rest of the time is speech, still capped at MAX_RATE so words stay complete.
    const speedFor = (secondsLeft: number, wordsLeft: number, groupsLeft: number) => {
      const pausesAtLeast = groupsLeft * Math.max(startDelay, MIN_GAP);
      const speechBudget = Math.max(wordsLeft * 0.15, Math.min(secondsLeft * SPEECH_SHARE, secondsLeft - pausesAtLeast));
      return clampRate((perWordAtOne / (speechBudget / wordsLeft)) * rate);
    };
    for (let index = 0; index < phrases.length; index++) {
      if (stopRef.current) break;
      const phrase = phrases[index];
      const elapsedBefore = (performance.now() - begin) / 1000;
      setProgress({ elapsed: elapsedBefore, word: phrase.start });
      const speed = speedFor(Math.max(1, targetSeconds - elapsedBefore), words - spokenWords, phrases.length - index);
      const { delay, speech } = await speakPhrase(phrase.text, voice, speed);
      spokenWords += phrase.words;
      // Learn the voice's real pace (speaking time only, per word at speed 1.0) and its start-up delay, smoothed so
      // one odd group doesn't swing them.
      const sample = (speech / phrase.words) * speed;
      perWordAtOne = measured ? perWordAtOne * 0.75 + sample * 0.25 : sample;
      startDelay = measured ? startDelay * 0.75 + delay * 0.25 : delay;
      measured = true;
      if (index === phrases.length - 1 || stopRef.current) break;
      // The pause: time left minus the speech still to come, shared out over the remaining pauses (longer at commas
      // and full stops). The next group's start-up delay is already silence, so only the rest is waited out here.
      const elapsed = (performance.now() - begin) / 1000;
      const remainingWords = words - spokenWords;
      const nextSpeed = speedFor(Math.max(1, targetSeconds - elapsed), remainingWords, phrases.length - index - 1);
      const remainingSpeech = (perWordAtOne / nextSpeed) * remainingWords;
      const remainingWeight = phrases.slice(index, phrases.length - 1).reduce((sum, item) => sum + item.weight, 0) || 1;
      const freeTime = targetSeconds - elapsed - remainingSpeech;
      const voiceAtSlowest = nextSpeed <= MIN_RATE + 0.001;
      const pause = Math.max(MIN_GAP, Math.min((freeTime * phrase.weight) / remainingWeight, voiceAtSlowest ? 6 : MAX_GAP * (phrase.weight / 2.5 + 0.4)));
      await wait(Math.max(0, pause - startDelay) * 1000);
    }
    const total = (performance.now() - begin) / 1000;
    setProgress({ elapsed: total, word: words });
    return total;
  }, [languageVoices, voiceName, phrases, words, rate, targetSeconds, pitch, volume, language]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setError(""); setFile(null); setWav(null);
    let stream: MediaStream;
    try {
      // Chrome/Edge on Windows: pick "Entire screen" and tick "Also share system audio" -- the voice is Windows' own
      // sound, so only system audio contains it. Video is required by the browser but not used.
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, systemAudio: "include", selfBrowserSurface: "include", monitorTypeSurfaces: "include" } as DisplayMediaStreamOptions);
    } catch {
      setError("Recording needs permission to capture the computer's sound. Press Record again, choose \"Entire screen\" and tick \"Also share system audio\".");
      return;
    }
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) {
      stream.getTracks().forEach((track) => track.stop());
      setError("No sound was shared. Press Record again, choose \"Entire screen\" and tick \"Also share system audio\" at the bottom of that window.");
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
    // A recording with no sound (the voice wasn't part of what was shared) must not be offered as a dictation.
    if (await isSilent(blob)) {
      setError("The recording has no sound in it. The voice is played by Windows, so it is only recorded when you choose \"Entire screen\" and tick \"Also share system audio\" (not \"This tab\"). Please press Record again and choose that.");
      return;
    }
    const safe = (title.trim() || "dictation").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
    setFile({ url: URL.createObjectURL(blob), name: `${safe}-${effectiveWpm}wpm.webm`, seconds, blob });
  };
  useEffect(() => () => { if (file) URL.revokeObjectURL(file.url); }, [file]);
  useEffect(() => () => { if (wav) URL.revokeObjectURL(wav.url); }, [wav]);
  const makeWav = async () => {
    if (!file) return;
    setConverting(true); setError("");
    try {
      const out = await webmToWav(file.blob);
      setWav({ url: URL.createObjectURL(out), name: file.name.replace(/\.webm$/, ".wav") });
    } catch {
      setError("Could not make the WAV file in this browser. The WebM download above still works.");
    } finally { setConverting(false); }
  };

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
          <p className="rounded-lg bg-violet-50 p-2 text-xs leading-5 text-violet-900">The voice speed is set automatically from the dictation time, so it speaks in an even flow with short gaps, like a real dictator.</p>
          <Slider label="Words per group" value={groupWords} min={1} max={6} step={1} onChange={setGroupWords} display={`${groupWords} word${groupWords === 1 ? "" : "s"}`} disabled={busy} />
          <Slider label="Voice speed adjust" value={rate} min={0.8} max={1.2} step={0.05} onChange={setRate} display={rate === 1 ? "auto" : `${rate > 1 ? "+" : ""}${Math.round((rate - 1) * 100)}%`} disabled={busy} />
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
          {effectiveWpm > CLEAR_WPM_LIMIT && (
            <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900">
              {words} words in {mmss(targetSeconds)} is {effectiveWpm} WPM — too fast for a clear computer voice; words may sound rushed. For a clear dictation give it at least {Math.ceil(words / CLEAR_WPM_LIMIT)} minutes (or split the matter into two parts).
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-5 shadow">
          {busy && <p className="text-center font-mono text-3xl font-black text-violet-800">{mmss(progress.elapsed)} <span className="text-base text-slate-400">/ {mmss(targetSeconds)}</span></p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={play} disabled={!ready || busy} className="rounded-xl border-2 border-violet-600 px-3 py-2.5 font-black text-violet-700 disabled:opacity-40">▶ Listen</button>
            <button type="button" onClick={stop} disabled={!busy} className="rounded-xl border-2 border-slate-300 px-3 py-2.5 font-black text-slate-700 disabled:opacity-40">■ Stop</button>
          </div>
          <button type="button" onClick={record} disabled={!ready || busy} className="w-full rounded-xl bg-rose-600 px-4 py-3 font-black text-white disabled:opacity-40">● Record &amp; download audio file</button>
          <p className="text-xs leading-5 text-slate-500"><b>▶ Listen</b> only plays the dictation. To get a file, press <b>● Record</b>: when the browser asks what to share, choose <b>“Entire screen”</b> and tick <b>“Also share system audio”</b> (not “This tab” — the voice is Windows&apos; own sound, so a tab recording comes out silent). Don&apos;t play any other sound on the computer until it finishes; then the download buttons appear below.</p>
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-800">{error}</p>}
          {file && (
            <div className="space-y-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-bold text-emerald-900">Recorded: {mmss(file.seconds)} long</p>
              <audio controls src={file.url} className="w-full" />
              <a href={file.url} download={file.name} className="block rounded-lg bg-emerald-700 px-4 py-2 text-center font-black text-white">⬇ Download WebM (small, for uploading)</a>
              {wav ? (
                <a href={wav.url} download={wav.name} className="block rounded-lg bg-violet-700 px-4 py-2 text-center font-black text-white">⬇ Download WAV (plays on any phone / PC)</a>
              ) : (
                <button type="button" onClick={makeWav} disabled={converting} className="block w-full rounded-lg border-2 border-violet-700 px-4 py-2 text-center font-black text-violet-800 disabled:opacity-50">{converting ? "Making WAV…" : "Make WAV file (plays everywhere)"}</button>
              )}
              <p className="text-xs text-emerald-900">Upload the WebM (or WAV) file as the test&apos;s audio in Stenography Tests, or keep the WAV for students to play anywhere.</p>
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
