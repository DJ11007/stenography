"use client";

import { useActionState, useState } from "react";
import type { CharacterPoolLanguage } from "@/lib/character-pool-content";
import { saveCharacterPoolConfig, type CharacterPoolActionState } from "./actions";

const KD = '"Kruti Dev 010", "Nirmala UI", sans-serif';
const LANGUAGE_LABEL: Record<CharacterPoolLanguage, string> = { hindi: "Hindi", english: "English" };

const initial: CharacterPoolActionState = {};

export function CharacterPoolManager({ language, allKeys, initialKeys }: { language: CharacterPoolLanguage; allKeys: string[]; initialKeys: string[] }) {
  // Ordered on purpose (not a Set) -- WordTris's Character mode plays
  // this list back in exactly this sequence once it's been customized.
  const [ordered, setOrdered] = useState<string[]>(initialKeys);
  const [state, action] = useActionState(saveCharacterPoolConfig, initial);
  const fontFamily = language === "hindi" ? KD : undefined;
  const available = allKeys.filter((key) => !ordered.includes(key));

  const add = (key: string) => setOrdered((prev) => [...prev, key]);
  const remove = (index: number) => setOrdered((prev) => prev.filter((_, i) => i !== index));
  const move = (index: number, delta: number) => setOrdered((prev) => {
    const next = [...prev];
    const target = index + delta;
    if (target < 0 || target >= next.length) return prev;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const resetToDefault = () => setOrdered([...allKeys]);

  return (
    <form action={action} className="rounded-2xl bg-white p-5 shadow-sm">
      <input type="hidden" name="language" value={language} />
      {ordered.map((key) => <input key={key} type="hidden" name="key" value={key} />)}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-black text-slate-950">{LANGUAGE_LABEL[language]}</h2>
        <button type="button" onClick={resetToDefault} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50">Reset to every key (random order)</button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {ordered.length} of {allKeys.length} keys. {ordered.length > 0 ? "WordTris drills them in this exact order once saved (Key Hunter still adapts on its own)." : "Empty means every key, in random order, same as before this page existed."}
      </p>

      <p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-500">Drill order</p>
      {ordered.length === 0 && <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">No keys yet -- add some below, or Save an empty list to go back to every key.</p>}
      <ol className="mt-2 space-y-1.5">
        {ordered.map((key, index) => (
          <li key={key} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
            <span className="w-6 text-right text-xs font-bold text-slate-400">{index + 1}.</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-md border-2 border-blue-600 bg-blue-50 text-base font-black text-blue-900" style={{ fontFamily }}>{key}</span>
            <span className="flex-1" />
            <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded border border-slate-200 px-2 py-1 text-xs font-black text-slate-600 disabled:opacity-30">↑</button>
            <button type="button" onClick={() => move(index, 1)} disabled={index === ordered.length - 1} className="rounded border border-slate-200 px-2 py-1 text-xs font-black text-slate-600 disabled:opacity-30">↓</button>
            <button type="button" onClick={() => remove(index)} className="rounded border border-red-200 px-2 py-1 text-xs font-black text-red-700 hover:bg-red-50">Remove</button>
          </li>
        ))}
      </ol>

      {available.length > 0 && (
        <>
          <p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-500">Add a key (appends to the end)</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {available.map((key) => (
              <button key={key} type="button" onClick={() => add(key)} className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50 text-sm font-black text-slate-500 hover:border-blue-400 hover:text-blue-800" style={{ fontFamily }}>{key}</button>
            ))}
          </div>
        </>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800">Save</button>
        {state.error && <p role="alert" className="text-sm font-bold text-red-700">{state.error}</p>}
        {state.success && <p role="status" className="text-sm font-bold text-green-700">{state.success}</p>}
      </div>
    </form>
  );
}
