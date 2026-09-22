"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toTypeableKrutiDev } from "@/lib/hindi-font-converter";
import { getVerifiedHindiCommonKeys, checkKrutiDevKeystrokes, countKeystrokeDiff } from "@/lib/kruti-dev-word-bank";
import { CATEGORIES, type WordtrisCategory, type WordtrisLanguage } from "@/lib/wordtris-content";
import { SPEEDRACE_WORDS_PER_RACE, SPEEDRACE_DEFAULT_PACE_WPM, SPEEDRACE_MIN_PACE_WPM, SPEEDRACE_MAX_PACE_WPM, SPEEDRACE_BOOSTS_PER_RACE, buildSpeedRacePassage, speedRaceProgressAtElapsed, speedRaceNetWpm, speedRaceAccuracy } from "@/lib/speedrace-content";
import type { SpeedRacePassage } from "@/lib/speedrace-passages-server";
import { GAME_ROOM_POLL_MS, GAME_ROOM_PROGRESS_PUSH_MS, gameRoomPodiumMessage, gameRoomPodiumTone, type GameRoomParticipant } from "@/lib/game-rooms";
import { joinGameRoom, getMyJoinedRoom, getGameRoomStatus, updateGameRoomProgress, submitGameRoomResult, listGameRoomParticipants } from "../_multiplayer/actions";
import { TypingBrandHeader } from "../../_components/typing-brand";

const HI = '"Nirmala UI", "Noto Sans Devanagari", system-ui, sans-serif';
const KD = '"Kruti Dev 010", "Nirmala UI", sans-serif';

// A pool-built passage from the word bank is always available and is
// what "Random word mix" selects -- represented by this sentinel rather
// than a real passage id, since it has none.
const RANDOM_MIX = "random-mix";

type Step = "setup" | "lobby" | "racing" | "finished";
type Props = {
  words: Record<WordtrisLanguage, Record<WordtrisCategory, string[]>>;
  // Real reported request: an admin wants to author real Speed Race
  // passages and let students choose among them, per language, instead
  // of every race being an auto-generated word mix. Empty for a
  // language nobody has published any for yet -- the existing
  // auto-generated behavior is unchanged in that case.
  passagesByLanguage: Record<WordtrisLanguage, SpeedRacePassage[]>;
};
type FinishStats = { wpm: number; accuracy: number; timeMs: number; isNewBest: boolean };
type RoomConfig = { language: WordtrisLanguage; category: WordtrisCategory; paceWpm: number; passage: string };
type JoinedRoom = { id: string; code: string; config: RoomConfig; studentId: string };

// The live race clock ticks on this schedule while racing -- independent
// of typing itself -- so the pace car and personal-best ghost keep moving
// in real time even while the student is reading ahead, not typing.
const TRACK_TICK_MS = 100;

function Racetrack({ label, progress, marker, tone }: { label: string; progress: number; marker: string; tone: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
      <div className="relative h-2.5 flex-1 rounded-full bg-slate-200">
        <span aria-hidden="true" className="absolute -right-0.5 -top-2.5 text-base">🏁</span>
        <div
          aria-hidden="true"
          className={`absolute -top-3.5 flex h-7 w-7 items-center justify-center rounded-full text-sm shadow-md transition-[left] duration-100 ease-linear ${tone}`}
          style={{ left: `calc(${Math.min(100, progress * 100)}% - 14px)` }}
        >
          {marker}
        </div>
      </div>
    </div>
  );
}

export function SpeedRaceGame({ words, passagesByLanguage }: Props) {
  const [step, setStep] = useState<Step>("setup");
  const [language, setLanguage] = useState<WordtrisLanguage>("english");
  const [category, setCategory] = useState<WordtrisCategory>("easy_words");
  const [paceWpm, setPaceWpm] = useState(SPEEDRACE_DEFAULT_PACE_WPM);
  // Which admin-authored passage (by id) or RANDOM_MIX the student has
  // picked for their next race -- defaults to whichever the current
  // language actually has: the admin's first published passage if any
  // exist, otherwise the random word mix.
  const [selectedPassageId, setSelectedPassageId] = useState<string>(RANDOM_MIX);
  const availablePassages = passagesByLanguage[language] ?? [];

  // Only re-picks a default when the language itself changes -- switching
  // category shouldn't reset an already-made passage choice, and
  // availablePassages is already a pure function of language + the
  // passagesByLanguage prop (stable after the initial page load).
  useEffect(() => {
    setSelectedPassageId(availablePassages[0]?.id ?? RANDOM_MIX);
  }, [language]);

  const [passage, setPassage] = useState("");
  const [typed, setTyped] = useState("");
  const [boostsLeft, setBoostsLeft] = useState(SPEEDRACE_BOOSTS_PER_RACE);
  const [boostFlash, setBoostFlash] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finishStats, setFinishStats] = useState<FinishStats | null>(null);
  const [personalBest, setPersonalBest] = useState<number | null>(null);

  // Live Classroom Race: a teacher hosts a room (see
  // app/admin/live-race) and shares a short code; joining here forces the
  // same passage/pace for everyone and layers a live, polling leaderboard
  // and a gold/silver/bronze podium on top of the exact same race screen
  // solo play already uses.
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [room, setRoom] = useState<JoinedRoom | null>(null);
  const [lobbyParticipants, setLobbyParticipants] = useState<GameRoomParticipant[]>([]);
  const [raceParticipants, setRaceParticipants] = useState<GameRoomParticipant[]>([]);
  const [finalParticipants, setFinalParticipants] = useState<GameRoomParticipant[] | null>(null);

  const startedAtRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fontFamily = language === "hindi" ? KD : undefined;
  const bestKey = `speedrace-best-${language}-${category}`;

  // Real bug fixed here: a Hindi passage (auto word-mix, an admin-authored
  // one, or one a live-race host built) was always stored/typed as real
  // Unicode text, but rendered with the Kruti Dev 010 font and then
  // compared character-by-character against the student's raw legacy
  // keystrokes below -- Kruti Dev 010 is a legacy encoding font, not a
  // Unicode Devanagari font, so it never actually drew real Unicode text
  // correctly, and a legacy keystroke could never equal a Unicode
  // character anyway. Convert right before it becomes what the student
  // sees/types. "common" category words use the verified sequence from
  // lib/kruti-dev-word-bank.ts; anything else (another category's words,
  // or free-form admin/host passage text) falls back to the same
  // well-tested live converter used everywhere else in this app.
  const buildHindiWordTarget = useCallback((raw: string, cat: WordtrisCategory) => {
    const verified = cat === "common" ? getVerifiedHindiCommonKeys(raw) : undefined;
    if (verified) return verified;
    try { return toTypeableKrutiDev(raw); } catch { return raw; }
  }, []);
  const toRaceableText = useCallback((text: string, lang: WordtrisLanguage) => {
    if (lang !== "hindi") return text;
    try { return toTypeableKrutiDev(text); } catch { return text; }
  }, []);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(bestKey));
      setPersonalBest(Number.isFinite(v) && v > 0 ? v : null);
    } catch { setPersonalBest(null); }
  }, [bestKey]);

  // Recovers an in-progress joined room after a page refresh, the same
  // resilience get_my_hosted_room gives the host dashboard.
  useEffect(() => {
    (async () => {
      const joined = await getMyJoinedRoom();
      if (!joined) return;
      const cfg = joined.config as unknown as RoomConfig;
      setRoom({ id: joined.id, code: joined.code, config: cfg, studentId: joined.student_id });
      if (joined.status === "racing") {
        setLanguage(cfg.language);
        setCategory(cfg.category);
        setPaceWpm(cfg.paceWpm);
        setPassage(toRaceableText(cfg.passage, cfg.language));
        startedAtRef.current = Date.now();
        setStep("racing");
      } else {
        setStep("lobby");
      }
    })();
  }, [toRaceableText]);

  // CORRECTNESS = EXACT KRUTI DEV 010 (or plain ASCII, for English) KEY
  // SEQUENCE -- see lib/kruti-dev-word-bank.ts. `currentPassage` here is
  // already the raceable target built by toRaceableText/buildHindiWordTarget
  // above, never the raw Unicode/display text, so this is a raw keystroke
  // comparison, not a rendered-glyph one.
  const finishRace = useCallback((finalTyped: string, currentPassage: string) => {
    const timeMs = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    const { correct } = countKeystrokeDiff(finalTyped, currentPassage);
    const wpm = Math.round(speedRaceNetWpm(correct, timeMs));
    const accuracy = speedRaceAccuracy(correct, finalTyped.length);

    if (room) {
      void submitGameRoomResult(room.id, wpm, wpm, accuracy);
      setFinishStats({ wpm, accuracy, timeMs, isNewBest: false });
      setStep("finished");
      return;
    }

    let isNewBest = false;
    try {
      const prev = Number(localStorage.getItem(bestKey)) || 0;
      if (wpm > prev) {
        localStorage.setItem(bestKey, String(wpm));
        setPersonalBest(wpm);
        isNewBest = true;
      }
    } catch { /* private browsing / storage disabled -- personal best just won't persist */ }
    setFinishStats({ wpm, accuracy, timeMs, isNewBest });
    setStep("finished");
  }, [bestKey, room]);

  const startRace = useCallback(() => {
    const chosen = availablePassages.find((p) => p.id === selectedPassageId);
    const nextPassage = chosen
      ? toRaceableText(chosen.passage, language)
      : buildSpeedRacePassage(
          language === "hindi"
            ? (words[language]?.[category] ?? []).map((w) => buildHindiWordTarget(w, category))
            : (words[language]?.[category] ?? []),
        );
    setPassage(nextPassage);
    setTyped("");
    setBoostsLeft(SPEEDRACE_BOOSTS_PER_RACE);
    setElapsedMs(0);
    setFinishStats(null);
    startedAtRef.current = null;
    setStep("racing");
  }, [words, language, category, availablePassages, selectedPassageId, toRaceableText, buildHindiWordTarget]);

  const handleJoin = async () => {
    const trimmed = joinCode.trim().toUpperCase();
    if (!trimmed) return;
    setJoinError(null);
    const result = await joinGameRoom(trimmed);
    if ("error" in result) { setJoinError(result.error); return; }
    const cfg = result.config as unknown as RoomConfig;
    setRoom({ id: result.id, code: trimmed, config: cfg, studentId: result.student_id });
    setLobbyParticipants([]);
    setStep("lobby");
  };

  const leaveLobby = () => {
    setRoom(null);
    setJoinCode("");
    setJoinError(null);
    setStep("setup");
  };

  const backToSolo = () => {
    setRoom(null);
    setFinalParticipants(null);
    setStep("setup");
  };

  // Waiting room: polls the roster and watches for the host starting the
  // race, at which point everyone jumps into the identical passage/pace
  // the host configured (see room.config), never their own picker.
  useEffect(() => {
    if (step !== "lobby" || !room) return;
    let cancelled = false;
    const tick = async () => {
      const [rows, status] = await Promise.all([listGameRoomParticipants(room.id), getGameRoomStatus(room.id)]);
      if (cancelled) return;
      setLobbyParticipants(rows);
      if (status === "racing") {
        const cfg = room.config;
        setLanguage(cfg.language);
        setCategory(cfg.category);
        setPaceWpm(cfg.paceWpm);
        setPassage(toRaceableText(cfg.passage, cfg.language));
        setTyped("");
        setBoostsLeft(SPEEDRACE_BOOSTS_PER_RACE);
        setElapsedMs(0);
        setFinishStats(null);
        startedAtRef.current = null;
        setStep("racing");
      }
    };
    tick();
    const timer = window.setInterval(tick, GAME_ROOM_POLL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [step, room, toRaceableText]);

  useEffect(() => {
    if (step !== "racing") return;
    const timer = window.setInterval(() => {
      if (startedAtRef.current) setElapsedMs(Date.now() - startedAtRef.current);
    }, TRACK_TICK_MS);
    return () => window.clearInterval(timer);
  }, [step]);

  useEffect(() => {
    if (step === "racing") requestAnimationFrame(() => inputRef.current?.focus());
  }, [step]);

  const handleTyped = (value: string) => {
    if (step !== "racing") return;
    if (!startedAtRef.current && value.length > 0) startedAtRef.current = Date.now();
    const clipped = value.length > passage.length ? value.slice(0, passage.length) : value;
    setTyped(clipped);
    if (passage.length > 0 && clipped.length >= passage.length) finishRace(clipped, passage);
  };

  // One boost per race -- instantly completes whichever word the student
  // is currently stuck on, the same "spend a one-time resource to skip a
  // hard word" idea real typing-race games use (see lib/speedrace-content.ts).
  const useBoost = () => {
    if (boostsLeft <= 0 || step !== "racing") return;
    if (!startedAtRef.current) startedAtRef.current = Date.now();
    let end = passage.indexOf(" ", typed.length);
    end = end === -1 ? passage.length : end + 1;
    const next = passage.slice(0, end);
    setTyped(next);
    setBoostsLeft((b) => b - 1);
    setBoostFlash(true);
    window.setTimeout(() => setBoostFlash(false), 400);
    if (next.length >= passage.length) finishRace(next, passage);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    useBoost();
  };

  // Live HUD figures while racing -- finishStats holds the frozen final
  // numbers once the race actually ends. keystrokeChecks is the same
  // position-by-position raw-keystroke comparison the passage below is
  // colored from (lib/kruti-dev-word-bank.ts) -- one shared source for
  // both the live WPM/accuracy figures and the error highlighting, so
  // they can never disagree with each other.
  const keystrokeChecks = checkKrutiDevKeystrokes(typed, passage);
  const { correct: liveCorrect } = countKeystrokeDiff(typed, passage);
  const liveWpm = Math.round(speedRaceNetWpm(liveCorrect, elapsedMs || 1));
  const liveAccuracy = speedRaceAccuracy(liveCorrect, typed.length);

  const youProgress = passage.length ? typed.length / passage.length : 0;
  const paceProgress = speedRaceProgressAtElapsed(paceWpm, elapsedMs, passage.length);
  const ghostProgress = personalBest ? speedRaceProgressAtElapsed(personalBest, elapsedMs, passage.length) : 0;

  // Kept current every render (not inside an effect) so the stable
  // progress-push interval below always reads fresh values without
  // having to tear itself down and restart on every keystroke -- which
  // would otherwise mean it (almost) never actually fires while typing.
  const liveStateRef = useRef({ typed: "", passage: "", liveWpm: 0 });
  liveStateRef.current = { typed, passage, liveWpm };

  useEffect(() => {
    if (step !== "racing" || !room) return;
    const timer = window.setInterval(() => {
      const { typed: t, passage: p, liveWpm: w } = liveStateRef.current;
      const progress = p.length ? (t.length / p.length) * 100 : 0;
      void updateGameRoomProgress(room.id, progress, w);
    }, GAME_ROOM_PROGRESS_PUSH_MS);
    return () => window.clearInterval(timer);
  }, [step, room]);

  useEffect(() => {
    if (step !== "racing" || !room) return;
    const tick = () => { listGameRoomParticipants(room.id).then(setRaceParticipants); };
    tick();
    const timer = window.setInterval(tick, GAME_ROOM_POLL_MS);
    return () => window.clearInterval(timer);
  }, [step, room]);

  // Polls until the teacher ends the race (finish_game_room), then loads
  // the final, ranked results for the podium screen.
  useEffect(() => {
    if (step !== "finished" || !room || finalParticipants) return;
    let cancelled = false;
    const tick = async () => {
      const status = await getGameRoomStatus(room.id);
      if (cancelled || status !== "finished") return;
      const rows = await listGameRoomParticipants(room.id);
      if (!cancelled) setFinalParticipants(rows);
    };
    tick();
    const timer = window.setInterval(tick, GAME_ROOM_POLL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [step, room, finalParticipants]);

  const displayCategories = CATEGORIES;
  const myFinalRow = room && finalParticipants ? finalParticipants.find((p) => p.student_id === room.studentId) ?? null : null;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <TypingBrandHeader backHref="/typing/games" backLabel="Games" />
      <section className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-amber-400 shadow-sm">
            🏁 Speed Race
          </span>
        </div>

        {step === "setup" && (
          <>
            <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="bg-slate-900 px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="text-2xl">🏎️</span>
                  <h1 className="text-2xl font-black text-white">Speed Race</h1>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">Type a full passage as fast and accurately as you can -- your car advances as you go. Race against a pace car set to a real WPM, and against a ghost of your own personal best. One boost per race instantly finishes whatever word you're stuck on (press Tab).</p>
              </div>
              <div className="p-6">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Language</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => setLanguage("english")} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${language === "english" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>English</button>
                  <button type="button" onClick={() => setLanguage("hindi")} style={{ fontFamily: HI }} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${language === "hindi" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>हिन्दी</button>
                </div>

                <p className="mt-5 text-xs font-black uppercase tracking-wider text-slate-500">Category</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {displayCategories.map((cat) => (
                    <button key={cat.id} type="button" onClick={() => setCategory(cat.id)} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${category === cat.id ? "bg-amber-50 text-amber-800 ring-2 ring-amber-600" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`} style={{ fontFamily: language === "hindi" ? HI : undefined }}>
                      {language === "hindi" ? cat.hi : cat.en}
                    </button>
                  ))}
                </div>

                {/* Real reported request: an admin wants to write real
                    passages and let students choose among them, instead of
                    every race silently auto-building from the category's
                    word bank. Only shown once at least one has been
                    published for this language (/admin/speedrace-passages)
                    -- otherwise this section doesn't appear at all, and
                    behavior is exactly what it always was. */}
                {availablePassages.length > 0 && (
                  <>
                    <p className="mt-5 text-xs font-black uppercase tracking-wider text-slate-500">Passage</p>
                    <div className="mt-2 space-y-1.5">
                      <button type="button" onClick={() => setSelectedPassageId(RANDOM_MIX)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-bold transition ${selectedPassageId === RANDOM_MIX ? "bg-amber-50 text-amber-800 ring-2 ring-amber-600" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
                        🎲 Random word mix <span className="font-normal text-slate-500">(uses the category below)</span>
                      </button>
                      {availablePassages.map((p) => (
                        <button key={p.id} type="button" onClick={() => setSelectedPassageId(p.id)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-bold transition ${selectedPassageId === p.id ? "bg-amber-50 text-amber-800 ring-2 ring-amber-600" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`} style={{ fontFamily: language === "hindi" ? HI : undefined }}>
                          {p.title}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <p className="mt-5 text-xs font-black uppercase tracking-wider text-slate-500">Pace car speed</p>
                <div className="mt-2 flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-2.5">
                  <button type="button" onClick={() => setPaceWpm((w) => Math.max(SPEEDRACE_MIN_PACE_WPM, w - 5))} aria-label="Decrease pace car speed" className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black text-slate-700 shadow-sm hover:bg-slate-100">−</button>
                  <span className="flex-1 text-center text-sm font-black text-slate-800">{paceWpm} WPM</span>
                  <button type="button" onClick={() => setPaceWpm((w) => Math.min(SPEEDRACE_MAX_PACE_WPM, w + 5))} aria-label="Increase pace car speed" className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black text-slate-700 shadow-sm hover:bg-slate-100">+</button>
                </div>
                {personalBest && <p className="mt-1.5 text-xs text-slate-500">Your best on this category: <b className="text-slate-700">{personalBest} WPM</b> -- that ghost races too.</p>}

                <button type="button" onClick={startRace} className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-3 text-base font-black text-white shadow-lg transition hover:bg-slate-800">Start Race →</button>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-5">
              <p className="text-xs font-black uppercase tracking-wider text-amber-800">🔴 Live Classroom Race</p>
              <p className="mt-1 text-xs text-amber-700">If your teacher is hosting a live race for the whole class, enter the room code here to join instead of practicing solo.</p>
              <div className="mt-3 flex gap-2">
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="ROOM CODE"
                  maxLength={8}
                  className="flex-1 rounded-lg border-2 border-amber-200 px-3 py-2 text-sm font-black uppercase tracking-widest outline-none focus:border-amber-500"
                />
                <button type="button" onClick={handleJoin} className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-black text-white hover:bg-amber-700">Join</button>
              </div>
              {joinError && <p role="alert" className="mt-2 text-xs font-bold text-rose-700">{joinError}</p>}
            </div>
          </>
        )}

        {step === "lobby" && room && (
          <div className="mt-6 space-y-5">
            <div className="rounded-3xl bg-slate-900 p-8 text-center shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Joined room</p>
              <p className="mt-2 text-5xl font-black tracking-[0.2em] text-amber-400">{room.code}</p>
              <p className="mt-3 text-sm text-slate-400">Waiting for your teacher to start the race…</p>
            </div>
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="font-black text-slate-950">Who's here ({lobbyParticipants.length})</h2>
              <ul className="mt-4 space-y-1.5">
                {lobbyParticipants.map((p) => (
                  <li key={p.student_id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">{p.student_name}</li>
                ))}
                {!lobbyParticipants.length && <p className="text-sm text-slate-500">Waiting for classmates to join…</p>}
              </ul>
              <button type="button" onClick={leaveLobby} className="mt-5 text-sm font-bold text-slate-500 underline">Leave and practice solo instead</button>
            </div>
          </div>
        )}

        {step === "racing" && (
          <div className="mt-6 rounded-3xl bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-black text-slate-700">
              <span>WPM <b className="text-lg text-slate-950">{liveWpm}</b></span>
              <span>Accuracy <b className="text-lg text-slate-950">{liveAccuracy}%</b></span>
              <span>Time <b className="text-lg text-slate-950">{(elapsedMs / 1000).toFixed(1)}s</b></span>
              <button
                type="button"
                onClick={useBoost}
                disabled={boostsLeft <= 0}
                className={`rounded-lg px-4 py-2 text-xs font-black transition ${boostsLeft > 0 ? "bg-amber-500 text-white hover:bg-amber-600" : "cursor-not-allowed bg-slate-100 text-slate-400"} ${boostFlash ? "animate-speedrace-boost-flash" : ""}`}
              >
                ⚡ Boost ({boostsLeft} left) -- Tab
              </button>
            </div>

            <div className="mt-5 space-y-4 rounded-2xl bg-slate-50 p-5">
              <Racetrack label="You" progress={youProgress} marker="🚗" tone="bg-amber-500" />
              <Racetrack label="Pace" progress={paceProgress} marker="🚙" tone="bg-slate-500" />
              {personalBest && !room && <Racetrack label="Best" progress={ghostProgress} marker="👻" tone="bg-violet-500" />}
            </div>

            {room && (
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Live classroom leaderboard</p>
                <ul className="mt-2 space-y-1">
                  {raceParticipants.slice(0, 8).map((p, i) => (
                    <li key={p.student_id} className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>{i + 1}. {p.student_name}</span>
                      <span>{Math.round(p.finished_at ? (p.wpm ?? 0) : p.live_wpm)} WPM</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-xl leading-9 tracking-wide" style={{ fontFamily }}>
              {[...passage].map((ch, i) => {
                const cls = i < typed.length
                  ? (keystrokeChecks[i]?.correct ? "text-emerald-600" : "rounded bg-rose-200 text-rose-700")
                  : i === typed.length
                    ? "rounded bg-amber-300 text-slate-900"
                    : "text-slate-400";
                return <span key={i} className={cls}>{ch === " " ? " " : ch}</span>;
              })}
            </p>

            <div className="mt-3">
              <input
                ref={inputRef}
                value={typed}
                onChange={(event) => handleTyped(event.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoFocus
                aria-label="Type the passage above"
                className="w-full rounded-xl border-2 border-slate-200 p-3 text-lg outline-none focus:border-slate-500"
                style={{ fontFamily }}
                placeholder="Start typing the passage above…"
              />
            </div>
          </div>
        )}

        {step === "finished" && finishStats && room && (
          <div className="mt-6 space-y-5">
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="bg-slate-900 px-6 py-6 text-center">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Your race is done</h2>
                <p className="mt-1 text-4xl font-black text-amber-400">{finishStats.wpm} WPM</p>
                <p className="mt-1 text-sm font-bold text-slate-400">{finishStats.accuracy}% accuracy · {(finishStats.timeMs / 1000).toFixed(1)}s</p>
              </div>
              {!finalParticipants ? (
                <p className="p-6 text-center text-sm font-bold text-slate-500">Waiting for your teacher to finish the race and reveal results…</p>
              ) : (
                <div className="p-5">
                  {myFinalRow && gameRoomPodiumMessage(myFinalRow.rank) && (
                    <p className="mb-4 rounded-xl bg-amber-50 p-4 text-center font-black text-amber-800">{gameRoomPodiumMessage(myFinalRow.rank)}</p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-3">
                    {finalParticipants.slice(0, 3).map((p) => (
                      <div key={p.student_id} className={`rounded-2xl bg-gradient-to-b p-4 text-center shadow ${gameRoomPodiumTone(p.rank)} ${p.student_id === room.studentId ? "ring-4 ring-amber-400" : ""}`}>
                        <p className="text-2xl">{p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : "🥉"}</p>
                        <p className="mt-1 font-black">{p.student_name}</p>
                        <p className="text-xs font-bold opacity-80">{Math.round(p.wpm ?? 0)} WPM</p>
                      </div>
                    ))}
                  </div>
                  <ol className="mt-4 space-y-1.5">
                    {finalParticipants.map((p) => (
                      <li key={p.student_id} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${p.student_id === room.studentId ? "bg-amber-50" : "bg-slate-50"}`}>
                        <span className="font-bold text-slate-700">{p.rank ?? "—"}. {p.student_name}</span>
                        <span className="font-black text-slate-950">{Math.round(p.wpm ?? 0)} WPM</span>
                      </li>
                    ))}
                  </ol>
                  <button type="button" onClick={backToSolo} className="mt-5 w-full rounded-xl bg-slate-900 px-5 py-3 text-base font-black text-white hover:bg-slate-800">Back to Speed Race</button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === "finished" && finishStats && !room && (
          <div className="mt-6 space-y-5">
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="bg-slate-900 px-6 py-6 text-center">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Race finished</h2>
                <p className="mt-1 text-4xl font-black text-amber-400">{finishStats.wpm} WPM</p>
                <p className="mt-1 text-sm font-bold text-slate-400">{finishStats.accuracy}% accuracy · {(finishStats.timeMs / 1000).toFixed(1)}s</p>
                {finishStats.isNewBest && <p className="mt-3 inline-block rounded-full bg-amber-500/20 px-4 py-1.5 text-xs font-black text-amber-300">🏆 New personal best!</p>}
              </div>
              <div className="flex flex-wrap justify-center gap-2 p-5">
                <button type="button" onClick={startRace} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800">Race again</button>
                <button type="button" onClick={() => setStep("setup")} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">Change setup</button>
              </div>
            </div>
            <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-500">Personal-best scores are kept on this device only, per language and category.</p>
              <p className="mt-2 text-xs text-slate-400">{SPEEDRACE_WORDS_PER_RACE} words per race · pace car set to {paceWpm} WPM</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
