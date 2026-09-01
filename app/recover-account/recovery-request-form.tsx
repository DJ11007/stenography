"use client";

import { useActionState } from "react";
import { createRecoveryRequest, type AccountRecoveryState } from "./actions";

export default function RecoveryRequestForm({ admin = false }: { admin?: boolean }) {
  const [state, action, pending] = useActionState(createRecoveryRequest, {} as AccountRecoveryState);
  return <form action={action} className="mt-7 space-y-4">
    <input type="hidden" name="recoveryType" value={admin ? "admin" : "student"} />
    <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Samradhi Classes staff will confirm your identity directly (phone or WhatsApp) before restoring access -- fill in details they can recognize when you talk to them.</p>
    <div><label className="mb-2 block text-sm font-medium" htmlFor="studentId">{admin ? "Full name (as registered)" : "Full name (as registered with us)"}</label><input className="w-full rounded-lg border border-slate-300 px-4 py-3" id="studentId" name="studentId" required maxLength={80} /></div>
    <div><label className="mb-2 block text-sm font-medium" htmlFor="detail">Another identifying detail</label><input className="w-full rounded-lg border border-slate-300 px-4 py-3" id="detail" name="detail" required maxLength={120} aria-describedby="detail-help" /><p id="detail-help" className="mt-1 text-xs text-slate-500">For example, your registered mobile number, admission month, or class/batch. Do not enter a password, OTP, Aadhaar number or payment-card data.</p></div>
    {admin && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Administrator requests require platform-owner or authorized institution-owner review. An ordinary administrator cannot reset another administrator.</p>}
    <button disabled={pending} className="w-full rounded-lg bg-blue-700 py-3 font-semibold text-white disabled:opacity-60">{pending ? "Submitting…" : "Submit recovery request"}</button>
    {state.message && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{state.message}</p>}
  </form>;
}
