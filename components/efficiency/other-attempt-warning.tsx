"use client";

import { useEffect, useState } from "react";

// Two efficiency tests open at once in one browser (another tab, or another student signed in there) is how a
// student's full sheet went unmarked on 22 Nov 2026: two Excel Test 8 attempts started 30 seconds apart, the work was
// done in one and the other was submitted. Every open test tab writes a heartbeat to this browser's storage; when
// another tab's test is alive, a warning bar says so. Nothing is blocked -- it only warns.

const KEY = "sc-open-tests";
const BEAT_MS = 4000, ALIVE_MS = 12000;
type Beat = { attempt: string; at: number };

function readBeats(): Record<string, Beat> {
  try { const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}"); return parsed && typeof parsed === "object" ? parsed : {}; } catch { return {}; }
}
function writeBeats(beats: Record<string, Beat>) {
  try { localStorage.setItem(KEY, JSON.stringify(beats)); } catch { /* storage blocked: no warning, nothing breaks */ }
}

export function OtherAttemptWarning({ attemptId, active }: { attemptId: string; active: boolean }) {
  const [other, setOther] = useState<"same" | "different" | null>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!active) return;
    const tab = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const check = () => {
      const now = Date.now(), beats = readBeats();
      for (const [id, beat] of Object.entries(beats)) if (now - beat.at > ALIVE_MS) delete beats[id];
      beats[tab] = { attempt: attemptId, at: now };
      writeBeats(beats);
      const others = Object.entries(beats).filter(([id]) => id !== tab).map(([, beat]) => beat);
      setOther(others.length === 0 ? null : others.some((beat) => beat.attempt !== attemptId) ? "different" : "same");
    };
    check();
    const timer = window.setInterval(check, BEAT_MS);
    const onStorage = (event: StorageEvent) => { if (event.key === KEY) check(); };
    window.addEventListener("storage", onStorage);
    const leave = () => { const beats = readBeats(); delete beats[tab]; writeBeats(beats); };
    window.addEventListener("pagehide", leave);
    return () => { window.clearInterval(timer); window.removeEventListener("storage", onStorage); window.removeEventListener("pagehide", leave); leave(); };
  }, [attemptId, active]);
  if (!active || !other || dismissed) return null;
  return (
    <div role="alert" className="fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-sm font-bold text-amber-950 shadow-lg">
      <span aria-hidden>⚠</span>
      <span>{other === "same"
        ? "This test is also open in another tab. Work in one tab only, or the two tabs can overwrite each other's work."
        : "Another test is open in this browser (another tab, or another student's account). Keep only one test open: only the test you submit is marked."}</span>
      <button type="button" onClick={() => setDismissed(true)} className="rounded-md bg-amber-950/10 px-2 py-0.5 hover:bg-amber-950/20" aria-label="Dismiss warning">✕</button>
    </div>
  );
}
