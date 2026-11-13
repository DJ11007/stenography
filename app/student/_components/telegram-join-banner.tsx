"use client";

import { useState, useTransition } from "react";
import { markTelegramJoined } from "../telegram-actions";

const TELEGRAM_URL = "https://t.me/Samradhiclasses";
const SUPPORT_PHONE = "917014371324";

export function TelegramJoinBanner({ initiallyJoined, studentName }: { initiallyJoined: boolean; studentName: string }) {
  const [joined, setJoined] = useState(initiallyJoined);
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (joined || dismissed) return null;

  const whatsappMessage = `Hi Samradhi Classes, I'm ${studentName} and I've joined your Telegram channel. Please approve my ID and add my free bonus tests.`;
  const whatsappHref = `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(whatsappMessage)}`;

  const claimJoined = () => {
    setJoined(true);
    startTransition(() => { void markTelegramJoined(); });
  };

  return (
    <section aria-label="Join our Telegram channel" className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-sky-600 via-sky-500 to-blue-600 p-6 text-white shadow-lg sm:p-7">
      <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss for now" className="absolute right-4 top-4 rounded-full bg-white/15 px-2.5 py-1 text-xs font-black hover:bg-white/25">✕</button>
      <div className="flex flex-wrap items-start gap-4">
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur">📢</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-100">Join our Telegram channel</p>
          <h2 className="mt-1 text-xl font-black sm:text-2xl">Get free bonus tests — stay connected with us!</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-sky-50">Join our Telegram channel for instant alerts on live tests, new exercises, admit cards and results. Join now and claim a few <strong>free bonus tests</strong> on your account — just message us after joining.</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-black text-sky-700 shadow-sm transition-transform hover:-translate-y-0.5">
              <span aria-hidden>✈️</span> Join Telegram Channel
            </a>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={claimJoined} aria-disabled={isPending} className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-black text-white shadow-sm transition-transform hover:-translate-y-0.5">
              ✓ I've Joined — Approve My ID
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
