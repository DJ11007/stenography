"use client";

import { useActionState, useState } from "react";
import { clearStudentAccessPackage, setStudentAccessLocked, setStudentAccessPackage, setStudentClassInfo, setStudentFreePracticeLimit, setStudentPassword, type StudentActionState } from "./actions";
import { PasswordInput } from "@/app/_components/password-input";

const initial: StudentActionState = {};

export function StudentAccessControls({ studentId, testLimit, validityDays, graceDays, accessLocked, classInfo, freePracticeLimit }: { studentId: string; testLimit: number | null; validityDays: number | null; graceDays: number; accessLocked: boolean; classInfo: string | null; freePracticeLimit: number | null }) {
  const [packageState, packageAction, packagePending] = useActionState(setStudentAccessPackage, initial);
  const [lockState, lockAction, lockPending] = useActionState(setStudentAccessLocked, initial);
  const [clearState, clearAction, clearPending] = useActionState(clearStudentAccessPackage, initial);
  const [classInfoState, classInfoAction, classInfoPending] = useActionState(setStudentClassInfo, initial);
  const [freePracticeState, freePracticeAction, freePracticePending] = useActionState(setStudentFreePracticeLimit, initial);
  const [passwordState, passwordAction, passwordPending] = useActionState(setStudentPassword, initial);
  // Held only in this component's local state, purely so the admin can copy
  // the password they just typed and hand it to the student -- it is never
  // sent anywhere except the one submission below, never persisted, and is
  // gone on refresh. This does NOT let anyone see a password the student
  // chose themselves; Supabase Auth never returns those to anyone.
  const [lastSetPassword, setLastSetPassword] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Test access package</h3>
      <form action={packageAction} className="mt-3 grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="studentId" value={studentId} />
        <label className="text-xs font-bold text-slate-600">Test limit
          <input name="testLimit" type="number" min="0" defaultValue={testLimit ?? ""} placeholder="Unlimited" className="input mt-1 w-full" />
        </label>
        <label className="text-xs font-bold text-slate-600">Validity (days from now)
          <input name="validityDays" type="number" min="0" defaultValue={validityDays ?? ""} placeholder="No expiry" className="input mt-1 w-full" />
        </label>
        <label className="text-xs font-bold text-slate-600">Grace period (days)
          <input name="graceDays" type="number" min="0" defaultValue={graceDays} className="input mt-1 w-full" />
        </label>
        <div className="sm:col-span-3">
          <button disabled={packagePending} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{packagePending ? "Saving…" : "Save access package"}</button>
          <p className="mt-1 text-[11px] text-slate-500">Saving resets the student's usage count to zero starting now. Leave a field blank for unlimited/no expiry.</p>
        </div>
      </form>
      {packageState.error && <p role="alert" className="mt-2 text-xs font-bold text-red-700">{packageState.error}</p>}
      {packageState.success && <p className="mt-2 text-xs font-bold text-green-700">{packageState.success}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={lockAction} onSubmit={(event) => { if (!confirm(accessLocked ? "Unlock this student's test access?" : "Lock this student out of taking new tests? Their account can still sign in.")) event.preventDefault(); }}>
          <input type="hidden" name="studentId" value={studentId} />
          <input type="hidden" name="locked" value={String(!accessLocked)} />
          <button disabled={lockPending} className={`rounded-lg px-4 py-2 text-sm font-black disabled:opacity-60 ${accessLocked ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-red-100 text-red-800 hover:bg-red-200"}`}>{lockPending ? "Saving…" : accessLocked ? "Unlock test access" : "Lock test access"}</button>
        </form>
        <form action={clearAction} onSubmit={(event) => { if (!confirm("Clear this student's access package back to blank (unlimited/no expiry/no grace) and lock the seat? The account itself, and their results history, are not touched -- re-configure a new package to reactivate.")) event.preventDefault(); }}>
          <input type="hidden" name="studentId" value={studentId} />
          <button disabled={clearPending} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-black text-slate-800 hover:bg-slate-300 disabled:opacity-60">{clearPending ? "Clearing…" : "Clear seat"}</button>
        </form>
      </div>
      {lockState.error && <p role="alert" className="mt-2 text-xs font-bold text-red-700">{lockState.error}</p>}
      {lockState.success && <p className="mt-2 text-xs font-bold text-green-700">{lockState.success}</p>}
      {clearState.error && <p role="alert" className="mt-2 text-xs font-bold text-red-700">{clearState.error}</p>}
      {clearState.success && <p className="mt-2 text-xs font-bold text-green-700">{clearState.success}</p>}

      <form action={classInfoAction} className="mt-5 border-t border-slate-200 pt-4">
        <input type="hidden" name="studentId" value={studentId} />
        <label className="text-xs font-bold text-slate-600">Class info<span className="ml-1 font-normal text-slate-400">(your own label, e.g. &quot;LDC&quot; or &quot;Batch 2&quot;)</span>
          <div className="mt-1 flex gap-2"><input name="classInfo" defaultValue={classInfo ?? ""} placeholder="Not set" className="input w-full" maxLength={80} /><button disabled={classInfoPending} className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{classInfoPending ? "Saving…" : "Save"}</button></div>
        </label>
      </form>
      {classInfoState.error && <p role="alert" className="mt-2 text-xs font-bold text-red-700">{classInfoState.error}</p>}
      {classInfoState.success && <p className="mt-2 text-xs font-bold text-green-700">{classInfoState.success}</p>}

      <form action={freePracticeAction} className="mt-5 border-t border-slate-200 pt-4">
        <input type="hidden" name="studentId" value={studentId} />
        <label className="text-xs font-bold text-slate-600">Free practice tests allowed<span className="ml-1 font-normal text-slate-400">(platform default is 50; blank = unlimited)</span>
          <div className="mt-1 flex gap-2"><input name="freePracticeLimit" type="number" min="0" defaultValue={freePracticeLimit ?? ""} placeholder="50" className="input w-full" /><button disabled={freePracticePending} className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{freePracticePending ? "Saving…" : "Save"}</button></div>
        </label>
        <p className="mt-1 text-[11px] text-slate-500">Once used up, &quot;Take Tests&quot; (practice mode only -- exam/stenography/learning tests are unaffected) shows a Buy Now paywall instead of the test.</p>
      </form>
      {freePracticeState.error && <p role="alert" className="mt-2 text-xs font-bold text-red-700">{freePracticeState.error}</p>}
      {freePracticeState.success && <p className="mt-2 text-xs font-bold text-green-700">{freePracticeState.success}</p>}

      <form action={passwordAction} className="mt-5 border-t border-slate-200 pt-4" onSubmit={(event) => {
        if (!confirm("Set this student's password directly? This bypasses the reset-link flow -- only use it if they're genuinely locked out of their email too.")) { event.preventDefault(); return; }
        const typed = new FormData(event.currentTarget).get("password");
        setLastSetPassword(typeof typed === "string" && typed ? typed : null);
      }}>
        <input type="hidden" name="studentId" value={studentId} />
        <label className="text-xs font-bold text-slate-600">Set password directly<span className="ml-1 font-normal text-slate-400">(optional -- leave blank to do nothing)</span>
          <div className="mt-1 flex gap-2"><PasswordInput name="password" placeholder="New password (min. 8 characters)" className="input w-full" minLength={8} autoComplete="new-password" /><button disabled={passwordPending} className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-black text-white hover:bg-amber-700 disabled:opacity-60">{passwordPending ? "Saving…" : "Set password"}</button></div>
        </label>
        <p className="mt-1 text-[11px] text-slate-500">Prefer &quot;Send password reset link&quot; above for routine use -- this sets the password immediately without the student confirming it themselves.</p>
      </form>
      {passwordState.error && <p role="alert" className="mt-2 text-xs font-bold text-red-700">{passwordState.error}</p>}
      {passwordState.success && (
        <div className="mt-2 rounded-lg bg-green-50 p-3">
          <p className="text-xs font-bold text-green-700">{passwordState.success}</p>
          {lastSetPassword && <p className="mt-1 text-xs text-slate-700">Give the student: <code className="rounded bg-white px-1.5 py-0.5 font-mono font-bold text-slate-900 select-all">{lastSetPassword}</code></p>}
        </div>
      )}
    </div>
  );
}
