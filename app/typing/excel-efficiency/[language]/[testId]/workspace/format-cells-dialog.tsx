"use client";
import { useRef, useState } from "react";
import { CURRENCIES, type CurrencySymbol, type SheetCell, type UnderlineStyle } from "@/lib/excel-document";
import { formatCellValue } from "@/lib/excel-sheet-model";
import { FormatCellsBorderTab, type BorderLines } from "./format-cells-border-tab";
import { useDialogDrag } from "./excel-dialogs";
import { ExcelColorPicker } from "./excel-color-picker";

// Excel 2013's Format Cells dialog (Ctrl+1, right-click > Format Cells..., the ↘ launchers of the Font,
// Alignment and Number groups): Number, Alignment, Font, Border, Fill and Protection tabs, applied with OK.
export type FormatCellsTab = "Number" | "Alignment" | "Font" | "Border" | "Fill" | "Protection";
// borderLines: only the Border tab lines the student changed (null = removed); the rest of each cell's border stays.
export type FormatCellsResult = { patch: Partial<SheetCell>; borderLines: BorderLines; merge: boolean | null };
const CATEGORIES: [SheetCell["numberFormat"], string, string][] = [
  ["General", "General", "General format cells have no specific number format."],
  ["Number", "Number", "Number is used for general display of numbers."],
  ["Currency", "Currency", "Currency formats are used for general monetary values."],
  ["Accounting", "Accounting", "Accounting formats line up the currency symbols and decimal points in a column."],
  ["ShortDate", "Date", "Date formats display date and time serial numbers as date values."],
  ["Time", "Time", "Time formats display date and time serial numbers as time values."],
  ["Percentage", "Percentage", "Percentage formats multiply the cell value by 100 and display the result with a percent symbol."],
  ["Fraction", "Fraction", "Fraction formats show the number as a fraction (up to one digit)."],
  ["Scientific", "Scientific", "Scientific formats show the number in exponential notation."],
  ["Text", "Text", "Text format cells are treated as text even when a number is in the cell."],
];
const UNDERLINES: [string, string][] = [["None", "None"], ["single", "Single"], ["double", "Double"], ["singleAccounting", "Single Accounting"], ["doubleAccounting", "Double Accounting"]];

const FONTS = ["Calibri Light (Headings)", "Calibri (Body)", "Agency FB", "Algerian", "Arial", "Arial Black", "Arial Narrow", "Cambria", "Comic Sans MS", "Courier New", "Georgia", "Kruti Dev 010", "Mangal", "Segoe UI", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana"];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
const COLORS: [string, string][] = [["000000", "Black"], ["FFFFFF", "White"], ["C00000", "Dark Red"], ["FF0000", "Red"], ["FFC000", "Orange"], ["FFFF00", "Yellow"], ["92D050", "Light Green"], ["00B050", "Green"], ["00B0F0", "Light Blue"], ["0070C0", "Blue"], ["002060", "Dark Blue"], ["7030A0", "Purple"], ["E7E6E6", "Gray"], ["44546A", "Blue-Gray"], ["4472C4", "Blue, Accent 1"], ["ED7D31", "Orange, Accent 2"], ["A5A5A5", "Gray, Accent 3"], ["5B9BD5", "Blue, Accent 5"], ["70AD47", "Green, Accent 6"], ["F2F2F2", "White, Darker 5%"]];
const fontName = (stored: string | null | undefined) => stored ?? "Calibri";
const listFont = (font: string) => (font === "Calibri (Body)" ? "Calibri" : font === "Calibri Light (Headings)" ? "Calibri Light" : font);

// A number box that can be emptied while typing (Backspace on "0" leaves it blank, ready for a new number), as in
// Excel; the number is kept within min..max, and a blank box counts as 0 and shows 0 again when you leave it.
function NumberBox({ label, value, min, max, onChange, className }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; className?: string }) {
  const [text, setText] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  return (
    <input type="number" aria-label={label} min={min} max={max} value={text ?? String(value)} className={className}
      onChange={(event) => { const typed = event.target.value; setText(typed); const n = Number(typed); onChange(typed.trim() === "" || !Number.isFinite(n) ? clamp(0) : clamp(n)); }}
      onBlur={() => setText(null)} />
  );
}

type DialogValues = {
  numberFormat: SheetCell["numberFormat"]; decimals: number; currency: CurrencySymbol; dateKind: "ShortDate" | "LongDate"; shrink: boolean; vertAlign: SheetCell["vertAlign"];
  locked: boolean; hiddenFormula: boolean; horizontal: string; vertical: string; indent: number; wrap: boolean; rotate: number; font: string; style: string; size: string;
  underline: string; color: string | null; strike: boolean; fill: string | null;
};
function buildPatch(v: DialogValues): Partial<SheetCell> {
  const sizeNumber = Number(v.size);
  return {
    numberFormat: v.numberFormat === "ShortDate" ? v.dateKind : v.numberFormat, decimals: ["General", "ShortDate", "Time", "Fraction", "Text"].includes(v.numberFormat ?? "General") ? null : v.decimals,
    currency: v.numberFormat === "Currency" || v.numberFormat === "Accounting" ? (v.currency === "₹" ? null : v.currency) : null,
    shrink: v.shrink || null, vertAlign: v.vertAlign, locked: v.locked ? null : false, hiddenFormula: v.hiddenFormula || null,
    align: v.horizontal === "general" ? null : (v.horizontal as SheetCell["align"]), vAlign: v.vertical === "bottom" ? null : (v.vertical as SheetCell["vAlign"]),
    indent: v.indent || null, wrap: v.wrap || null, rotate: v.rotate || null,
    fontFamily: v.font === "Calibri" ? null : v.font, bold: v.style.includes("Bold"), italic: v.style.includes("Italic"),
    fontSize: Number.isFinite(sizeNumber) && sizeNumber >= 1 && sizeNumber <= 409 && sizeNumber !== 11 ? sizeNumber : null,
    underline: v.underline !== "None", underlineStyle: v.underline === "None" || v.underline === "single" ? null : (v.underline as UnderlineStyle), fontColor: v.color, strike: v.strike || null, fillColor: v.fill,
  };
}

export function FormatCellsDialog({ cell, merged, initialTab, initialBorders, multiRow, multiCol, onOk, onCancel }: { cell: SheetCell; merged: boolean; initialTab: FormatCellsTab; initialBorders: BorderLines; multiRow: boolean; multiCol: boolean; onOk: (result: FormatCellsResult) => void; onCancel: () => void }) {
  const [tab, setTab] = useState<FormatCellsTab>(initialTab);
  const drag = useDialogDrag();
  const [numberFormat, setNumberFormat] = useState<SheetCell["numberFormat"]>(cell.numberFormat === "LongDate" ? "ShortDate" : cell.numberFormat ?? "General");
  const [decimals, setDecimals] = useState<number>(cell.decimals ?? 2);
  const [horizontal, setHorizontal] = useState<string>(cell.align ?? "general");
  const [vertical, setVertical] = useState<string>(cell.vAlign ?? "bottom");
  const [indent, setIndent] = useState<number>(cell.indent ?? 0);
  const [indentText, setIndentText] = useState<string>(String(cell.indent ?? 0));
  const [invalidIndent, setInvalidIndent] = useState(false);
  const indentRef = useRef<HTMLInputElement>(null);
  const closeInvalidIndent = () => { setInvalidIndent(false); requestAnimationFrame(() => { indentRef.current?.focus(); indentRef.current?.select(); }); };
  const [wrap, setWrap] = useState(Boolean(cell.wrap));
  const [merge, setMerge] = useState(merged);
  const [rotate, setRotate] = useState<number>(cell.rotate ?? 0);
  const [font, setFont] = useState(fontName(cell.fontFamily));
  const [style, setStyle] = useState(cell.bold && cell.italic ? "Bold Italic" : cell.bold ? "Bold" : cell.italic ? "Italic" : "Regular");
  const [size, setSize] = useState(String(cell.fontSize ?? 11));
  const [underline, setUnderline] = useState<string>(cell.underline ? cell.underlineStyle ?? "single" : "None");
  const [vertAlign, setVertAlign] = useState<SheetCell["vertAlign"]>(cell.vertAlign ?? null);
  const [shrink, setShrink] = useState(Boolean(cell.shrink));
  const [currency, setCurrency] = useState<CurrencySymbol>(cell.currency ?? "₹");
  const [dateKind, setDateKind] = useState<"ShortDate" | "LongDate">(cell.numberFormat === "LongDate" ? "LongDate" : "ShortDate");
  const [locked, setLocked] = useState(cell.locked !== false);
  const [hiddenFormula, setHiddenFormula] = useState(Boolean(cell.hiddenFormula));
  const [color, setColor] = useState<string | null>(cell.fontColor ?? null);
  const [strike, setStrike] = useState(Boolean(cell.strike));
  const [borderLines, setBorderLines] = useState<BorderLines>(initialBorders);
  const [fill, setFill] = useState<string | null>(cell.fillColor ?? null);

  // The dialog opens showing the active cell's formatting. As in Excel, OK applies only what was changed in the
  // dialog: every other property of each selected cell stays as it was (a range with different colours, fonts or
  // number formats keeps them when only, say, the alignment is set).
  const [initialValues] = useState(() => ({ numberFormat, decimals, currency, dateKind, shrink, vertAlign, locked, hiddenFormula, horizontal, vertical, indent, wrap, rotate, font, style, size, underline, color, strike, fill }));
  const ok = () => {
    // As in Excel 2013: the indent takes whole numbers only. Typing 0.3 (or nothing) and pressing OK shows
    // "Integer is not valid." and the dialog stays open on the Alignment tab; nothing is applied.
    if (!/^\s*\d+\s*$/.test(indentText)) { setTab("Alignment"); setInvalidIndent(true); return; }
    const current = { numberFormat, decimals, currency, dateKind, shrink, vertAlign, locked, hiddenFormula, horizontal, vertical, indent, wrap, rotate, font, style, size, underline, color, strike, fill };
    const full = buildPatch(current);
    const before = buildPatch(initialValues);
    // Properties that only mean something together are applied together.
    const groups: (keyof SheetCell)[][] = [["numberFormat", "decimals", "currency"], ["bold", "italic"], ["underline", "underlineStyle"]];
    const changed = new Set((Object.keys(full) as (keyof SheetCell)[]).filter((key) => JSON.stringify(full[key]) !== JSON.stringify(before[key])));
    for (const group of groups) if (group.some((key) => changed.has(key))) group.forEach((key) => changed.add(key));
    const patch = Object.fromEntries([...changed].map((key) => [key, full[key]])) as Partial<SheetCell>;
    onOk({
      patch,
      borderLines: Object.fromEntries(Object.entries(borderLines).filter(([edge, line]) => JSON.stringify(line) !== JSON.stringify(initialBorders[edge as keyof BorderLines]))), merge: merge === merged ? null : merge,
    });
  };
  const previewStyle = { fontFamily: font, fontWeight: style.includes("Bold") ? 700 : 400, fontStyle: style.includes("Italic") ? "italic" : "normal", textDecorationLine: [underline !== "None" && "underline", strike && "line-through"].filter(Boolean).join(" ") || undefined, textDecorationStyle: underline.startsWith("double") ? ("double" as const) : undefined, verticalAlign: vertAlign === "superscript" ? "super" : vertAlign === "subscript" ? "sub" : undefined, color: color ? `#${color}` : undefined, fontSize: `${Math.min(28, Math.max(8, Number(size) || 11)) * 1.2}px` };

  return (
    <div role="presentation" className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/30 p-4" onMouseDown={onCancel}>
      <div role="dialog" aria-modal="true" aria-label="Format Cells" onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") onCancel(); if (event.key === "Enter" && (event.target as HTMLElement).tagName !== "BUTTON") { event.preventDefault(); ok(); } }} className="w-full max-w-[540px] border border-slate-400 bg-white text-[12px] text-slate-900 shadow-2xl" style={drag.style}>
        <div onMouseDown={drag.startDrag} className="flex cursor-default select-none items-center justify-between bg-white px-3 py-1.5"><span>Format Cells</span><span className="flex gap-3"><span aria-hidden className="text-slate-400">?</span><button type="button" onClick={onCancel} aria-label="Close">✕</button></span></div>
        <div role="tablist" className="flex gap-0.5 px-2 pt-2">
          {(["Number", "Alignment", "Font", "Border", "Fill", "Protection"] as FormatCellsTab[]).map((name) => (
            <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)} className={`border border-b-0 px-3 py-1 ${tab === name ? "border-slate-400 bg-white" : "border-slate-300 bg-white text-slate-700"} disabled:text-slate-400`}>{name}</button>
          ))}
        </div>
        <div className="mx-2 min-h-[330px] border border-slate-400 bg-white p-3">
          {tab === "Number" && (
            <div className="grid grid-cols-[150px_1fr] gap-3">
              <label className="grid gap-1">Category:
                <select size={10} aria-label="Category" value={numberFormat} onChange={(event) => setNumberFormat(event.target.value as SheetCell["numberFormat"])} className="h-48 border border-slate-400">
                  {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <div className="grid content-start gap-2">
                <fieldset className="border border-slate-300 p-2"><legend className="px-1">Sample</legend><span>{typeof cell.value === "number" ? formatCellValue(cell.value, numberFormat === "ShortDate" ? dateKind : numberFormat, ["General", "ShortDate", "Time", "Fraction", "Text"].includes(numberFormat) ? null : decimals, currency) : formatCellValue(numberFormat === "ShortDate" || numberFormat === "Time" ? 46320.5 : 1234.5, numberFormat === "ShortDate" ? dateKind : numberFormat, ["General", "ShortDate", "Time", "Fraction", "Text"].includes(numberFormat) ? null : decimals, currency)}</span></fieldset>
                {(numberFormat === "Currency" || numberFormat === "Accounting") && <label className="flex items-center gap-2">Symbol: <select aria-label="Symbol" value={currency} onChange={(event) => setCurrency(event.target.value as CurrencySymbol)} className="border border-slate-400">{CURRENCIES.map(([symbol, label]) => <option key={symbol} value={symbol}>{label}</option>)}</select></label>}
                {numberFormat === "ShortDate" && <label className="grid gap-1">Type:<select size={2} aria-label="Date type" value={dateKind} onChange={(event) => setDateKind(event.target.value as typeof dateKind)} className="border border-slate-400"><option value="ShortDate">25-10-2026</option><option value="LongDate">Sunday, 25 October, 2026</option></select></label>}
                {!["General", "ShortDate", "Time", "Fraction", "Text"].includes(numberFormat) && <label className="flex items-center gap-2">Decimal places: <NumberBox label="Decimal places" min={0} max={10} value={decimals} onChange={setDecimals} className="w-14 border border-slate-400 px-1" /></label>}
                <p className="text-slate-600">{CATEGORIES.find(([value]) => value === numberFormat)?.[2]}</p>
              </div>
            </div>
          )}
          {tab === "Alignment" && (
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div className="grid content-start gap-2">
                <fieldset className="grid gap-2 border-t border-slate-300 pt-1"><legend className="pr-2">Text alignment</legend>
                  <label className="grid gap-1">Horizontal:<select aria-label="Horizontal" value={horizontal} onChange={(event) => setHorizontal(event.target.value)} className="w-40 border border-slate-400"><option value="general">General</option><option value="left">Left (Indent)</option><option value="center">Center</option><option value="right">Right (Indent)</option></select></label>
                  <label className="flex items-center gap-2">Indent: <input ref={indentRef} type="number" aria-label="Indent" min={0} max={15} step={1} value={indentText}
                    onChange={(event) => { const typed = event.target.value; setIndentText(typed); const n = Number(typed); if (/^\s*\d+\s*$/.test(typed)) setIndent(Math.min(15, n)); }}
                    className="w-14 border border-slate-400 px-1" /></label>
                  <label className="grid gap-1">Vertical:<select aria-label="Vertical" value={vertical} onChange={(event) => setVertical(event.target.value)} className="w-40 border border-slate-400"><option value="top">Top</option><option value="middle">Center</option><option value="bottom">Bottom</option></select></label>
                </fieldset>
                <fieldset className="grid gap-1 border-t border-slate-300 pt-1"><legend className="pr-2">Text control</legend>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={wrap} onChange={(event) => setWrap(event.target.checked)} />Wrap text</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={shrink} onChange={(event) => setShrink(event.target.checked)} />Shrink to fit</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={merge} onChange={(event) => setMerge(event.target.checked)} />Merge cells</label>
                </fieldset>
              </div>
              <fieldset className="grid content-start gap-2 border border-slate-300 p-2"><legend className="px-1">Orientation</legend>
                <button type="button" aria-pressed={rotate === 255} onClick={() => setRotate(rotate === 255 ? 0 : 255)} className={`border px-1 py-2 leading-3 ${rotate === 255 ? "border-[#217346] bg-[#d5ead9]" : "border-slate-300"}`}>T<br />e<br />x<br />t</button>
                <label className="flex items-center gap-1"><NumberBox label="Degrees" min={-90} max={90} value={rotate === 255 ? 0 : rotate} onChange={setRotate} className="w-14 border border-slate-400 px-1" />Degrees</label>
              </fieldset>
            </div>
          )}
          {tab === "Font" && (
            <div className="grid gap-2">
              <div className="grid grid-cols-[minmax(0,1fr)_130px_80px] gap-2 [&>label]:min-w-0 [&_input]:w-full [&_input]:min-w-0 [&_select]:w-full [&_select]:min-w-0">
                <label className="grid gap-1">Font:<input aria-label="Font" value={font} onChange={(event) => setFont(event.target.value)} className="border border-slate-400 px-1" /><select size={6} aria-label="Font list" value={font} onChange={(event) => setFont(listFont(event.target.value))} className="h-24 border border-slate-400">{FONTS.map((name) => <option key={name} value={listFont(name)} style={{ fontFamily: listFont(name) }}>{name}</option>)}</select></label>
                <label className="grid gap-1">Font style:<input aria-label="Font style" value={style} readOnly className="border border-slate-400 px-1" /><select size={4} aria-label="Font style list" value={style} onChange={(event) => setStyle(event.target.value)} className="h-24 border border-slate-400">{["Regular", "Italic", "Bold", "Bold Italic"].map((name) => <option key={name}>{name}</option>)}</select></label>
                <label className="grid gap-1">Size:<input aria-label="Size" value={size} onChange={(event) => setSize(event.target.value)} className="border border-slate-400 px-1" /><select size={6} aria-label="Size list" value={size} onChange={(event) => setSize(event.target.value)} className="h-24 border border-slate-400">{SIZES.map((value) => <option key={value} value={String(value)}>{value}</option>)}</select></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">Underline:<select aria-label="Underline" value={underline} onChange={(event) => setUnderline(event.target.value)} className="border border-slate-400">{UNDERLINES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <div className="grid gap-1"><span>Color:</span><ExcelColorPicker label="Color" value={color} onChange={setColor} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <fieldset className="grid gap-1 border border-slate-300 p-2"><legend className="px-1">Effects</legend>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={strike} onChange={(event) => setStrike(event.target.checked)} />Strikethrough</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={vertAlign === "superscript"} onChange={(event) => setVertAlign(event.target.checked ? "superscript" : null)} />Superscript</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={vertAlign === "subscript"} onChange={(event) => setVertAlign(event.target.checked ? "subscript" : null)} />Subscript</label>
                </fieldset>
                <fieldset className="border border-slate-300 p-2"><legend className="px-1">Preview</legend><div className="grid h-14 place-items-center border border-slate-300 bg-white" style={previewStyle}>AaBbCcYyZz</div></fieldset>
              </div>
            </div>
          )}
          {tab === "Border" && <FormatCellsBorderTab lines={borderLines} setLines={setBorderLines} rows={multiRow} cols={multiCol} />}
          {tab === "Protection" && (
            <div className="grid gap-2">
              <label className="flex items-center gap-2"><input type="checkbox" checked={locked} onChange={(event) => setLocked(event.target.checked)} />Locked</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={hiddenFormula} onChange={(event) => setHiddenFormula(event.target.checked)} />Hidden</label>
              <p className="text-slate-600">Locking cells or hiding formulas has no effect until you protect the worksheet (Review tab, Changes group, Protect Sheet button).</p>
            </div>
          )}
          {tab === "Fill" && (
            <div className="grid gap-2">
              <p>Background Color:</p>
              <button type="button" onClick={() => setFill(null)} className={`w-28 border px-2 py-1 ${fill === null ? "border-[#217346] bg-[#d5ead9]" : "border-slate-300"}`}>No Color</button>
              <div className="grid w-60 grid-cols-10 gap-1">{COLORS.map(([hex, name]) => <button key={hex} type="button" aria-label={`${name} (#${hex})`} title={name} onClick={() => setFill(hex)} className={`h-5 w-5 border ${fill === hex ? "outline outline-2 outline-[#217346]" : "border-slate-300"}`} style={{ backgroundColor: `#${hex}` }} />)}</div>
              <p>Sample</p>
              <div className="h-12 border border-slate-300" style={{ backgroundColor: fill ? `#${fill}` : "#fff" }} />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 p-3">
          <button type="button" onClick={ok} className="min-w-20 border border-[#217346] bg-white px-4 py-1">OK</button>
          <button type="button" onClick={onCancel} className="min-w-20 border border-slate-400 bg-white px-4 py-1">Cancel</button>
        </div>
      </div>
      {invalidIndent && (
        <div role="presentation" className="fixed inset-0 z-[95] grid place-items-center" onMouseDown={(event) => event.stopPropagation()}>
          <div role="alertdialog" aria-modal="true" aria-label="Microsoft Excel" onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeInvalidIndent(); } }}
            className="w-[260px] border border-slate-400 bg-white text-[12px] text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between px-3 py-1.5"><span>Microsoft Excel</span><button type="button" onClick={closeInvalidIndent} aria-label="Close">✕</button></div>
            <div className="flex items-center gap-4 px-5 py-4">
              <svg width="30" height="27" viewBox="0 0 30 27" aria-hidden><path d="M15 1 L29 26 H1 Z" fill="#f8c400" stroke="#b58a00" /><rect x="13.6" y="9" width="2.8" height="9" fill="#222" /><rect x="13.6" y="20" width="2.8" height="2.8" fill="#222" /></svg>
              <p>Integer is not valid.</p>
            </div>
            <div className="flex justify-center pb-3"><button type="button" autoFocus onClick={closeInvalidIndent} className="min-w-20 border border-[#217346] bg-white px-4 py-1">OK</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
