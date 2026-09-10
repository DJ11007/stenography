"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toTypeableKrutiDev } from "@/lib/hindi-font-converter";
import { deleteKrutiDevExercise, saveKrutiDevExercise, type KrutiDevLessonActionState } from "./actions";

type Row = {
  id: string;
  kind: "key-lesson" | "word-set" | "paragraph";
  title: string;
  content: string;
  focus_keys: string | null;
  is_published: boolean;
  display_order: number;
  krutidev?: string;
};

const initial: KrutiDevLessonActionState = {};

const KIND_LABEL: Record<Row["kind"], string> = {
  "key-lesson": "Key drill",
  "word-set": "Word set",
  paragraph: "Paragraph",
};
const KIND_HINT: Record<Row["kind"], string> = {
  "key-lesson": "One drill line per line. Physical keys go in the Focus keys box (e.g. d j).",
  "word-set": "Words separated by spaces or new lines.",
  paragraph: "The full paragraph as one block of text.",
};
const HI = '"Nirmala UI", "Noto Sans Devanagari", system-ui, sans-serif';
const KD = '"Kruti Dev 010", "Nirmala UI", sans-serif';

function Feedback({ state }: { state: KrutiDevLessonActionState }) {
  if (!state.error && !state.success) return null;
  return <p role="status" className={`mt-2 text-sm font-bold ${state.error ? "text-red-700" : "text-green-700"}`}>{state.error ?? state.success}</p>;
}

export function KrutiDevLessonsManager({ rows, dbReady = true }: { rows: Row[]; dbReady?: boolean }) {
  const [editing, setEditing] = useState<Row | { kind: Row["kind"] } | null>(null);
  const [liveContent, setLiveContent] = useState("");
  const [saveState, saveAction, savePending] = useActionState(saveKrutiDevExercise, initial);
  const [deleteState, deleteAction] = useActionState(deleteKrutiDevExercise, initial);

  const livePreview = useMemo(() => {
    if (!liveContent.trim()) return "";
    try {
      return toTypeableKrutiDev(liveContent);
    } catch {
      return "";
    }
  }, [liveContent]);

  const groups: Row["kind"][] = ["key-lesson", "word-set", "paragraph"];
  const draft = editing && "id" in editing ? editing : null;
  const editingKind = editing ? editing.kind : null;

  // Close the editor once a save succeeds (the list revalidates on the server).
  useEffect(() => {
    if (saveState.success) setEditing(null);
  }, [saveState]);

  // Seed the live Kruti Dev preview from whatever is being edited.
  useEffect(() => {
    setLiveContent(editing && "id" in editing ? editing.content : "");
  }, [editing]);

  // Escape closes the editor; lock background scroll while it is open.
  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditing(null);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [editing]);

  return (
    <div className="space-y-8">
      {groups.map((kind) => {
        const groupRows = rows.filter((row) => row.kind === kind);
        return (
          <section key={kind}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-slate-950">{KIND_LABEL[kind]}s <span className="font-normal text-slate-500">({groupRows.length})</span></h2>
              {dbReady && <button type="button" onClick={() => setEditing({ kind })} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800">+ New {KIND_LABEL[kind]}</button>}
            </div>
            <div className="mt-3 grid gap-2">
              {groupRows.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">None yet — the bundled defaults are shown to students until you add one.</p>}
              {groupRows.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black text-slate-900" style={{ fontFamily: HI }}>
                      #{row.display_order} · {row.title}
                      {!row.is_published && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">Hidden</span>}
                    </p>
                    {dbReady && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setEditing(row)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black hover:bg-slate-50">Edit</button>
                        <form action={deleteAction} onSubmit={(event) => { if (!confirm(`Delete "${row.title}"?`)) event.preventDefault(); }}>
                          <input type="hidden" name="id" value={row.id} />
                          <button type="submit" className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-black text-red-700 hover:bg-red-50">Delete</button>
                        </form>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-slate-600" style={{ fontFamily: HI }}>{row.content}</p>
                  {row.krutidev && (
                    <p
                      className="mt-2 line-clamp-2 whitespace-pre-wrap border-t border-dashed border-slate-200 pt-2 text-2xl leading-loose text-slate-800"
                      style={{ fontFamily: KD }}
                      title="What students see — Kruti Dev 010"
                    >
                      {row.krutidev}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <Feedback state={deleteState} />

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
          onMouseDown={() => setEditing(null)}
          role="presentation"
        >
        <form
          action={saveAction}
          key={draft?.id ?? `new-${editingKind}`}
          onMouseDown={(event) => event.stopPropagation()}
          className="my-8 grid w-full max-w-xl gap-3 rounded-xl border border-blue-200 bg-white p-5 shadow-2xl"
        >
          <input type="hidden" name="id" value={draft?.id ?? ""} />
          <p className="text-sm font-black text-slate-900">{draft ? "Edit" : "New"} {KIND_LABEL[editingKind as Row["kind"]]}</p>
          <label className="text-xs font-bold text-slate-600">Type
            <select name="kind" defaultValue={editingKind ?? "word-set"} className="input mt-1 w-full">
              <option value="key-lesson">Key drill</option>
              <option value="word-set">Word set</option>
              <option value="paragraph">Paragraph</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">Title (Hindi)
            <input name="title" defaultValue={draft?.title ?? ""} required maxLength={120} className="input mt-1 w-full" style={{ fontFamily: HI }} />
          </label>
          <label className="text-xs font-bold text-slate-600">Content (Unicode Hindi)
            <span className="ml-1 font-normal text-slate-400">— {editingKind ? KIND_HINT[editingKind] : ""}</span>
            <textarea name="content" value={liveContent} onChange={(event) => setLiveContent(event.target.value)} rows={8} required className="input mt-1 w-full font-normal" style={{ fontFamily: HI }} />
          </label>
          <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="text-xs font-bold text-slate-500">Student preview — Kruti Dev 010</p>
            <p className="mt-1 max-h-48 min-h-9 overflow-y-auto whitespace-pre-wrap text-2xl leading-loose text-slate-900" style={{ fontFamily: KD }}>{livePreview}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold text-slate-600">Focus keys <span className="font-normal text-slate-400">(key drills only)</span>
              <input name="focusKeys" defaultValue={draft?.focus_keys ?? ""} placeholder="d j" className="input mt-1 w-full" />
            </label>
            <label className="text-xs font-bold text-slate-600">Order
              <input name="displayOrder" type="number" defaultValue={draft?.display_order ?? 0} className="input mt-1 w-full" />
            </label>
            <label className="mt-5 flex items-center gap-2 text-xs font-bold text-slate-600">
              <input type="checkbox" name="isPublished" defaultChecked={draft?.is_published ?? true} /> Published (shown to students)
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={savePending} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-60">{savePending ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black hover:bg-slate-50">Cancel</button>
          </div>
          <Feedback state={saveState} />
        </form>
        </div>
      )}
    </div>
  );
}
