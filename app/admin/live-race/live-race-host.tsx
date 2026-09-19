"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CATEGORIES, type WordtrisCategory, type WordtrisLanguage } from "@/lib/wordtris-content";
import { buildSpeedRacePassage, SPEEDRACE_DEFAULT_PACE_WPM, SPEEDRACE_MIN_PACE_WPM, SPEEDRACE_MAX_PACE_WPM } from "@/lib/speedrace-content";
import { GAME_ROOM_POLL_MS, gameRoomPodiumMessage, gameRoomPodiumTone, type GameRoomParticipant } from "@/lib/game-rooms";
import { createGameRoom, getMyHostedRoom, startGameRoom, finishGameRoom, listGameRoomParticipants } from "../../typing/games/_multiplayer/actions";
import { BackButton } from "../../_components/back-button";

const HI = '"Nirmala UI", "Noto Sans Devanagari", system-ui, sans-serif';

type Room = { id: string; code: string; status: "waiting" | "racing" | "finished" };
type Props = { words: Record<WordtrisLanguage, Record<WordtrisCategory, string[]>> };

export function LiveRaceHost({ words }: Props) {
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<GameRoomParticipant[]>([]);
  const [language, setLanguage] = useState<WordtrisLanguage>("english");
  const [category, setCategory] = useState<WordtrisCategory>("easy_words");
  const [paceWpm, setPaceWpm] = useState(SPEEDRACE_DEFAULT_PACE_WPM);
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(true);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    (async () => {
      const hosted = await getMyHostedRoom();
      if (hosted) {
        const recovered: Room = { id: hosted.id, code: hosted.code, status: hosted.status as Room["status"] };
        roomRef.current = recovered;
        setRoom(recovered);
      }
      setRecovering(false);
    })();
  }, []);

  const refreshParticipants = useCallback(async () => {
    if (!roomRef.current) return;
    const rows = await listGameRoomParticipants(roomRef.current.id);
    setParticipants(rows);
  }, []);

  useEffect(() => {
    if (!room || room.status === "finished") return;
    refreshParticipants();
    const timer = window.setInterval(refreshParticipants, GAME_ROOM_POLL_MS);
    return () => window.clearInterval(timer);
  }, [room, refreshParticipants]);

  const createRoom = async () => {
    setError(null);
    const pool = words[language]?.[category] ?? [];
    const passage = buildSpeedRacePassage(pool);
    const config = { language, category, paceWpm, passage };
    const result = await createGameRoom("speed-race", config);
    if ("error" in result) { setError(result.error); return; }
    const next: Room = { id: result.id, code: result.code, status: "waiting" };
    roomRef.current = next;
    setRoom(next);
  };

  const start = async () => {
    if (!room) return;
    const result = await startGameRoom(room.id);
    if (result.error) { setError(result.error); return; }
    const next: Room = { ...room, status: "racing" };
    roomRef.current = next;
    setRoom(next);
  };

  const finish = async () => {
    if (!room) return;
    const result = await finishGameRoom(room.id);
    if (result.error) { setError(result.error); return; }
    await refreshParticipants();
    const next: Room = { ...room, status: "finished" };
    roomRef.current = next;
    setRoom(next);
  };

  const startNewRoom = () => {
    roomRef.current = null;
    setRoom(null);
    setParticipants([]);
    setError(null);
  };

  if (recovering) {
    return <main className="min-h-screen bg-slate-100 p-8 text-center text-slate-500">Loading…</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <section className="mx-auto max-w-3xl px-4 py-10">
        <BackButton href="/admin" label="Admin panel" />
        <p className="mt-5 text-xs font-black uppercase tracking-widest text-amber-700">Live Classroom Race</p>
        <h1 className="mt-2 text-3xl font-black">Host a live Speed Race</h1>
        <p className="mt-2 text-slate-600">Create a room, share the code with your class, and start the race once everyone's joined -- from the "🔴 Join a Live Race" option on Speed Race's own setup screen.</p>

        {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 font-bold text-rose-800">{error}</p>}

        {!room && (
          <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Language</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setLanguage("english")} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${language === "english" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>English</button>
              <button type="button" onClick={() => setLanguage("hindi")} style={{ fontFamily: HI }} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${language === "hindi" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>हिन्दी</button>
            </div>

            <p className="mt-5 text-xs font-black uppercase tracking-wider text-slate-500">Category</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CATEGORIES.map((cat) => (
                <button key={cat.id} type="button" onClick={() => setCategory(cat.id)} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${category === cat.id ? "bg-amber-50 text-amber-800 ring-2 ring-amber-600" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
                  {language === "hindi" ? cat.hi : cat.en}
                </button>
              ))}
            </div>

            <p className="mt-5 text-xs font-black uppercase tracking-wider text-slate-500">Pace car speed</p>
            <div className="mt-2 flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-2.5">
              <button type="button" onClick={() => setPaceWpm((w) => Math.max(SPEEDRACE_MIN_PACE_WPM, w - 5))} aria-label="Decrease pace car speed" className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black text-slate-700 shadow-sm hover:bg-slate-100">−</button>
              <span className="flex-1 text-center text-sm font-black text-slate-800">{paceWpm} WPM</span>
              <button type="button" onClick={() => setPaceWpm((w) => Math.min(SPEEDRACE_MAX_PACE_WPM, w + 5))} aria-label="Increase pace car speed" className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black text-slate-700 shadow-sm hover:bg-slate-100">+</button>
            </div>

            <button type="button" onClick={createRoom} className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-3 text-base font-black text-white shadow-lg transition hover:bg-slate-800">Create room →</button>
          </div>
        )}

        {room && room.status === "waiting" && (
          <div className="mt-6 space-y-5">
            <div className="rounded-3xl bg-slate-900 p-8 text-center shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Room code</p>
              <p className="mt-2 text-6xl font-black tracking-[0.2em] text-amber-400">{room.code}</p>
              <p className="mt-3 text-sm text-slate-400">Read this out, or write it on the board -- students enter it from Speed Race's setup screen.</p>
            </div>
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="font-black text-slate-950">Waiting to join ({participants.length})</h2>
              <ul className="mt-4 space-y-1.5">
                {participants.map((p) => (
                  <li key={p.student_id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">{p.student_name}</li>
                ))}
                {!participants.length && <p className="text-sm text-slate-500">No one has joined yet.</p>}
              </ul>
              <button type="button" onClick={start} className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-3 text-base font-black text-white shadow-lg transition hover:bg-emerald-700">Start race →</button>
            </div>
          </div>
        )}

        {room && room.status === "racing" && (
          <div className="mt-6 space-y-5">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-black text-slate-950">Live leaderboard</h2>
                <button type="button" onClick={finish} className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-black text-white hover:bg-rose-800">Finish race</button>
              </div>
              <ol className="mt-4 space-y-2">
                {participants.map((p, i) => (
                  <li key={p.student_id} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between text-sm font-black text-slate-800">
                      <span>{i + 1}. {p.student_name}</span>
                      <span>{Math.round(p.finished_at ? (p.wpm ?? 0) : p.live_wpm)} WPM</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-amber-500 transition-[width]" style={{ width: `${Math.min(100, p.finished_at ? 100 : p.live_progress)}%` }} />
                    </div>
                  </li>
                ))}
                {!participants.length && <p className="text-sm text-slate-500">No one joined this room.</p>}
              </ol>
            </div>
          </div>
        )}

        {room && room.status === "finished" && (
          <div className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {participants.slice(0, 3).map((p) => (
                <div key={p.student_id} className={`rounded-2xl bg-gradient-to-b p-5 text-center shadow ${gameRoomPodiumTone(p.rank)}`}>
                  <p className="text-3xl">{p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : "🥉"}</p>
                  <p className="mt-1 font-black">{p.student_name}</p>
                  <p className="text-sm font-bold opacity-80">{Math.round(p.wpm ?? 0)} WPM</p>
                  <p className="mt-2 text-xs font-black">{gameRoomPodiumMessage(p.rank)}</p>
                </div>
              ))}
            </div>
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="font-black text-slate-950">Final results</h2>
              <ol className="mt-4 space-y-1.5">
                {participants.map((p) => (
                  <li key={p.student_id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-bold text-slate-700">{p.rank ?? "—"}. {p.student_name}</span>
                    <span className="font-black text-slate-950">{Math.round(p.wpm ?? 0)} WPM · {Math.round(p.accuracy ?? 0)}%</span>
                  </li>
                ))}
              </ol>
              <button type="button" onClick={startNewRoom} className="mt-5 w-full rounded-xl bg-slate-900 px-5 py-3 text-base font-black text-white shadow-lg transition hover:bg-slate-800">Host a new room</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
