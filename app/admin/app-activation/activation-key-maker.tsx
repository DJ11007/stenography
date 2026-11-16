"use client";

import { useState, useTransition } from "react";
import { makeActivationKey } from "./actions";

const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900";

export function ActivationKeyMaker({ ready }: { ready: boolean }) {
  const [deviceId, setDeviceId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<{ key?: string; error?: string }>({});
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const make = () => start(async () => { setCopied(false); setResult(await makeActivationKey(deviceId, name)); });
  const copy = async () => { if (!result.key) return; try { await navigator.clipboard.writeText(result.key); setCopied(true); } catch { setCopied(false); } };
  const digits = phone.replace(/\D/g, "");
  const whatsappTo = digits.length === 10 ? `91${digits}` : digits;
  const message = result.key ? `Your SCTyping activation key (Samradhi Classes):\n\n${result.key}\n\nOpen SCTyping > Activate, paste this key and press Activate. It works only on your computer.` : "";

  return (
    <section className="mt-6 space-y-4 rounded-2xl bg-white p-6 shadow">
      <label className="block text-sm font-semibold text-slate-700">Student&apos;s Device ID
        <input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="e.g. 1975e87c-7ffa-4a0a-9c32-cedf26a40521" className={`${field} font-mono`} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700">Student name (saved inside the key)<input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Meenu Verma" className={field} /></label>
        <label className="block text-sm font-semibold text-slate-700">WhatsApp number (optional, to send it)<input value={phone} inputMode="tel" onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" className={field} /></label>
      </div>
      <button type="button" disabled={!ready || pending || !deviceId.trim()} onClick={make} className="rounded-xl bg-blue-700 px-6 py-3 font-black text-white disabled:opacity-50">{pending ? "Making key…" : "🔑 Make activation key"}</button>
      {result.error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{result.error}</p>}
      {result.key && (
        <div className="space-y-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-black text-emerald-900">Activation key for {deviceId.trim()}</p>
          <textarea readOnly value={result.key} rows={4} className={`${field} font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copy} className="rounded-lg bg-emerald-700 px-4 py-2 font-black text-white">{copied ? "✓ Copied" : "Copy key"}</button>
            {whatsappTo.length >= 10 && <a href={`https://wa.me/${whatsappTo}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-green-600 px-4 py-2 font-black text-white">Send on WhatsApp</a>}
          </div>
        </div>
      )}
    </section>
  );
}
