"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePassword, type UpdatePasswordState } from "./actions";
import { PasswordInput } from "@/app/_components/password-input";

export default function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, {} as UpdatePasswordState);
  return <form action={action} className="mt-7 space-y-4">
    <div><label className="mb-2 block text-sm font-medium" htmlFor="password">New password</label><PasswordInput className="w-full rounded-lg border border-slate-300 px-4 py-3" id="password" name="password" autoComplete="new-password" required minLength={12} /></div>
    <div><label className="mb-2 block text-sm font-medium" htmlFor="confirmation">Confirm new password</label><PasswordInput className="w-full rounded-lg border border-slate-300 px-4 py-3" id="confirmation" name="confirmation" autoComplete="new-password" required minLength={12} /></div>
    <p className="text-sm text-slate-600">At least 12 characters, including uppercase, lowercase, a number and a symbol.</p>
    {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{state.success}</p>}
    {!state.success && <button disabled={pending} className="w-full rounded-lg bg-blue-700 py-3 font-semibold text-white disabled:opacity-60">{pending ? "Updating…" : "Update password"}</button>}
    {state.success && <Link className="block text-center font-semibold text-blue-700" href="/login">Return to login</Link>}
  </form>;
}
