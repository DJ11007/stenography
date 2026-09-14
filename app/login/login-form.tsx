"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type AuthFormState } from "@/app/auth/actions";
import { PasswordInput } from "@/app/_components/password-input";

const initialState: AuthFormState = {};

const SUPPORT_WHATSAPP_NUMBER = "917014371324";
const SUPPORT_PHONE_DISPLAY = "7014371324";
const ACTIVATE_ACCOUNT_MESSAGE = "Hi Samradhi Classes, my account is pending approval. Please help activate it.";
const activateAccountWhatsAppHref = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(ACTIVATE_ACCOUNT_MESSAGE)}`;

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
        <PasswordInput id="password" name="password" autoComplete="current-password" required className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {state.error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          <p>{state.error}</p>
          {state.whatsapp && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <a
                href={activateAccountWhatsAppHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-green-700 underline underline-offset-2"
              >
                Chat with support on WhatsApp
              </a>
              <a
                href={`tel:+${SUPPORT_WHATSAPP_NUMBER}`}
                className="inline-flex items-center gap-1.5 font-semibold text-blue-700"
              >
                Call now: <span className="text-lg font-black tracking-wide">{SUPPORT_PHONE_DISPLAY}</span>
              </a>
            </div>
          )}
        </div>
      )}
      <button disabled={pending} type="submit" className="w-full rounded-lg bg-blue-700 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Signing in..." : "Sign in"}</button>
      <nav aria-label="Account recovery" className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
        {admin ? (
          <>
            <Link className="font-semibold text-blue-700" href="/forgot-password">Forgot Password?</Link>
            <Link className="font-semibold text-blue-700" href="/recover-account?type=admin">Forgot Email or Mobile?</Link>
            <Link className="font-semibold text-blue-700" href="/recover-account?type=admin">Recover Account</Link>
          </>
        ) : (
          <>
            <Link className="font-semibold text-blue-700" href="/account-help">Forgot Password?</Link>
            <Link className="font-semibold text-blue-700" href="/account-help">Forgot Email or Mobile?</Link>
          </>
        )}
      </nav>
      {!admin && <p className="text-center text-sm text-slate-600">New student? <Link className="font-semibold text-blue-700" href="/signup">Create an account</Link></p>}
    </form>
  );
}
