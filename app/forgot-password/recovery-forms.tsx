"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, requestPhoneOtp, type RecoveryState } from "./actions";

const initial: RecoveryState = {};

export function RecoveryForms({ phoneEnabled }: { phoneEnabled: boolean }) {
  const [emailState, emailAction, emailPending] = useActionState(requestPasswordReset, initial);
  const [phoneState, phoneAction, phonePending] = useActionState(requestPhoneOtp, initial);
  return <div className="space-y-7">
    <form action={emailAction} className="space-y-4">
      <label className="block text-sm font-medium" htmlFor="email">Verified email address</label>
      <input className="w-full rounded-lg border border-slate-300 px-4 py-3" id="email" name="email" type="email" autoComplete="email" required />
      <button className="w-full rounded-lg bg-blue-700 py-3 font-semibold text-white disabled:opacity-60" disabled={emailPending}>{emailPending ? "Sending…" : "Send recovery link"}</button>
      {emailState.message && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{emailState.message}</p>}
    </form>
    {phoneEnabled && <form action={phoneAction} className="space-y-4 border-t pt-6">
      <label className="block text-sm font-medium" htmlFor="phone">Verified mobile number</label>
      <input className="w-full rounded-lg border border-slate-300 px-4 py-3" id="phone" name="phone" type="tel" placeholder="+919876543210" autoComplete="tel" required />
      <button className="w-full rounded-lg border border-blue-700 py-3 font-semibold text-blue-700 disabled:opacity-60" disabled={phonePending}>{phonePending ? "Sending…" : "Send SMS code"}</button>
      {phoneState.message && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{phoneState.message}</p>}
      <Link className="block text-center text-sm font-semibold text-blue-700" href="/verify-recovery-otp">I have an SMS code</Link>
    </form>}
  </div>;
}
