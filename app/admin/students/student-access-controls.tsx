"use client";

import { useActionState } from "react";
import { setStudentAccessLocked, setStudentAccessPackage, type StudentActionState } from "./actions";

const initial: StudentActionState = {};

export function StudentAccessControls({ studentId, testLimit, validityDays, graceDays, accessLocked }: { studentId: string; testLimit: number | null; validityDays: number | null; graceDays: number; accessLocked: boolean }) {
  const [packageState, packageAction, packagePending] = useActionState(setStudentAccessPackage, initial);
  const [lockState, lockAction, lockPending] = useActionState(setStudentAccessLocked, initial);

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

      <form action={lockAction} className="mt-4" onSubmit={(event) => { if (!confirm(accessLocked ? "Unlock this student's test access?" : "Lock this student out of taking new tests? Their account can still sign in.")) event.preventDefault(); }}>
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="locked" value={String(!accessLocked)} />
        <button disabled={lockPending} className={`rounded-lg px-4 py-2 text-sm font-black disabled:opacity-60 ${accessLocked ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-red-100 text-red-800 hover:bg-red-200"}`}>{lockPending ? "Saving…" : accessLocked ? "Unlock test access" : "Lock test access"}</button>
      </form>
      {lockState.error && <p role="alert" className="mt-2 text-xs font-bold text-red-700">{lockState.error}</p>}
      {lockState.success && <p className="mt-2 text-xs font-bold text-green-700">{lockState.success}</p>}
    </div>
  );
}
