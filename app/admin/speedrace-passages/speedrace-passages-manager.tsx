"use client";

import { useActionState, useEffect, useState } from "react";
import { detectHindiTextFormat } from "@/lib/hindi-font-converter";
import { saveSpeedRacePassage, deleteSpeedRacePassage, type SpeedRacePassageActionState } from "./actions";

type Row = { id: string; language: "hindi" | "english"; title: string; passage: string; is_published: boolean };

const initial: SpeedRacePassageActionState = {};
const HI = '"Nirmala UI", "Noto Sans Devanagari", system-ui, sans-serif';
const LANGUAGE_LABEL: Record<"hindi" | "english", string> = { hindi: "Hindi", english: "English" };

function Feedback({ state }: { state: SpeedRacePassageActionState }) {
  if (!state.error && !state.success) return null;
  return <p role="status" className={`mt-2 text-sm font-bold ${state.error ? "text-red-700" : "text-green-700"}`}>{state.error ?? state.success}</p>;
}

export function SpeedRacePassagesManager({ rows }: { rows: Row[] }) {
  const [editing, setEditing] = useState<Row | { language: "hindi" | "english" } | null>(null);
  const [liveLanguage, setLiveLanguage] = useState<"hindi" | "english">("english");
  const [livePassage, setLivePassage] = useState("");
  const [saveState, saveAction, savePending] = useActionState(saveSpeedRacePassage, initial);
  const [deleteState, deleteAction] = useActionState(deleteSpeedRacePassage, initial);
  // Real reported bug precedent (WordTris word manager, same session):
  // saveState lives here, not inside the dialog, so a success message
  // from an EARLIER save stayed truthy and re-rendered the instant any
  // new dialog opened, looking exactly like the just-opened (unsaved)
  // passage had been saved. Only show feedback once THIS dialog has
  // actually submitted, reset every time a (possibly different) dialog
  // opens.
  const [dialogSubmitted, setDialogSubmitted] = useState(false);

  const draft = editing && "id" in editing ? editing : null;

  const hindiPassageWarning = liveLanguage === "hindi" && livePassage.trim() && detectHindiTextFormat(livePassage) === "krutidev"
    ? "This doesn't look like real Hindi text -- it looks like raw Kruti Dev keystrokes were typed here instead. Type or paste the actual Hindi passage, not the keys a student would press to type it."
    : null;

  useEffect(() => {
    if (saveState.success) setEditing(null);
  }, [saveState]);

  useEffect(() => {
    if (!editing) return;
    setLiveLanguage(editing.language);
    setLivePassage(editing && "id" in editing ? editing.passage : "");
    setDialogSubmitted(false);
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setEditing(null); };
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
      {(["english", "hindi"] as const).map((language) => {
        const groupRows = rows.filter((row) => row.language === language);
        return (
          <div key={language}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-950">
                {LANGUAGE_LABEL[language]} <span className="font-normal text-slate-500">({groupRows.length})</span>
              </h2>
              <button type="button" onClick={() => setEditing({ language })} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800">+ New passage</button>
            </div>
            <div className="mt-3 space-y-2">
              {groupRows.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">No passages yet -- students get an auto-generated passage from the word bank until you add one.</p>}
              {groupRows.map((row) => (
                <div key={row.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-slate-900">{row.title}</p>
                    <p className="mt-0.5 truncate text-sm text-slate-500" style={{ fontFamily: language === "hindi" ? HI : undefined }}>{row.passage}</p>
                  </div>
                  {!row.is_published && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">Hidden</span>}
                  <button type="button" onClick={() => setEditing(row)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black hover:bg-slate-50">Edit</button>
                  <form action={deleteAction} onSubmit={(event) => { if (!confirm(`Delete "${row.title}"?`)) event.preventDefault(); }}>
                    <input type="hidden" name="id" value={row.id} />
                    <button type="submit" className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-black text-red-700 hover:bg-red-50">Delete</button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <Feedback state={deleteState} />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center" onMouseDown={() => setEditing(null)} role="presentation">
          <form
            action={saveAction}
            onSubmit={() => setDialogSubmitted(true)}
            key={draft?.id ?? `new-${editing.language}`}
            onMouseDown={(event) => event.stopPropagation()}
            className="my-8 grid w-full max-w-lg gap-3 rounded-xl border border-blue-200 bg-white p-5 shadow-2xl"
          >
            <input type="hidden" name="id" value={draft?.id ?? ""} />
            <p className="text-sm font-black text-slate-900">{draft ? "Edit" : "New"} passage</p>
            <label className="text-xs font-bold text-slate-600">Language
              <select name="language" defaultValue={editing.language} onChange={(event) => setLiveLanguage(event.target.value as "hindi" | "english")} className="input mt-1 w-full">
                <option value="english">English</option>
                <option value="hindi">Hindi</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">Title
              <input name="title" defaultValue={draft?.title ?? ""} required maxLength={80} className="input mt-1 w-full" placeholder="e.g. Legal terms, paragraph 1" />
            </label>
            <label className="text-xs font-bold text-slate-600">Passage
              <textarea name="passage" value={livePassage} onChange={(event) => setLivePassage(event.target.value)} required rows={6} className="input mt-1 w-full leading-7" style={{ fontFamily: liveLanguage === "hindi" ? HI : undefined }} placeholder="Write the full passage students will type." />
            </label>
            {hindiPassageWarning && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800">{hindiPassageWarning}</p>}
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <input type="checkbox" name="isPublished" defaultChecked={draft?.is_published ?? true} /> Published (students can choose it)
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={savePending || Boolean(hindiPassageWarning)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-60">{savePending ? "Saving…" : "Save"}</button>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black hover:bg-slate-50">Cancel</button>
            </div>
            {dialogSubmitted && <Feedback state={saveState} />}
          </form>
        </div>
      )}
    </div>
  );
}
