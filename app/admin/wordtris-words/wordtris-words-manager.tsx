"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { detectHindiTextFormat, krutiDevToUnicode, toTypeableKrutiDev } from "@/lib/hindi-font-converter";
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

  // Real reported bug (original fix, since revised -- see below): an
  // admin, thinking in Kruti Dev keystrokes (their day-to-day typing
  // skill), typed the raw legacy keys for "घोड़ा" straight into this Word
  // field -- and mistyped the keystrokes too (missing one key). The field
  // used to hard-block anything that didn't detect as Unicode text,
  // forcing the admin to type the real Hindi word directly instead.
  //
  // Real requested follow-up: the admin's actual, day-to-day typing skill
  // IS Kruti Dev keystrokes -- blocking that workflow entirely was more
  // friction than protection. Now: any detected non-Unicode input (krudev
  // keystrokes, or -- like the original bad report, "?ksM+k" -- keystrokes
  // that don't even match the LEGACY_SIGNAL heuristic and detect as merely
  // "unknown") is decoded via krutiDevToUnicode into the real Hindi word,
  // which becomes what's actually saved (see the hidden "word" input
  // below) and what drives both the points calculation and the "Student
  // preview" panel. The original safety net -- catching a mistyped
  // keystroke before it reaches the word bank -- is preserved differently:
  // the decoded word is shown prominently (hindiWordNote below) so a typo
  // is still visually catchable by a Hindi-literate admin, just without
  // forcing them to type Unicode text by hand.
  const detectedFormat = liveLanguage === "hindi" ? detectHindiTextFormat(liveWord) : "unicode";
  const { canonicalWord, conversionError } = useMemo(() => {
    if (liveLanguage !== "hindi" || !liveWord.trim() || detectedFormat === "unicode" || detectedFormat === "empty") {
      return { canonicalWord: liveWord, conversionError: null as string | null };
    }
    try {
      return { canonicalWord: krutiDevToUnicode(liveWord), conversionError: null };
    } catch (err) {
      return { canonicalWord: liveWord, conversionError: err instanceof Error ? err.message : "Couldn't convert these Kruti Dev keystrokes." };
    }
  }, [liveWord, liveLanguage, detectedFormat]);

  const livePreview = useMemo(() => {
    if (liveLanguage !== "hindi" || !canonicalWord.trim()) return "";
    try {
      return toTypeableKrutiDev(canonicalWord);
    } catch {
      return "";
    }
  }, [canonicalWord, liveLanguage]);

  const hindiWordNote = liveLanguage === "hindi" && liveWord.trim()
    ? conversionError
      ? { tone: "error" as const, message: `Couldn't convert these Kruti Dev keystrokes: ${conversionError}. Check the spelling and try again.` }
      : detectedFormat === "mixed"
      ? { tone: "warn" as const, message: `This looks like a mix of Kruti Dev keys and Hindi Unicode text -- double-check the word below is exactly right before saving.` }
      : detectedFormat !== "unicode"
      ? { tone: "info" as const, message: `Detected Kruti Dev keystrokes -- will save as the Hindi word "${canonicalWord}". Check it's exactly right before saving.` }
      : null
    : null;

  const draft = editing && "id" in editing ? editing : null;

  // Real reported bug: opening the edit dialog for one word (e.g. a
  // pre-existing bad entry stored as raw Kruti Dev keystrokes, "ek")
  // showed a green "Word saved." message alongside the red validation
  // warning -- looking exactly like the invalid word had just been
  // saved, even though Save was correctly disabled the whole time.
  // saveState/saveAction live in this parent component, not the dialog
  // itself, so a SUCCESS message from an earlier save (of a completely
  // different word, in an earlier open/close of this same dialog) stays
  // truthy and gets rendered again the instant any new dialog opens --
  // useActionState has no way to "clear" that state short of dispatching
  // another action. Track whether THIS dialog has actually submitted;
  // only show feedback once it has, and reset that flag every time a
  // (possibly different) dialog opens.
  const [dialogSubmitted, setDialogSubmitted] = useState(false);

  useEffect(() => {
    if (saveState.success) setEditing(null);
  }, [saveState]);

  useEffect(() => {
    if (!editing) return;
    setLiveWord(editing && "id" in editing ? editing.word : "");
    setLiveLanguage(editing.language);
    setDialogSubmitted(false);
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
            onSubmit={() => setDialogSubmitted(true)}
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
            <label className="text-xs font-bold text-slate-600">Word {liveLanguage === "hindi" && <span className="font-normal text-slate-400">(type the Hindi word, or its Kruti Dev keystrokes)</span>}
              <input value={liveWord} onChange={(event) => setLiveWord(event.target.value)} required maxLength={40} className="input mt-1 w-full" style={{ fontFamily: liveLanguage === "hindi" ? (detectedFormat !== "unicode" ? KD : HI) : undefined }} />
            </label>
            <input type="hidden" name="word" value={canonicalWord} />
            {hindiWordNote && (
              <p role={hindiWordNote.tone === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm font-bold ${hindiWordNote.tone === "error" ? "bg-red-50 text-red-800" : hindiWordNote.tone === "warn" ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"}`}>{hindiWordNote.message}</p>
            )}
            {liveLanguage === "hindi" && (
              <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-xs font-bold text-slate-500">Hindi word that will be saved</p>
                <p className="mt-1 min-h-9 text-2xl leading-loose text-slate-900" style={{ fontFamily: HI }}>{canonicalWord}</p>
                <p className="mt-2 text-xs font-bold text-slate-500">Student preview — Kruti Dev 010</p>
                <p className="mt-1 min-h-9 text-2xl leading-loose text-slate-900" style={{ fontFamily: KD }}>{livePreview}</p>
              </div>
            )}
            <p className="text-xs font-bold text-slate-500">Points awarded: <span className="text-slate-900">+{wordtrisPoints(canonicalWord || "")}</span> (longer words are worth more)</p>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <input type="checkbox" name="isPublished" defaultChecked={draft?.is_published ?? true} /> Published (shown to students)
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={savePending || Boolean(conversionError)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-60">{savePending ? "Saving…" : "Save"}</button>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black hover:bg-slate-50">Cancel</button>
            </div>
            {dialogSubmitted && <Feedback state={saveState} />}
          </form>
        </div>
      )}
    </div>
  );
}
