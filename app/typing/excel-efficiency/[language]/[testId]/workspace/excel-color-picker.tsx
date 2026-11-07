"use client";
import { useEffect, useRef, useState } from "react";
import { STANDARD_COLORS, THEME_COLORS } from "./excel-colors";
import { MoreColorsDialog } from "./excel-dialogs-more";

// Excel 2013's colour drop-down inside dialogs (Format Cells: Font colour, Border line colour): a box showing the
// picked colour, opening Automatic, Theme Colors (the ten colours, then their tints and shades), Standard Colors and
// More Colors... Every swatch carries its Excel name (shown on hover, read out by screen readers).
export function ExcelColorPicker({ label, value, onChange, className = "" }: { label: string; value: string | null; onChange: (hex: string | null) => void; className?: string }) {
  const [open, setOpen] = useState(false), [moreColors, setMoreColors] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!boxRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const pick = (hex: string | null) => { onChange(hex); setOpen(false); };
  const name = value ? [...THEME_COLORS.flat().map(({ hex, name }) => [hex, name] as const), ...STANDARD_COLORS].find(([hex]) => hex === value)?.[1] ?? `#${value}` : "Automatic";
  const swatch = (hex: string, swatchName: string, key: string) => (
    <button key={key} type="button" role="option" aria-selected={value === hex} aria-label={swatchName} title={swatchName} onClick={() => pick(hex)}
      className={`h-3.5 w-3.5 border ${value === hex ? "outline outline-2 outline-[#f29436]" : "border-slate-300 hover:outline hover:outline-1 hover:outline-[#f29436]"}`} style={{ backgroundColor: `#${hex}` }} />
  );
  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <button type="button" aria-label={`${label}: ${name}`} title={name} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} onKeyDown={(event) => { if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); } }}
        className="flex h-6 w-full items-center justify-between border border-slate-400 bg-white px-1">
        <span className="h-3.5 flex-1 border border-slate-400" style={{ backgroundColor: `#${value ?? "000000"}` }} />
        <span aria-hidden className="ml-1 border-l border-slate-300 pl-1 text-[9px]">▼</span>
      </button>
      {open && (
        <div role="listbox" aria-label={label} className="absolute left-0 top-7 z-10 w-[214px] border border-slate-400 bg-white text-[#262626] shadow-lg" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); } }}>
          <button type="button" role="option" aria-selected={value === null} onClick={() => pick(null)} className={`m-1 flex w-[calc(100%-8px)] items-center gap-2 border px-1 py-0.5 ${value === null ? "border-[#f29436] bg-[#fde9d3]" : "border-transparent hover:border-[#f29436] hover:bg-[#fde9d3]"}`}><span className="h-3.5 w-3.5 border border-slate-500 bg-black" />Automatic</button>
          <p className="bg-[#f0f0f0] px-2 py-0.5 font-semibold text-[#444]">Theme Colors</p>
          <div className="grid gap-1 p-1.5">
            {THEME_COLORS.map((row, r) => (
              <div key={r} className={`grid grid-cols-11 gap-[3px] ${r === 0 ? "mb-1" : ""}`}>{row.map(({ hex, name: swatchName }) => swatch(hex, swatchName, hex + r))}</div>
            ))}
          </div>
          <p className="bg-[#f0f0f0] px-2 py-0.5 font-semibold text-[#444]">Standard Colors</p>
          <div className="grid grid-cols-11 gap-[3px] p-1.5">{STANDARD_COLORS.map(([hex, swatchName]) => swatch(hex, swatchName, hex))}</div>
          <button type="button" onClick={() => { setOpen(false); setMoreColors(true); }} className="flex w-full items-center gap-2 border-t border-slate-200 px-2 py-1 text-left hover:bg-[#fde9d3]">
            <svg aria-hidden viewBox="0 0 16 16" width="14" height="14"><path d="M8 8V1a7 7 0 0 1 6.06 3.5z" fill="#e8463a" /><path d="M8 8l6.06-3.5a7 7 0 0 1 0 7z" fill="#f6b026" /><path d="M8 8l6.06 3.5A7 7 0 0 1 8 15z" fill="#5cb85c" /><path d="M8 8v7a7 7 0 0 1-6.06-3.5z" fill="#3b8ed8" /><path d="M8 8L1.94 11.5a7 7 0 0 1 0-7z" fill="#7d5ec4" /><path d="M8 8L1.94 4.5A7 7 0 0 1 8 1z" fill="#e05ab0" /></svg>
            <span><u>M</u>ore Colors...</span>
          </button>
        </div>
      )}
      {moreColors && <MoreColorsDialog title="Colors" initial={value} onCancel={() => setMoreColors(false)} onOk={(hex) => { onChange(hex.toUpperCase()); setMoreColors(false); }} />}
    </div>
  );
}
