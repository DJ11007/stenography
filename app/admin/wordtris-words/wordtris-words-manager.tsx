"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { detectHindiTextFormat, toTypeableKrutiDev } from "@/lib/hindi-font-converter";
import { CATEGORIES, wordtrisPoints, type WordtrisCategory, type WordtrisLanguage } from "@/lib/wordtris-content";
import { deleteWordtrisWord, saveWordtrisWord, type WordtrisWordActionState } from "./actions";

type Row = {
  id: string;
  language: WordtrisLanguage;
  category: WordtrisCategory;
  word: string;
  is_published: boolean;
  krutidev?: string;
};

const initial: WordtrisWordActionState = {};
const HI = '"Nirmala UI", "Noto Sans Devanagari", system-ui, sans-serif';
const KD = '"Kruti Dev 010", "Nirmala UI", sans-serif';
const LANGUAGE_LABEL: Record<WordtrisLanguage, string> = { hindi: "Hindi", english: "English" };

function Feedback({ state }: { state: WordtrisWordActionState }) {
  if (!state.error && !state.success) return null;
  return <p role="status" className={`mt-2 text-sm font-bold ${state.error ? "text-red-700" : "text-green-700"}`}>{state.error ?? state.success}</p>;
}

export function WordtrisWordsManager({ rows, dbReady = true }: { rows: Row[]; dbReady?: boolean }) {
  const [editing, setEditing] = useState<Row | { language: WordtrisLanguage; category: WordtrisCategory } | null>(null);
  const [liveWord, setLiveWord] = useState("");
  const [liveLanguage, setLiveLanguage] = useState<WordtrisLanguage>("hindi");
  const [saveState, saveAction, savePending] = useActionState(saveWordtrisWord, initial);
  const [deleteState, deleteAction] = useActionState(deleteWordtrisWord, initial);

  const livePreview = useMemo(() => {
    if (liveLanguage !== "hindi" || !liveWord.trim()) return "";
    try {
      return toTypeableKrutiDev(liveWord);
    } catch {
      return "";
    }
  }, [liveWord, liveLanguage]);

  // Real reported bug: an admin, thinking in Kruti Dev keystrokes (their
  // day-to-day typing skill), typed the raw legacy keys for "घोड़ा" straight
  // into this Unicode-only Word field instead of the actual Hindi word --
  // and mistyped the keystrokes too (missing one key). toTypeableKrutiDev
  // has no way to tell "this was never Unicode to begin with" from "this
  // is a real Unicode word" -- it just ran its own literal-punctuation
  // safety remapping (a real "?" is legacy ध् and needed escaping) on text
  // that was never punctuation at all, producing student-preview garbage
  // that decoded to a different, wrong word entirely. This field only
  // ever makes sense as real Hindi Unicode text (unlike the main passage
  // editor elsewhere, which deliberately accepts either format) -- so
  // anything that doesn't detect as Unicode is always a mistake here, and
  // is worth blocking before it reaches the word bank a hundred students
  // will see.
  const hindiWordWarning = liveLanguage === "hindi" && liveWord.trim() && detectHindiTextFormat(liveWord) !== "unicode"
    ? "This doesn't look like a real Hindi word -- it looks like raw Kruti Dev keystrokes were typed here instead. Type or paste the actual Hindi word (e.g. घोड़ा), not the keys a student would press to type it."
    : null;

  const draft = editing && "id" in editing ? editing : null;

  useEffect(() => {
    if (saveState.success) setEditing(null);
  }, [saveState]);

  useEffect(() => {
    if (!editing) return;
    setLiveWord(editing && "id" in editing ? editing.word : "");
    setLiveLanguage(editing.language);
  }, [editing]);

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
      {(["hindi", "english"] as const).map((language) => (
        <div key={language}>
          <h2 className="text-lg font-black text-slate-950">{LANGUAGE_LABEL[language]}</h2>
          <div className="mt-3 space-y-6">
            {CATEGORIES.map((category) => {
              const groupRows = rows.filter((row) => row.language === language && row.category === category.id);
              return (
                <section key={category.id}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-slate-800">
                      {category.en} <span className="font-normal text-slate-500">({groupRows.length})</span>
                    </h3>
                    {dbReady && <button type="button" onClick={() => setEditing({ language, category: category.id })} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800">+ New word</button>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {groupRows.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">No words yet.</p>}
                    {groupRows.map((row) => (
                      <div key={row.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <span className="font-bold text-slate-900" style={{ fontFamily: language === "hindi" ? HI : undefined }}>{row.word}</span>
                        <span className="text-xs text-slate-400">+{wordtrisPoints(row.word)}</span>
                        {row.krutidev && <span className="text-lg text-slate-500" style={{ fontFamily: KD }} title="What students type — Kruti Dev 010">{row.krutidev}</span>}
                        {!row.is_published && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">Hidden</span>}
                        {dbReady && (
                          <>
                            <button type="button" onClick={() => setEditing(row)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-black hover:bg-slate-50">Edit</button>
                            <form action={deleteAction} onSubmit={(event) => { if (!confirm(`Delete "${row.word}"?`)) event.preventDefault(); }}>
                              <input type="hidden" name="id" value={row.id} />
                              <button type="submit" className="rounded-lg border border-red-200 px-2 py-1 text-xs font-black text-red-700 hover:bg-red-50">Delete</button>
                            </form>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ))}

      <Feedback state={deleteState} />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center" onMouseDown={() => setEditing(null)} role="presentation">
          <form
            action={saveAction}
            key={draft?.id ?? `new-${editing.language}-${editing.category}`}
            onMouseDown={(event) => event.stopPropagation()}
            className="my-8 grid w-full max-w-md gap-3 rounded-xl border border-blue-200 bg-white p-5 shadow-2xl"
          >
            <input type="hidden" name="id" value={draft?.id ?? ""} />
            <p className="text-sm font-black text-slate-900">{draft ? "Edit" : "New"} word</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold text-slate-600">Language
                <select name="language" defaultValue={editing.language} onChange={(event) => setLiveLanguage(event.target.value as WordtrisLanguage)} className="input mt-1 w-full">
                  <option value="hindi">Hindi</option>
                  <option value="english">English</option>
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600">Category
                <select name="category" defaultValue={editing.category} className="input mt-1 w-full">
                  {CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.en}</option>)}
                </select>
              </label>
            </div>
            <label className="text-xs font-bold text-slate-600">Word
              <input name="word" value={liveWord} onChange={(event) => setLiveWord(event.target.value)} required maxLength={40} className="input mt-1 w-full" style={{ fontFamily: liveLanguage === "hindi" ? HI : undefined }} />
            </label>
            {hindiWordWarning && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800">{hindiWordWarning}</p>}
            {liveLanguage === "hindi" && (
              <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-xs font-bold text-slate-500">Student preview — Kruti Dev 010</p>
                <p className="mt-1 min-h-9 text-2xl leading-loose text-slate-900" style={{ fontFamily: KD }}>{livePreview}</p>
              </div>
            )}
            <p className="text-xs font-bold text-slate-500">Points awarded: <span className="text-slate-900">+{wordtrisPoints(liveWord || "")}</span> (longer words are worth more)</p>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <input type="checkbox" name="isPublished" defaultChecked={draft?.is_published ?? true} /> Published (shown to students)
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={savePending || Boolean(hindiWordWarning)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-60">{savePending ? "Saving…" : "Save"}</button>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black hover:bg-slate-50">Cancel</button>
            </div>
            <Feedback state={saveState} />
          </form>
        </div>
      )}
    </div>
  );
}
