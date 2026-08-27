"use client";
import { useActionState, useState } from "react";
import { deleteClassroomUpdate, saveClassroomUpdate, setLiveClassLink, type ClassroomActionState } from "./actions";

type UpdateRow = { id: string; title: string; body: string; is_published: boolean; display_order: number; created_at: string };
type LiveClassRow = { url: string | null; is_active: boolean };

const initial: ClassroomActionState = {};

function FeedbackMessage({ state }: { state: ClassroomActionState }) {
  if (!state.error && !state.success) return null;
  return <p role="status" className={`mt-2 text-sm font-bold ${state.error ? "text-red-700" : "text-green-700"}`}>{state.error ?? state.success}</p>;
}

export function ClassroomManager({ updates, liveClass }: { updates: UpdateRow[]; liveClass: LiveClassRow }) {
  const [liveState, liveAction, livePending] = useActionState(setLiveClassLink, initial);
  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-green-200 bg-green-50/40 p-5">
        <h2 className="font-black text-green-900">Live Class</h2>
        <form action={liveAction} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input name="url" type="url" defaultValue={liveClass.url ?? ""} placeholder="https://meet.google.com/…" className="input"/>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="isActive" defaultChecked={liveClass.is_active}/> Active</label>
          <button type="submit" disabled={livePending} className="sm:col-span-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-black text-white hover:bg-green-800 disabled:opacity-60">{livePending ? "Saving…" : "Save live class"}</button>
        </form>
        <FeedbackMessage state={liveState}/>
      </section>
      <UpdatesSection rows={updates}/>
    </div>
  );
}

function UpdatesSection({ rows }: { rows: UpdateRow[] }) {
  const [editing, setEditing] = useState<UpdateRow | "new" | null>(null);
  const [state, action, pending] = useActionState(saveClassroomUpdate, initial);
  const [deleteState, deleteAction] = useActionState(deleteClassroomUpdate, initial);
  const draft = editing === "new" ? null : editing;
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-black text-slate-950">Updates</h2>
        <button type="button" onClick={() => setEditing("new")} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800">+ New Update</button>
      </div>
      <div className="mt-4 grid gap-3">
        {rows.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No updates found.</p>}
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-black">{row.title}{!row.is_published && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">Hidden</span>}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(row)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black hover:bg-slate-50">Edit</button>
                <form action={deleteAction}><input type="hidden" name="id" value={row.id}/><button type="submit" className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-black text-red-700 hover:bg-red-50">Delete</button></form>
              </div>
            </div>
            <p className="mt-1 text-sm text-slate-600">{row.body}</p>
          </div>
        ))}
      </div>
      <FeedbackMessage state={deleteState}/>
      {editing && (
        <form action={action} key={typeof editing === "string" ? "new" : editing.id} className="mt-5 grid gap-3 rounded-xl border border-blue-200 bg-blue-50/40 p-5">
          <input type="hidden" name="id" value={draft?.id ?? ""}/>
          <label className="text-xs font-bold">Title<input name="title" defaultValue={draft?.title ?? ""} className="input mt-1 w-full" required/></label>
          <label className="text-xs font-bold">Message<textarea name="body" defaultValue={draft?.body ?? ""} rows={3} className="input mt-1 w-full"/></label>
          <label className="text-xs font-bold">Display order<input name="displayOrder" type="number" defaultValue={draft?.display_order ?? 0} className="input mt-1 w-full"/></label>
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" name="isPublished" defaultChecked={draft?.is_published ?? true}/> Published</label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black hover:bg-slate-50">Cancel</button>
          </div>
          <FeedbackMessage state={state}/>
        </form>
      )}
    </section>
  );
}
