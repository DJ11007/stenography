"use client";

import { useState } from "react";

const TELEGRAM_URL = "https://t.me/Samradhiclasses";

// 21 Nov 2026 (owner's request): just one "Join Telegram -- SAMRADHI CLASSES" link. Joining is optional: no account is
// locked for not joining, and there's no "I've joined / approve my ID" step any more.
export function TelegramJoinBanner({ initiallyJoined }: { initiallyJoined: boolean; studentName?: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (initiallyJoined || dismissed) return null;

  return (
    <section aria-label="Join Telegram by SAMRADHI CLASSES" className="relative mb-6 flex flex-wrap items-center gap-4 rounded-3xl bg-gradient-to-br from-sky-600 via-sky-500 to-blue-600 p-5 pr-12 text-white shadow-lg">
      <button type="button" onClick={() => setDismissed(true)} aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/15 px-2.5 py-1 text-xs font-black hover:bg-white/25">✕</button>
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-xl">✈️</span>
      <p className="min-w-0 flex-1 text-sm font-bold leading-6 text-sky-50">Get alerts for live tests, new exercises, admit cards and results.</p>
      <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-black text-sky-700 shadow-sm transition-transform hover:-translate-y-0.5">
        Join Telegram — SAMRADHI CLASSES
      </a>
    </section>
  );
}
