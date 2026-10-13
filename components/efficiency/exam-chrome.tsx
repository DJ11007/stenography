"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Shared by the Word and Excel Efficiency workspaces.

// The countdown is anchored to the SERVER's clock, not the student's PC clock. The server
// works out how many seconds are left when it renders the page and the browser counts down
// from there with a monotonic timer, so a PC whose date/time is wrong (minutes or hours off,
// which showed up as a stuck 10:00 or a wildly wrong time) cannot change the exam time.
// `expired` flips `lead` seconds BEFORE zero so an automatic submit lands inside the deadline.
export function useExamCountdown(remainingAtLoadSeconds: number, lead = 2) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil(remainingAtLoadSeconds)));
  useEffect(() => {
    const started = performance.now();
    const tick = () => setRemaining(Math.max(0, Math.ceil(remainingAtLoadSeconds - (performance.now() - started) / 1000)));
    tick();
    const timer = setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [remainingAtLoadSeconds]);
  return { remaining, expired: remaining <= lead };
}

export function formatClock(seconds: number) {
  const hours = Math.floor(seconds / 3600), minutes = Math.floor((seconds % 3600) / 60), rest = seconds % 60;
  const mm = String(minutes).padStart(2, "0"), ss = String(rest).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

// An in-page message box instead of the browser's own confirm()/alert() popup.
export function ConfirmDialog({ open, title, message, confirmLabel = "OK", cancelLabel = "Cancel", tone = "danger", onConfirm, onCancel, children }: {
  open: boolean; title: string; message: ReactNode; confirmLabel?: string; cancelLabel?: string | null; tone?: "danger" | "primary"; onConfirm: () => void; onCancel: () => void; children?: ReactNode;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) confirmRef.current?.focus(); }, [open]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div role="presentation" className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={cancelLabel ? onCancel : undefined}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="exam-confirm-title" aria-describedby="exam-confirm-message" className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape" && cancelLabel) onCancel(); }}>
        <div className={`px-6 py-4 text-white ${tone === "danger" ? "bg-red-600" : "bg-blue-700"}`}><h2 id="exam-confirm-title" className="text-lg font-black">{title}</h2></div>
        <div className="px-6 py-5"><div id="exam-confirm-message" className="text-sm leading-6 text-slate-700">{message}</div>{children}</div>
        <div className="flex justify-end gap-3 border-t bg-slate-50 px-6 py-4">
          {cancelLabel && <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-black text-slate-700 hover:bg-slate-100">{cancelLabel}</button>}
          <button ref={confirmRef} type="button" onClick={onConfirm} className={`rounded-lg px-5 py-2 text-sm font-black text-white ${tone === "danger" ? "bg-red-600 hover:bg-red-500" : "bg-blue-700 hover:bg-blue-600"}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Full screen: hides the browser's address bar, tabs and the PC taskbar so only the exam shows.
export function FullscreenButton({ className = "" }: { className?: string }) {
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    setSupported(typeof document !== "undefined" && Boolean(document.documentElement.requestFullscreen));
    const sync = () => setActive(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  if (!supported) return null;
  const toggle = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* the browser refused (e.g. blocked by policy); nothing to do */ }
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={active} title={active ? "Exit full screen (Esc)" : "Full screen: hide the browser bars"} className={`flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-black hover:bg-white/20 ${className}`}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {active ? <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" /> : <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />}
      </svg>
      {active ? "Exit Full Screen" : "Full Screen"}
    </button>
  );
}
