"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type AuthFormState } from "@/app/auth/actions";

export default function SignupForm() {
  const [state, action, pending] = useActionState(signUp, {} as AuthFormState);
  return <form action={action} className="mt-8 space-y-5">
    <div><label htmlFor="fullName" className="mb-2 block text-sm font-medium text-slate-700">Full name</label><input id="fullName" name="fullName" required className="w-full rounded-lg border border-slate-300 px-4 py-3" /></div>
    <div><label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">Email address</label><input id="email" name="email" type="email" autoComplete="email" required className="w-full rounded-lg border border-slate-300 px-4 py-3" /></div>
    <div><label htmlFor="phone" className="mb-2 block text-sm font-medium text-slate-700">Phone number <span className="font-normal text-slate-400">(optional)</span></label><input id="phone" name="phone" type="tel" autoComplete="tel" className="w-full rounded-lg border border-slate-300 px-4 py-3" /></div>
    <div><label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">Password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="w-full rounded-lg border border-slate-300 px-4 py-3" /><p className="mt-1 text-xs text-slate-500">At least 8 characters.</p></div>
    {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
    {state.success && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{state.success}</p>}
    <button disabled={pending} className="w-full rounded-lg bg-blue-700 py-3 font-semibold text-white disabled:opacity-60">{pending ? "Creating account..." : "Create student account"}</button>
    <p className="text-center text-sm text-slate-600">Already have an account? <Link href="/login" className="font-semibold text-blue-700">Sign in</Link></p>
  </form>;
}
