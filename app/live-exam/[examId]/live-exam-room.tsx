"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfigurableTypingExam } from "@/app/typing/_components/configurable-typing-exam";
import { TypingStudentProvider } from "@/app/typing/_components/typing-student-provider";
import { formatDuration } from "@/lib/live-exam";
import { loadLiveExamTypingSection, type LiveTypingSection } from "../actions";
import { createClient } from "@/lib/supabase/client";

export type LiveExamSectionState = {
  id: string; position: number; kind: "typing" | "word" | "excel"; language: "English" | "Hindi"; label: string; testId: string;
  durationSeconds: number; gapAfterSeconds: number; maxMarks: number; startsAt: string; endsAt: string; gapEndsAt: string; submitted: boolean;
};
export type LiveExamState = {
  id: string; title: string; pattern: string; status: string; instructions: string | null; startsAt: string; resultsAt: string | null;
  serverNow: string; phase: "waiting" | "section" | "gap" | "finished"; sections: LiveExamSectionState[];
};
type Candidate = { name: string; loginId: string; rollNumber: string };
type Phase = { kind: "waiting"; until: number } | { kind: "section"; section: LiveExamSectionState; until: number } | { kind: "gap"; after: LiveExamSectionState; next: LiveExamSectionState | null; until: number } | { kind: "finished" };

const TIPS = [
  "Relax and take a deep breath — the next part starts by itself.",
  "Keep your fingers on the home row: A S D F for the left hand, J K L ; for the right.",
  "Do not refresh, close or leave this page. Your exam continues on its own.",
  "Sit straight, keep your wrists light and your eyes on the screen.",
  "Accuracy first, then speed: every correct word counts.",
  "If the internet stops, open this page again — you will rejoin the part that is running.",
];

const clock = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600), minutes = Math.floor((total % 3600) / 60), seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
};
const istTime = (iso: string | number) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const istDateTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

// Which part of the exam the server clock is in now (the sections' times come from the server's timeline).
function phaseAt(now: number, state: LiveExamState): Phase {
  const start = Date.parse(state.startsAt);
  if (now < start) return { kind: "waiting", until: start };
  for (const [index, section] of state.sections.entries()) {
    if (now < Date.parse(section.endsAt)) return { kind: "section", section, until: Date.parse(section.endsAt) };
    if (now < Date.parse(section.gapEndsAt)) return { kind: "gap", after: section, next: state.sections[index + 1] ?? null, until: Date.parse(section.gapEndsAt) };
  }
  return { kind: "finished" };
}

export function LiveExamRoom({ initial, instructions, candidate, preview }: { initial: LiveExamState; instructions: string[]; candidate: Candidate; preview: boolean }) {
  const [state, setState] = useState(initial);
  // Server time minus this computer's time, so every countdown follows the exam server, not the PC clock.
  const offset = useRef(0);
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(() => Date.parse(initial.serverNow));
  useEffect(() => { offset.current = Date.parse(initial.serverNow) - Date.now(); setServerOffset(offset.current); }, [initial.serverNow]);
  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("live_exam_state", { p_exam_id: initial.id });
    if (data) { const next = data as LiveExamState; offset.current = Date.parse(next.serverNow) - Date.now(); setServerOffset(offset.current); setState(next); }
  }, [initial.id]);
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now() + offset.current), 250);
    const poll = window.setInterval(() => { void refresh(); }, 30000);
    return () => { window.clearInterval(tick); window.clearInterval(poll); };
  }, [refresh]);
  const phase = useMemo(() => phaseAt(now, state), [now, state]);
  // Ask the server again as each part starts or ends, so a changed exam or a slow PC clock is caught at once.
  const lastKind = useRef(phase.kind);
  useEffect(() => { if (lastKind.current !== phase.kind) { lastKind.current = phase.kind; void refresh(); } }, [phase.kind, refresh]);

  // The exam login is asked once per browser tab; reloading the page during the exam does not ask again.
  const loginKey = `live-exam-login:${initial.id}`;
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => { try { if (sessionStorage.getItem(loginKey) === "1") setLoggedIn(true); } catch { /* storage unavailable */ } }, [loginKey]); // eslint-disable-line react-hooks/set-state-in-effect -- read once after mount

  if (!loggedIn) return <ExamLogin title={state.title} startsAt={state.startsAt} instructions={instructions} candidate={candidate} preview={preview} onLogin={() => { try { sessionStorage.setItem(loginKey, "1"); } catch { /* storage unavailable */ } setLoggedIn(true); }} />;

  const timeLeft = phase.kind === "finished" ? 0 : phase.until - now;
  const running = phase.kind === "section" ? phase.section.label : phase.kind === "gap" ? "Break" : phase.kind === "waiting" ? "Not started" : "Completed";
  return (
    <main className="flex min-h-screen flex-col bg-[#eef2f7]">
      <header className="flex flex-wrap items-center gap-3 bg-[#0b2e59] px-4 py-2 text-white">
        <span className="rounded bg-white/15 px-2 py-0.5 text-xs font-black tracking-widest">LIVE EXAM</span>
        <h1 className="min-w-0 flex-1 truncate text-base font-black">{state.title}</h1>
        <span className="text-xs text-white/70">Server time</span>
        <span className="font-mono text-sm font-black">{istTime(now)}</span>
      </header>
      {preview && <p className="bg-amber-300 px-4 py-1 text-center text-xs font-black text-amber-950">Admin preview — nothing you do here is submitted.</p>}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <CandidatePanel candidate={candidate} running={running} timeLeft={phase.kind === "finished" ? null : clock(timeLeft)} sections={state.sections} now={now} />
        <section className={`flex min-w-0 flex-1 justify-center ${phase.kind === "section" && phase.section.kind === "typing" && !phase.section.submitted ? "items-start p-0" : "items-center p-4 sm:p-8"}`}>
          {phase.kind === "waiting" && <WaitScreen title="The exam starts in" until={phase.until} now={now} next={state.sections[0] ?? null} />}
          {phase.kind === "gap" && <WaitScreen title={`${phase.after.label} is over. Break`} until={phase.until} now={now} next={phase.next} />}
          {phase.kind === "section" && (phase.section.submitted || phase.section.kind !== "typing") && (
            <div className="w-full max-w-2xl rounded-3xl bg-white p-8 text-center shadow-lg">
              <p className="text-xs font-black uppercase tracking-widest text-[#0b2e59]">Part {phase.section.position} of {state.sections.length}</p>
              <h2 className="mt-2 text-3xl font-black text-slate-900">{phase.section.label}</h2>
              <p className="mt-1 text-slate-600">{formatDuration(phase.section.durationSeconds)} · {phase.section.maxMarks} marks</p>
              <p className="mt-6 font-mono text-6xl font-black text-[#0b2e59]">{clock(timeLeft)}</p>
              <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{phase.section.submitted ? "✓ This part is submitted. Wait for the next part; it starts by itself." : "This part opens here on this page. (The Word and Excel workspaces are added inside the exam in the next update.)"}</p>
            </div>
          )}
          {phase.kind === "section" && !phase.section.submitted && phase.section.kind === "typing" && (
            <TypingSection key={phase.section.id} section={phase.section} serverOffset={serverOffset} candidate={candidate} preview={preview} onSaved={() => { void refresh(); }} />
          )}
          {phase.kind === "finished" && (
            <div className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-lg">
              <p className="text-5xl">✓</p>
              <h2 className="mt-3 text-3xl font-black text-slate-900">Exam completed</h2>
              <p className="mt-2 text-slate-600">All parts of this exam are over. Thank you.</p>
              <p className="mt-4 rounded-xl bg-blue-50 p-4 text-sm font-bold text-blue-900">{state.resultsAt ? `Results will be shown from ${istDateTime(state.resultsAt)}.` : "Results will be shown soon."}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

// Left side, all through the exam: photo (initials when there is none), name, login ID, password masked, roll number,
// the part running now and its time left, and each part's status.
function CandidatePanel({ candidate, running, timeLeft, sections, now }: { candidate: Candidate; running: string; timeLeft: string | null; sections: LiveExamSectionState[]; now: number }) {
  const initials = candidate.name.split(/\s+/u).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
  return (
    <aside className="w-full shrink-0 border-b border-slate-300 bg-white p-4 md:w-72 md:border-b-0 md:border-r">
      <div className="flex items-center gap-3 md:flex-col md:text-center">
        <div aria-label="Candidate photo" className="grid h-20 w-20 shrink-0 place-items-center rounded-lg border-2 border-[#0b2e59] bg-[#dbe7f5] text-2xl font-black text-[#0b2e59] md:h-32 md:w-28">{initials}</div>
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-slate-900">{candidate.name}</p>
          <p className="text-xs text-slate-500">Roll No. {candidate.rollNumber}</p>
        </div>
      </div>
      <dl className="mt-4 grid gap-2 text-sm">
        <div className="rounded-lg bg-slate-50 px-3 py-2"><dt className="text-[11px] font-black uppercase tracking-wider text-slate-500">Login ID</dt><dd className="break-all font-bold text-slate-900">{candidate.loginId || "—"}</dd></div>
        <div className="rounded-lg bg-slate-50 px-3 py-2"><dt className="text-[11px] font-black uppercase tracking-wider text-slate-500">Password</dt><dd className="font-mono font-bold tracking-[0.3em] text-slate-900">XXXXXX</dd></div>
        <div className="rounded-lg bg-[#0b2e59] px-3 py-2 text-white"><dt className="text-[11px] font-black uppercase tracking-wider text-white/70">Now</dt><dd className="font-bold">{running}</dd>{timeLeft && <dd className="font-mono text-2xl font-black">{timeLeft}</dd>}</div>
      </dl>
      <ol className="mt-4 grid gap-1.5 text-sm">
        {sections.map((section) => {
          const status = section.submitted ? "Submitted" : now >= Date.parse(section.endsAt) ? "Over" : now >= Date.parse(section.startsAt) ? "Running" : istTime(section.startsAt).slice(0, 5);
          return <li key={section.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-2.5 py-1.5"><span className="truncate font-bold text-slate-800">{section.position}. {section.label}</span><span className={`shrink-0 text-xs font-black ${status === "Running" ? "text-green-700" : status === "Submitted" ? "text-blue-700" : "text-slate-500"}`}>{status}</span></li>;
        })}
      </ol>
    </aside>
  );
}

// Before the exam and in each break: a big countdown, what comes next, and a changing tip.
function WaitScreen({ title, until, now, next }: { title: string; until: number; now: number; next: LiveExamSectionState | null }) {
  const tip = TIPS[Math.floor(now / 12000) % TIPS.length];
  return (
    <div className="w-full max-w-2xl rounded-3xl bg-white p-8 text-center shadow-lg">
      <p className="text-sm font-black uppercase tracking-widest text-slate-500">{title}</p>
      <p className="mt-3 font-mono text-7xl font-black text-[#0b2e59] sm:text-8xl">{clock(until - now)}</p>
      {next && <p className="mt-6 text-lg text-slate-700">Next: <strong>{next.label}</strong> — {formatDuration(next.durationSeconds)}. It starts automatically at <strong>00:00</strong>.</p>}
      <p className="mt-6 rounded-xl bg-green-50 p-4 text-sm font-bold text-green-900">{tip}</p>
    </div>
  );
}

// The exam login: the candidate types their own login ID and password again (checked against their own account only),
// can test the keyboard first, and reads the instructions.
function ExamLogin({ title, startsAt, instructions, candidate, preview, onLogin }: { title: string; startsAt: string; instructions: string[]; candidate: Candidate; preview: boolean; onLogin: () => void }) {
  const [loginId, setLoginId] = useState(""), [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | null>(null), [checking, setChecking] = useState(false), [peripheral, setPeripheral] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setProblem(null);
    // Only this account: a different login ID is refused before anything is sent, so the session never switches.
    if (!candidate.loginId || loginId.trim().toLowerCase() !== candidate.loginId.toLowerCase()) { setProblem("This login ID does not match the account you are signed in with."); return; }
    if (preview) { onLogin(); return; }
    setChecking(true);
    const { error } = await createClient().auth.signInWithPassword({ email: candidate.loginId, password });
    setChecking(false);
    if (error) { setProblem("Wrong password. Type the password of your account."); return; }
    onLogin();
  };
  return (
    <main className="min-h-screen bg-[#eef2f7]">
      <header className="bg-[#0b2e59] px-4 py-3 text-white"><p className="text-xs font-black tracking-widest text-white/70">LIVE EXAM</p><h1 className="text-xl font-black">{title}</h1></header>
      <div className="mx-auto grid max-w-5xl gap-6 p-4 sm:p-8 lg:grid-cols-[360px_1fr]">
        <form onSubmit={submit} className="h-fit rounded-2xl bg-white p-6 shadow-md">
          <h2 className="text-xl font-black text-slate-900">Candidate login</h2>
          <p className="mt-1 text-sm text-slate-600">Exam starts {istDateTime(startsAt)}</p>
          <label className="mt-5 grid gap-1.5 text-sm font-bold text-slate-700">Login ID<input className="input" type="email" autoComplete="username" required value={loginId} onChange={(event) => setLoginId(event.target.value)} placeholder="your login email" /></label>
          <label className="mt-3 grid gap-1.5 text-sm font-bold text-slate-700">Password<input className="input" type="password" autoComplete="current-password" required={!preview} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {problem && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800">{problem}</p>}
          <div className="mt-5 flex gap-2">
            <button disabled={checking} className="flex-1 rounded-xl bg-[#0b2e59] px-4 py-3 font-black text-white hover:bg-[#123f78] disabled:opacity-60">{checking ? "Checking…" : "Login"}</button>
            <button type="button" onClick={() => setPeripheral(true)} className="rounded-xl border-2 border-[#0b2e59] px-4 py-3 text-sm font-black text-[#0b2e59] hover:bg-blue-50">Peripheral Check</button>
          </div>
          {preview && <p className="mt-3 text-xs font-bold text-amber-700">Admin preview: type your own login ID; the password is not checked.</p>}
        </form>
        <section className="rounded-2xl bg-white p-6 shadow-md">
          <h2 className="text-xl font-black text-slate-900">Instructions</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">{instructions.map((line, index) => <li key={index}>{line}</li>)}</ol>
        </section>
      </div>
      {peripheral && <PeripheralCheck onClose={() => setPeripheral(false)} />}
    </main>
  );
}

// Peripheral check: a text box to try the keyboard (English letters only), with the last key shown big.
function PeripheralCheck({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState(""), [lastKey, setLastKey] = useState<string | null>(null);
  return (
    <div role="dialog" aria-modal aria-label="Peripheral check" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-xl font-black text-slate-900">Peripheral check — keyboard</h2><button type="button" onClick={onClose} className="rounded-lg px-3 py-1 text-xl" aria-label="Close">×</button></div>
        <p className="mt-1 text-sm text-slate-600">Type in the box below (English). Each key you press is shown on the right. If every key works, close this and log in.</p>
        <div className="mt-4 flex gap-3">
          <textarea autoFocus value={text} onKeyDown={(event) => setLastKey(event.key === " " ? "Space" : event.key)} onChange={(event) => setText(event.target.value.replace(/[^\x20-\x7E\n]/g, ""))} className="input min-h-32 flex-1 font-mono" placeholder="The quick brown fox jumps over the lazy dog 1234567890" />
          <div className="grid w-28 shrink-0 place-items-center rounded-xl border-2 border-dashed border-slate-300 text-center"><span className="text-xs font-bold text-slate-500">Last key</span><span className="px-1 font-mono text-2xl font-black text-[#0b2e59]">{lastKey ?? "—"}</span></div>
        </div>
        <p className="mt-2 text-xs text-slate-500">{text.length} characters typed</p>
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-[#0b2e59] px-4 py-3 font-black text-white">Keyboard is working — close</button>
      </div>
    </div>
  );
}

// A typing part: its test is fetched when the part starts (the server refuses earlier), then the normal typing screen
// runs in live-exam mode — its clock ends with the part, the RSMSSB rules are fixed, and the attempt is saved with the
// part. An admin preview shows the same screen but saves nothing.
function TypingSection({ section, serverOffset, candidate, preview, onSaved }: { section: LiveExamSectionState; serverOffset: number; candidate: Candidate; preview: boolean; onSaved: () => void }) {
  const [loaded, setLoaded] = useState<LiveTypingSection | null>(null), [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let tries = 0, retry: number | undefined;
    // This PC may reach the start a moment before the server does: "not started yet" is asked again shortly.
    const load = () => void loadLiveExamTypingSection(section.id).then((result) => {
      if (cancelled) return;
      if (result.ok) { setLoaded(result.section); return; }
      if (/not started yet/i.test(result.error) && tries++ < 12) { retry = window.setTimeout(load, 1500); return; }
      setProblem(result.error);
    }).catch(() => { if (!cancelled) setProblem("Could not open this part. Check your internet and refresh the page."); });
    load();
    return () => { cancelled = true; window.clearTimeout(retry); };
  }, [section.id]);
  if (problem) return <p role="alert" className="m-8 rounded-2xl bg-red-50 p-6 text-center font-bold text-red-800">{problem}</p>;
  if (!loaded) return <p className="m-8 rounded-2xl bg-white p-6 text-center font-bold text-slate-600 shadow">Opening {section.label}…</p>;
  return (
    <div className="w-full">
      <TypingStudentProvider student={{ name: candidate.name, email: candidate.loginId, phone: null }}>
        <ConfigurableTypingExam preset={loaded.preset} mode="exam" customPreset managedTest={preview ? undefined : loaded.managedTest} adminPreview={preview}
          liveExam={{ sectionId: section.id, endsAt: Date.parse(section.endsAt), serverOffset, onSaved }} />
      </TypingStudentProvider>
    </div>
  );
}
