"use client";

import { useActionState, useState } from "react";
import type { CharacterPoolLanguage } from "@/lib/character-pool-content";
import { saveCharacterPoolConfig, type CharacterPoolActionState } from "./actions";

const KD = '"Kruti Dev 010", "Nirmala UI", sans-serif';
const LANGUAGE_LABEL: Record<CharacterPoolLanguage, string> = { hindi: "Hindi", english: "English" };

const initial: CharacterPoolActionState = {};

export function CharacterPoolManager({ language, allKeys, enabledKeys }: { language: CharacterPoolLanguage; allKeys: string[]; enabledKeys: string[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set(enabledKeys));
  const [state, action] = useActionState(saveCharacterPoolConfig, initial);
  const fontFamily = language === "hindi" ? KD : undefined;

  const toggle = (key: string) => setChecked((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <form action={action} className="rounded-2xl bg-white p-5 shadow-sm">
      <input type="hidden" name="language" value={language} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-black text-slate-950">{LANGUAGE_LABEL[language]}</h2>
        <div className="flex gap-2 text-xs font-bold text-slate-600">
          <button type="button" onClick={() => setChecked(new Set(allKeys))} className="rounded-lg border border-slate-200 px-2.5 py-1 hover:bg-slate-50">Select all</button>
          <button type="button" onClick={() => setChecked(new Set())} className="rounded-lg border border-slate-200 px-2.5 py-1 hover:bg-slate-50">Select none</button>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">{checked.size} of {allKeys.length} keys selected. Selecting none resets back to every key.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {allKeys.map((key) => (
          <label key={key} className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border-2 text-base font-black transition ${checked.has(key) ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-200 bg-slate-50 text-slate-400"}`} style={{ fontFamily }}>
            <input type="checkbox" name="key" value={key} checked={checked.has(key)} onChange={() => toggle(key)} className="sr-only" />
            {key}
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800">Save</button>
        {state.error && <p role="alert" className="text-sm font-bold text-red-700">{state.error}</p>}
        {state.success && <p role="status" className="text-sm font-bold text-green-700">{state.success}</p>}
      </div>
    </form>
  );
}
