"use client";
import { useActionState, useState } from "react";
import { permanentlyDeleteManagedTest, type PermanentDeleteState } from "./actions";

const initialState: PermanentDeleteState = {};

// Only rendered for a test that actually has attempts -- that's the exact
// case where the ordinary "Delete" button (test-manager.tsx's TestRow) is
// disabled and does nothing. This is the deliberate, safeguarded way to
// remove one anyway: type the title, tick the acknowledgement, submit.
export function PermanentDeleteDangerZone({ testId, title, attemptCount }: { testId: string; title: string; attemptCount: number }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(permanentlyDeleteManagedTest, initialState);
  const valid = typed === title && acknowledged;
  if (state.result) return <p role="status" className="mt-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">Permanently deleted &quot;{state.result.title}&quot; ({state.result.mode}) -- {state.result.versionCount} version{state.result.versionCount===1?"":"s"}, {state.result.attemptCount} attempt{state.result.attemptCount===1?"":"s"}{state.result.audioFileCount?`, ${state.result.audioFileCount} dictation audio file${state.result.audioFileCount===1?"":"s"}`:""} destroyed.</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-bold text-red-700">Permanently delete…</button>;
  return <section className="col-span-2 mt-3 rounded-2xl border-2 border-red-300 bg-red-50 p-4" aria-labelledby={`danger-${testId}`}>
    <h4 id={`danger-${testId}`} className="font-black text-red-900">Danger Zone · Permanently Delete</h4>
    <p className="mt-1 text-sm font-bold text-red-800">This cannot be undone. It will destroy {attemptCount} attempt{attemptCount===1?"":"s"}, every saved version, and any dictation audio -- Archive is the recommended reversible action instead.</p>
    <form action={action} className="mt-4 grid gap-3">
      <input type="hidden" name="testId" value={testId} />
      <input type="hidden" name="requestId" value={requestId} />
      <label className="grid gap-1 text-sm font-black text-red-950"><span>Type the exact test title: <span className="select-all">{title}</span></span><input className="input border-red-300" name="typedTitle" autoComplete="off" value={typed} onChange={(event) => setTyped(event.target.value)} aria-describedby={`delete-help-${testId}`} /></label>
      <label className="flex items-start gap-2 text-sm font-bold text-red-950"><input className="mt-1" type="checkbox" name="destroyAcknowledged" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>I understand that all attempts, versions, and dictation audio for this test will be permanently destroyed.</span></label>
      <p id={`delete-help-${testId}`} className="text-xs text-red-700">Both confirmations are required. Submission is protected against duplicate requests.</p>
      {state.error && <p role="alert" className="rounded-lg bg-red-100 p-3 text-sm font-bold text-red-800">{state.error}</p>}
      <div className="flex gap-2"><button type="submit" disabled={!valid || pending} aria-disabled={!valid || pending} className="rounded-xl bg-red-800 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">{pending ? "Permanently deleting…" : "Permanently delete test and all data"}</button><button type="button" onClick={() => setOpen(false)} className="rounded-xl border px-4 py-3 font-bold text-slate-700">Cancel</button></div>
    </form>
  </section>;
}
