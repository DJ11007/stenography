"use client";

import { useRef, useState } from "react";

// Excel's Scale spin box (PAGE LAYOUT > Scale to Fit > Scale, and Page Setup > Page > Adjust to): type any value --
// 88, 88%, 57 % -- and it is applied on Enter or when leaving the box, kept within 10%-400%; the arrows (and the
// Up / Down keys) step 5%. It used to apply every keystroke and refuse anything below 10, so typing "88" never got
// past the first "8".

import { MAX_SCALE, MIN_SCALE, parseScale } from "@/lib/excel-scale";

export function PercentSpinBox({ value, onCommit, disabled, label, id, showPercent = true, className = "" }: {
  value: number; onCommit: (value: number) => void; disabled?: boolean; label: string; id?: string; showPercent?: boolean; className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // Clicking in selects the whole value, so what is typed replaces it (the click's mouse-up would otherwise drop the
  // selection and "88" would be added after "100": 10088 -> 400%).
  const justFocused = useRef(false);
  const shown = draft ?? (showPercent ? `${value}%` : String(value));
  const commit = (text: string) => { const next = parseScale(text); setDraft(null); if (next !== null && next !== value) onCommit(next); };
  const step = (delta: number) => { const base = draft !== null ? parseScale(draft) ?? value : value; setDraft(null); const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, base + delta)); if (next !== value) onCommit(next); };
  return (
    <span className={`inline-flex h-[20px] items-stretch border border-[#c6c6c6] bg-white ${disabled ? "opacity-60" : ""} ${className}`}>
      <input id={id} aria-label={label} type="text" inputMode="decimal" disabled={disabled} value={shown}
        onFocus={(event) => { setDraft(String(value)); justFocused.current = true; const input = event.target; requestAnimationFrame(() => input.select()); }}
        onMouseUp={(event) => { if (justFocused.current) { event.preventDefault(); event.currentTarget.select(); justFocused.current = false; } }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); commit(event.currentTarget.value); event.currentTarget.blur(); }
          else if (event.key === "Escape") { event.preventDefault(); setDraft(null); event.currentTarget.blur(); }
          else if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); step(event.key === "ArrowUp" ? 5 : -5); }
        }}
        className="w-full min-w-0 bg-transparent px-1 text-[12px] outline-none disabled:text-slate-400" />
      <span className="flex flex-col border-l border-[#c6c6c6]">
        <button type="button" tabIndex={-1} aria-label={`${label} up`} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => step(5)} className="flex h-1/2 w-3.5 items-center justify-center text-[7px] leading-none hover:bg-[#d5e1f2] disabled:hover:bg-transparent">▲</button>
        <button type="button" tabIndex={-1} aria-label={`${label} down`} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => step(-5)} className="flex h-1/2 w-3.5 items-center justify-center text-[7px] leading-none hover:bg-[#d5e1f2] disabled:hover:bg-transparent">▼</button>
      </span>
    </span>
  );
}
