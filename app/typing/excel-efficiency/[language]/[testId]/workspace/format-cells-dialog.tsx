"use client";
import { useState } from "react";
import type { SheetCell } from "@/lib/excel-document";
import type { BorderStyle } from "@/lib/excel-sheet-model";

// Excel 2013's Format Cells dialog (Ctrl+1, right-click > Format Cells..., the ↘ launchers of the Font,
// Alignment and Number groups): Number, Alignment, Font, Border, Fill and Protection tabs, applied with OK.
export type FormatCellsTab = "Number" | "Alignment" | "Font" | "Border" | "Fill" | "Protection";
export type FormatCellsResult = { patch: Partial<SheetCell>; border: BorderStyle | null; merge: boolean | null };

const FONTS = ["Calibri Light (Headings)", "Calibri (Body)", "Agency FB", "Algerian", "Arial", "Arial Black", "Arial Narrow", "Cambria", "Comic Sans MS", "Courier New", "Georgia", "Kruti Dev 010", "Mangal", "Segoe UI", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana"];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
const COLORS: [string, string][] = [["000000", "Black"], ["FFFFFF", "White"], ["C00000", "Dark Red"], ["FF0000", "Red"], ["FFC000", "Orange"], ["FFFF00", "Yellow"], ["92D050", "Light Green"], ["00B050", "Green"], ["00B0F0", "Light Blue"], ["0070C0", "Blue"], ["002060", "Dark Blue"], ["7030A0", "Purple"], ["E7E6E6", "Gray"], ["44546A", "Blue-Gray"], ["4472C4", "Blue, Accent 1"], ["ED7D31", "Orange, Accent 2"], ["A5A5A5", "Gray, Accent 3"], ["5B9BD5", "Blue, Accent 5"], ["70AD47", "Green, Accent 6"], ["F2F2F2", "White, Darker 5%"]];
const fontName = (stored: string | null | undefined) => stored ?? "Calibri";
const listFont = (font: string) => (font === "Calibri (Body)" ? "Calibri" : font === "Calibri Light (Headings)" ? "Calibri Light" : font);

export function FormatCellsDialog({ cell, merged, initialTab, onOk, onCancel }: { cell: SheetCell; merged: boolean; initialTab: FormatCellsTab; onOk: (result: FormatCellsResult) => void; onCancel: () => void }) {
  const [tab, setTab] = useState<FormatCellsTab>(initialTab);
  const [numberFormat, setNumberFormat] = useState<SheetCell["numberFormat"]>(cell.numberFormat ?? "General");
  const [decimals, setDecimals] = useState<number>(cell.decimals ?? 2);
  const [horizontal, setHorizontal] = useState<string>(cell.align ?? "general");
  const [vertical, setVertical] = useState<string>(cell.vAlign ?? "bottom");
  const [indent, setIndent] = useState<number>(cell.indent ?? 0);
  const [wrap, setWrap] = useState(Boolean(cell.wrap));
  const [merge, setMerge] = useState(merged);
  const [rotate, setRotate] = useState<number>(cell.rotate ?? 0);
  const [font, setFont] = useState(fontName(cell.fontFamily));
  const [style, setStyle] = useState(cell.bold && cell.italic ? "Bold Italic" : cell.bold ? "Bold" : cell.italic ? "Italic" : "Regular");
  const [size, setSize] = useState(String(cell.fontSize ?? 11));
  const [underline, setUnderline] = useState(cell.underline ? "Single" : "None");
  const [color, setColor] = useState<string | null>(cell.fontColor ?? null);
  const [strike, setStrike] = useState(Boolean(cell.strike));
  const [border, setBorder] = useState<BorderStyle | null>(null);
  const [fill, setFill] = useState<string | null>(cell.fillColor ?? null);

  const ok = () => {
    const sizeNumber = Number(size);
    onOk({
      patch: {
        numberFormat, decimals: numberFormat === "General" ? null : decimals,
        align: horizontal === "general" ? null : (horizontal as SheetCell["align"]), vAlign: vertical === "bottom" ? null : (vertical as SheetCell["vAlign"]),
        indent: indent || null, wrap: wrap || null, rotate: rotate || null,
        fontFamily: font === "Calibri" ? null : font, bold: style.includes("Bold"), italic: style.includes("Italic"),
        fontSize: Number.isFinite(sizeNumber) && sizeNumber >= 1 && sizeNumber <= 409 && sizeNumber !== 11 ? sizeNumber : null,
        underline: underline !== "None", fontColor: color, strike: strike || null, fillColor: fill,
      },
      border, merge: merge === merged ? null : merge,
    });
  };
  const previewStyle = { fontFamily: font, fontWeight: style.includes("Bold") ? 700 : 400, fontStyle: style.includes("Italic") ? "italic" : "normal", textDecoration: [underline !== "None" && "underline", strike && "line-through"].filter(Boolean).join(" ") || undefined, color: color ? `#${color}` : undefined, fontSize: `${Math.min(28, Math.max(8, Number(size) || 11)) * 1.2}px` };

  return (
    <div role="presentation" className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/30 p-4" onMouseDown={onCancel}>
      <div role="dialog" aria-modal="true" aria-label="Format Cells" onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") onCancel(); if (event.key === "Enter" && (event.target as HTMLElement).tagName !== "BUTTON") { event.preventDefault(); ok(); } }} className="w-full max-w-[520px] border border-slate-400 bg-[#f0f0f0] text-[12px] text-slate-900 shadow-2xl">
        <div className="flex items-center justify-between bg-white px-3 py-1.5"><span>Format Cells</span><span className="flex gap-3"><span aria-hidden className="text-slate-400">?</span><button type="button" onClick={onCancel} aria-label="Close">✕</button></span></div>
        <div role="tablist" className="flex gap-0.5 px-2 pt-2">
          {(["Number", "Alignment", "Font", "Border", "Fill", "Protection"] as FormatCellsTab[]).map((name) => (
            <button key={name} type="button" role="tab" aria-selected={tab === name} disabled={name === "Protection"} onClick={() => setTab(name)} className={`border border-b-0 px-3 py-1 ${tab === name ? "border-slate-400 bg-white" : "border-slate-300 bg-[#f0f0f0] text-slate-700"} disabled:text-slate-400`}>{name}</button>
          ))}
        </div>
        <div className="mx-2 min-h-[330px] border border-slate-400 bg-white p-3">
          {tab === "Number" && (
            <div className="grid grid-cols-[150px_1fr] gap-3">
              <label className="grid gap-1">Category:
                <select size={6} aria-label="Category" value={numberFormat} onChange={(event) => setNumberFormat(event.target.value as SheetCell["numberFormat"])} className="h-40 border border-slate-400">
                  {(["General", "Number", "Currency", "Percentage"] as const).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <div className="grid content-start gap-2">
                <fieldset className="border border-slate-300 p-2"><legend className="px-1">Sample</legend><span>{numberFormat === "Currency" ? `₹1,234.${"0".repeat(decimals)}`.replace(/\.$/, "") : numberFormat === "Percentage" ? `12.${"0".repeat(decimals)}%`.replace(/\.%$/, "%") : numberFormat === "Number" ? `1,234.${"0".repeat(decimals)}`.replace(/\.$/, "") : "1234"}</span></fieldset>
                {numberFormat !== "General" && <label className="flex items-center gap-2">Decimal places: <input type="number" aria-label="Decimal places" min={0} max={10} value={decimals} onChange={(event) => setDecimals(Math.min(10, Math.max(0, Number(event.target.value) || 0)))} className="w-14 border border-slate-400 px-1" /></label>}
                <p className="text-slate-600">{numberFormat === "General" ? "General format cells have no specific number format." : numberFormat === "Number" ? "Number is used for general display of numbers." : numberFormat === "Currency" ? "Currency formats are used for general monetary values." : "Percentage formats multiply the cell value by 100 and display the result with a percent symbol."}</p>
              </div>
            </div>
          )}
          {tab === "Alignment" && (
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div className="grid content-start gap-2">
                <fieldset className="grid gap-2 border-t border-slate-300 pt-1"><legend className="pr-2">Text alignment</legend>
                  <label className="grid gap-1">Horizontal:<select aria-label="Horizontal" value={horizontal} onChange={(event) => setHorizontal(event.target.value)} className="w-40 border border-slate-400"><option value="general">General</option><option value="left">Left (Indent)</option><option value="center">Center</option><option value="right">Right (Indent)</option></select></label>
                  <label className="flex items-center gap-2">Indent: <input type="number" aria-label="Indent" min={0} max={15} value={indent} onChange={(event) => setIndent(Math.min(15, Math.max(0, Number(event.target.value) || 0)))} className="w-14 border border-slate-400 px-1" /></label>
                  <label className="grid gap-1">Vertical:<select aria-label="Vertical" value={vertical} onChange={(event) => setVertical(event.target.value)} className="w-40 border border-slate-400"><option value="top">Top</option><option value="middle">Center</option><option value="bottom">Bottom</option></select></label>
                </fieldset>
                <fieldset className="grid gap-1 border-t border-slate-300 pt-1"><legend className="pr-2">Text control</legend>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={wrap} onChange={(event) => setWrap(event.target.checked)} />Wrap text</label>
                  <label className="flex items-center gap-2 text-slate-400"><input type="checkbox" disabled />Shrink to fit</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={merge} onChange={(event) => setMerge(event.target.checked)} />Merge cells</label>
                </fieldset>
              </div>
              <fieldset className="grid content-start gap-2 border border-slate-300 p-2"><legend className="px-1">Orientation</legend>
                <button type="button" aria-pressed={rotate === 255} onClick={() => setRotate(rotate === 255 ? 0 : 255)} className={`border px-1 py-2 leading-3 ${rotate === 255 ? "border-[#217346] bg-[#d5ead9]" : "border-slate-300"}`}>T<br />e<br />x<br />t</button>
                <label className="flex items-center gap-1"><input type="number" aria-label="Degrees" min={-90} max={90} value={rotate === 255 ? 0 : rotate} onChange={(event) => setRotate(Math.min(90, Math.max(-90, Number(event.target.value) || 0)))} className="w-14 border border-slate-400 px-1" />Degrees</label>
              </fieldset>
            </div>
          )}
          {tab === "Font" && (
            <div className="grid gap-2">
              <div className="grid grid-cols-[1fr_130px_80px] gap-2">
                <label className="grid gap-1">Font:<input aria-label="Font" value={font} onChange={(event) => setFont(event.target.value)} className="border border-slate-400 px-1" /><select size={6} aria-label="Font list" value={font} onChange={(event) => setFont(listFont(event.target.value))} className="h-24 border border-slate-400">{FONTS.map((name) => <option key={name} value={listFont(name)} style={{ fontFamily: listFont(name) }}>{name}</option>)}</select></label>
                <label className="grid gap-1">Font style:<input aria-label="Font style" value={style} readOnly className="border border-slate-400 px-1" /><select size={4} aria-label="Font style list" value={style} onChange={(event) => setStyle(event.target.value)} className="h-24 border border-slate-400">{["Regular", "Italic", "Bold", "Bold Italic"].map((name) => <option key={name}>{name}</option>)}</select></label>
                <label className="grid gap-1">Size:<input aria-label="Size" value={size} onChange={(event) => setSize(event.target.value)} className="border border-slate-400 px-1" /><select size={6} aria-label="Size list" value={size} onChange={(event) => setSize(event.target.value)} className="h-24 border border-slate-400">{SIZES.map((value) => <option key={value} value={String(value)}>{value}</option>)}</select></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">Underline:<select aria-label="Underline" value={underline} onChange={(event) => setUnderline(event.target.value)} className="border border-slate-400"><option>None</option><option>Single</option></select></label>
                <label className="grid gap-1">Color:<select aria-label="Color" value={color ?? ""} onChange={(event) => setColor(event.target.value || null)} className="border border-slate-400"><option value="">Automatic</option>{COLORS.map(([hex, name]) => <option key={hex} value={hex}>{name}</option>)}</select></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <fieldset className="grid gap-1 border border-slate-300 p-2"><legend className="px-1">Effects</legend>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={strike} onChange={(event) => setStrike(event.target.checked)} />Strikethrough</label>
                  <label className="flex items-center gap-2 text-slate-400"><input type="checkbox" disabled />Superscript</label>
                  <label className="flex items-center gap-2 text-slate-400"><input type="checkbox" disabled />Subscript</label>
                </fieldset>
                <fieldset className="border border-slate-300 p-2"><legend className="px-1">Preview</legend><div className="grid h-14 place-items-center border border-slate-300 bg-white" style={previewStyle}>AaBbCcYyZz</div></fieldset>
              </div>
            </div>
          )}
          {tab === "Border" && (
            <div className="grid gap-3">
              <p className="font-semibold">Presets</p>
              <div className="flex gap-4">
                {([["none", "None"], ["outside", "Outline"], ["all", "Inside"]] as [BorderStyle, string][]).map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={border === value} onClick={() => setBorder(value)} className={`grid w-16 justify-items-center gap-1 border p-1 ${border === value ? "border-[#217346] bg-[#d5ead9]" : "border-transparent"}`}>
                    <span className="h-10 w-10 border border-slate-400" style={{ borderWidth: value === "none" ? 1 : 2, borderStyle: value === "none" ? "dotted" : "solid", backgroundImage: value === "all" ? "linear-gradient(#475569,#475569),linear-gradient(#475569,#475569)" : undefined, backgroundSize: "1px 100%, 100% 1px", backgroundPosition: "center", backgroundRepeat: "no-repeat" }} />
                    {label}
                  </button>
                ))}
              </div>
              <p className="font-semibold">Border</p>
              <div className="flex flex-wrap gap-2">
                {([["top", "Top"], ["bottom", "Bottom"], ["left", "Left"], ["right", "Right"], ["thickBox", "Thick Box"]] as [BorderStyle, string][]).map(([value, label]) => <button key={value} type="button" aria-pressed={border === value} onClick={() => setBorder(value)} className={`border px-2 py-1 ${border === value ? "border-[#217346] bg-[#d5ead9]" : "border-slate-300 bg-white"}`}>{label}</button>)}
              </div>
              <p className="text-slate-600">The selected border style can be applied by clicking the presets or the buttons above.</p>
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
    </div>
  );
}
