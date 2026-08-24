"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type AuthFormState } from "@/app/auth/actions";

const initialState: AuthFormState = {};

export default function LoginForm({ admin = false }: { admin?: boolean }) {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="loginType" value={admin ? "admin" : "student"} />
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} type="submit" className="w-full rounded-lg bg-blue-700 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Signing in..." : "Sign in"}</button>
      <nav aria-label="Account recovery" className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
        <Link className="font-semibold text-blue-700" href="/forgot-password">Forgot Password?</Link>
        <Link className="font-semibold text-blue-700" href={admin ? "/recover-account?type=admin" : "/recover-account"}>Forgot Email or Mobile?</Link>
        <Link className="font-semibold text-blue-700" href={admin ? "/recover-account?type=admin" : "/recover-account"}>Recover Account</Link>
      </nav>
      {!admin && <p className="text-center text-sm text-slate-600">New student? <Link className="font-semibold text-blue-700" href="/signup">Create an account</Link></p>}
    </form>
  );
}
