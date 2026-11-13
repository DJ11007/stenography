"use client";

import { useState } from "react";
import Image from "next/image";

const SUPPORT_PHONE = "917014371324";

function WhatsAppIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8.2 8.2 0 0 1-2.4-1.5 9 9 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6l.4-.5.3-.4c.1-.1.1-.3 0-.4s-.7-1.7-1-2.3-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4A3.4 3.4 0 0 0 5.8 9c0 1.3.9 2.5 1 2.7.1.1 1.8 2.8 4.4 3.9a15 15 0 0 0 1.5.5c.6.2 1.2.2 1.6.1.5-.1 1.7-.7 1.9-1.3s.3-1.2.2-1.3-.2-.1-.5-.2Z" /><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z" /></svg>;
}

export function QrPaymentButton({ title, category, durationLabel, priceLabel }: { title: string; category: string; durationLabel: string; priceLabel: string }) {
  const [open, setOpen] = useState(false);

  const confirmMessage = `Hi Samradhi Classes, I have paid for the "${title}" (${category}) course — ${durationLabel}, ${priceLabel} — via UPI QR code. Attaching my payment screenshot below, please activate my course.`;
  const confirmHref = `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(confirmMessage)}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-center text-sm font-black text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50"
      >
        📷 Pay via QR Code
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Scan and pay via QR code" className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/70 p-3 sm:p-6">
          <div className="mx-auto mt-10 max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-950">Scan &amp; Pay</h2>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-lg font-black text-slate-700">×</button>
            </div>

            <p className="text-sm font-bold text-slate-700">{title}</p>
            <p className="text-sm text-slate-500">{durationLabel} · {priceLabel}</p>

            <div className="mt-4 flex justify-center">
              <Image src="/payment-qr.jpg" alt="UPI payment QR code for Samradhi Classes" width={220} height={220} className="rounded-xl border border-slate-200" />
            </div>

            <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>Open any UPI app (PhonePe, Google Pay, Paytm, etc.)</li>
              <li>Scan the QR code above and pay {priceLabel}.</li>
              <li>Take a screenshot of the successful payment.</li>
              <li>Tap the button below and attach that screenshot in WhatsApp.</li>
            </ol>

            <a
              href={confirmHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-center text-sm font-black text-white shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <WhatsAppIcon className="h-5 w-5" />
              Send Payment Screenshot
            </a>
            <p className="mt-2 text-center text-xs text-slate-400">We activate your course within 20–30 minutes of confirming payment.</p>
          </div>
        </div>
      )}
    </>
  );
}
