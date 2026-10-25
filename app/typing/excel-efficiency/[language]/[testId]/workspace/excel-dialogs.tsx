"use client";
import { useMemo, useState, type ReactNode } from "react";
import { FUNCTION_LIBRARY, type FunctionCategory } from "@/lib/excel-formula";
import { PAPER_SIZES, type ConditionalStyle, type ConditionalType, type HeaderFooter, type PaperSize, type SheetSettings } from "@/lib/excel-document";
import { CONDITIONAL_STYLES } from "@/lib/excel-sheet-model";

// Excel 2013's dialog boxes for the workspace: grey body, white title bar with ? and ✕, OK / Cancel at the
// bottom right. Each returns what the user chose; the editor applies it to the sheet.

export function DialogShell({ title, children, onCancel, footer, width = 420 }: { title: string; children: ReactNode; onCancel: () => void; footer: ReactNode; width?: number }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/20 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[92vh] flex-col border border-[#8a8a8a] bg-[#f0f0f0] text-[12px] text-[#1e1e1e] shadow-2xl" style={{ width }}
        onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onCancel(); } }}>
        <div className="flex items-center justify-between bg-white px-3 py-1.5">
          <span className="text-[13px]">{title}</span>
          <span className="flex items-center gap-3 text-[#555]"><span aria-hidden>?</span><button type="button" onClick={onCancel} aria-label="Close" className="px-1 hover:bg-[#e81123] hover:text-white">✕</button></span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        <div className="flex justify-end gap-2 px-4 pb-3">{footer}</div>
      </div>
    </div>
  );
}
export function DialogButton({ children, onClick, primary, disabled }: { children: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`min-w-[75px] border px-3 py-1 ${primary ? "border-[#3c7fb1] bg-[#e5f1fb]" : "border-[#adadad] bg-[#e1e1e1]"} hover:border-[#0078d7] hover:bg-[#e5f1fb] disabled:opacity-50`}>{children}</button>;
}
const field = "border border-[#adadad] bg-white px-1.5 py-1 outline-none focus:border-[#0078d7]";

// ---------- one value: Row Height, Column Width, Rename, Comment, Protect Sheet, Chart Title ----------
export function InputDialog({ title, label, initial = "", multiline, numeric, min, max, hint, onOk, onCancel }: { title: string; label: string; initial?: string; multiline?: boolean; numeric?: boolean; min?: number; max?: number; hint?: string; onOk: (value: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  const invalid = numeric && (value.trim() === "" || !Number.isFinite(Number(value)) || (min !== undefined && Number(value) < min) || (max !== undefined && Number(value) > max));
  const submit = () => { if (!invalid) onOk(value); };
  return (
    <DialogShell title={title} onCancel={onCancel} width={multiline ? 380 : 300} footer={<><DialogButton primary onClick={submit} disabled={Boolean(invalid)}>OK</DialogButton><DialogButton onClick={onCancel}>Cancel</DialogButton></>}>
      <label className="flex flex-col gap-1.5">{label}
        {multiline ? <textarea autoFocus value={value} maxLength={500} rows={5} onChange={(event) => setValue(event.target.value)} className={`${field} resize-none bg-[#ffffe1]`} />
          : <input autoFocus value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} inputMode={numeric ? "decimal" : undefined} className={field} />}
      </label>
      {hint && <p className="mt-2 text-[11px] text-[#555]">{hint}</p>}
      {invalid && value !== "" && <p className="mt-2 text-[11px] text-[#c00000]">Enter a number{min !== undefined ? ` from ${min}` : ""}{max !== undefined ? ` to ${max}` : ""}.</p>}
    </DialogShell>
  );
}

// ---------- Insert Function ----------
const CATEGORIES: ("Most Recently Used" | "All" | FunctionCategory)[] = ["Most Recently Used", "All", "Financial", "Date & Time", "Math & Trig", "Statistical", "Lookup & Reference", "Text", "Logical"];
const RECENT = ["SUM", "AVERAGE", "IF", "MAX", "MIN", "COUNT", "COUNTIF", "VLOOKUP", "ROUND", "SUMIF"];
export function InsertFunctionDialog({ initialCategory = "Most Recently Used", onOk, onCancel }: { initialCategory?: (typeof CATEGORIES)[number]; onOk: (name: string) => void; onCancel: () => void }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>(initialCategory);
  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term) return FUNCTION_LIBRARY.filter((fn) => fn.name.toLowerCase().includes(term) || fn.description.toLowerCase().includes(term));
    if (category === "Most Recently Used") return RECENT.map((name) => FUNCTION_LIBRARY.find((fn) => fn.name === name)!).filter(Boolean);
    return FUNCTION_LIBRARY.filter((fn) => category === "All" || fn.category === category).sort((a, b) => a.name.localeCompare(b.name));
  }, [search, category]);
  const [picked, setPicked] = useState<string>(list[0]?.name ?? "SUM");
  // The picked function while it is in the list, else the list's first (as Excel highlights after a search).
  const info = list.find((fn) => fn.name === picked) ?? list[0];
  return (
    <DialogShell title="Insert Function" onCancel={onCancel} width={470} footer={<><DialogButton primary onClick={() => info && onOk(info.name)} disabled={!info}>OK</DialogButton><DialogButton onClick={onCancel}>Cancel</DialogButton></>}>
      <label className="block">Search for a function:
        <span className="mt-1 flex gap-2"><input autoFocus value={search} placeholder="Type a brief description of what you want to do and then click Go" onChange={(event) => setSearch(event.target.value)} className={`${field} flex-1`} /><DialogButton onClick={() => setSearch((value) => value.trim())}>Go</DialogButton></span>
      </label>
      <label className="mt-3 flex items-center gap-2">Or select a <u>c</u>ategory:
        <select value={category} onChange={(event) => { setSearch(""); setCategory(event.target.value as typeof category); }} className={field}>{CATEGORIES.map((name) => <option key={name}>{name}</option>)}</select>
      </label>
      <p className="mt-3">Select a functio<u>n</u>:</p>
      <ul role="listbox" aria-label="Functions" className="mt-1 h-40 overflow-y-auto border border-[#adadad] bg-white">
        {list.map((fn) => <li key={fn.name} role="option" aria-selected={fn.name === info?.name} onClick={() => setPicked(fn.name)} onDoubleClick={() => onOk(fn.name)} className={`cursor-default px-1.5 py-0.5 ${fn.name === info?.name ? "bg-[#0078d7] text-white" : "hover:bg-[#e5f1fb]"}`}>{fn.name}</li>)}
        {!list.length && <li className="px-1.5 py-1 text-[#777]">No functions match your search.</li>}
      </ul>
      {info && <div className="mt-3 min-h-[3.5rem]"><p className="font-bold">{info.syntax}</p><p className="mt-1 text-[#333]">{info.description}</p></div>}
    </DialogShell>
  );
}

// ---------- Sort ----------
export type SortChoice = { column: number; descending: boolean; headers: boolean };
export function SortDialog({ columns, defaultHeaders, onOk, onCancel }: { columns: { index: number; letter: string; header: string }[]; defaultHeaders: boolean; onOk: (choice: SortChoice) => void; onCancel: () => void }) {
  const [headers, setHeaders] = useState(defaultHeaders);
  const [column, setColumn] = useState(columns[0]?.index ?? 0);
  const [descending, setDescending] = useState(false);
  return (
    <DialogShell title="Sort" onCancel={onCancel} width={520} footer={<><DialogButton primary onClick={() => onOk({ column, descending, headers })}>OK</DialogButton><DialogButton onClick={onCancel}>Cancel</DialogButton></>}>
      <div className="flex items-center justify-between"><span className="flex gap-1"><span className="border border-[#adadad] bg-[#e1e1e1] px-2 py-0.5">+ Add Level</span><span className="border border-[#adadad] bg-[#e1e1e1] px-2 py-0.5 text-[#999]">✕ Delete Level</span></span>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={headers} onChange={(event) => setHeaders(event.target.checked)} /> My data has <u>h</u>eaders</label></div>
      <div className="mt-3 grid grid-cols-[70px_1fr_1fr_1fr] items-center gap-2 border border-[#adadad] bg-white p-2">
        <span className="font-semibold">Column</span><span className="font-semibold" /><span className="font-semibold">Sort On</span><span className="font-semibold">Order</span>
        <span>Sort by</span>
        <select aria-label="Sort by" value={column} onChange={(event) => setColumn(Number(event.target.value))} className={field}>{columns.map((col) => <option key={col.index} value={col.index}>{headers && col.header ? col.header : `Column ${col.letter}`}</option>)}</select>
        <select aria-label="Sort On" className={field} defaultValue="Values"><option>Values</option></select>
        <select aria-label="Order" value={descending ? "desc" : "asc"} onChange={(event) => setDescending(event.target.value === "desc")} className={field}><option value="asc">A to Z / Smallest to Largest</option><option value="desc">Z to A / Largest to Smallest</option></select>
      </div>
    </DialogShell>
  );
}

// ---------- Conditional Formatting: Highlight Cells Rules ----------
const RULE_TEXT: Record<ConditionalType, { title: string; prompt: string; values: 0 | 1 | 2 }> = {
  greaterThan: { title: "Greater Than", prompt: "Format cells that are GREATER THAN:", values: 1 },
  lessThan: { title: "Less Than", prompt: "Format cells that are LESS THAN:", values: 1 },
  between: { title: "Between", prompt: "Format cells that are BETWEEN:", values: 2 },
  equalTo: { title: "Equal To", prompt: "Format cells that are EQUAL TO:", values: 1 },
  textContains: { title: "Text That Contains", prompt: "Format cells that contain the text:", values: 1 },
  duplicate: { title: "Duplicate Values", prompt: "Format cells that contain:", values: 0 },
  unique: { title: "Duplicate Values", prompt: "Format cells that contain:", values: 0 },
};
export const HIGHLIGHT_RULES: [ConditionalType, string][] = [["greaterThan", "Greater Than..."], ["lessThan", "Less Than..."], ["between", "Between..."], ["equalTo", "Equal To..."], ["textContains", "Text that Contains..."], ["duplicate", "Duplicate Values..."]];
export function ConditionalDialog({ type, onOk, onCancel }: { type: ConditionalType; onOk: (rule: { type: ConditionalType; value?: string | number; value2?: string | number; style: ConditionalStyle }) => void; onCancel: () => void }) {
  const text = RULE_TEXT[type];
  const [value, setValue] = useState(""), [value2, setValue2] = useState("");
  const [style, setStyle] = useState<ConditionalStyle>("lightRedDarkRed");
  const [kind, setKind] = useState<"duplicate" | "unique">(type === "unique" ? "unique" : "duplicate");
  const asValue = (raw: string) => (raw.trim() !== "" && Number.isFinite(Number(raw)) ? Number(raw) : raw);
  const ready = text.values === 0 || (value.trim() !== "" && (text.values === 1 || value2.trim() !== ""));
  const submit = () => { if (!ready) return; onOk(text.values === 0 ? { type: kind, style } : text.values === 1 ? { type, value: asValue(value), style } : { type, value: asValue(value), value2: asValue(value2), style }); };
  return (
    <DialogShell title={text.title} onCancel={onCancel} width={440} footer={<><DialogButton primary onClick={submit} disabled={!ready}>OK</DialogButton><DialogButton onClick={onCancel}>Cancel</DialogButton></>}>
      <p>{text.prompt}</p>
      <div className="mt-2 flex items-center gap-2">
        {text.values === 0 && <select aria-label="Values" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className={field}><option value="duplicate">Duplicate</option><option value="unique">Unique</option></select>}
        {text.values >= 1 && <input autoFocus aria-label="Value" value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} className={`${field} w-28`} />}
        {text.values === 2 && <><span>and</span><input aria-label="Second value" value={value2} onChange={(event) => setValue2(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} className={`${field} w-28`} /></>}
        <span>{text.values === 0 ? "values with" : "with"}</span>
        <select aria-label="Format" value={style} onChange={(event) => setStyle(event.target.value as ConditionalStyle)} className={`${field} flex-1`}>
          {(Object.keys(CONDITIONAL_STYLES) as ConditionalStyle[]).map((key) => <option key={key} value={key}>{CONDITIONAL_STYLES[key].label}</option>)}
        </select>
      </div>
    </DialogShell>
  );
}

// ---------- Find and Replace ----------
export type FindOptions = { matchCase: boolean; entireCell: boolean };
export function FindReplaceDialog({ initialTab, onFindNext, onReplace, onReplaceAll, onCancel }: { initialTab: "Find" | "Replace"; onFindNext: (find: string, options: FindOptions) => string; onReplace: (find: string, replace: string, options: FindOptions) => string; onReplaceAll: (find: string, replace: string, options: FindOptions) => string; onCancel: () => void }) {
  const [tab, setTab] = useState(initialTab);
  const [find, setFind] = useState(""), [replace, setReplace] = useState("");
  const [options, setOptions] = useState<FindOptions>({ matchCase: false, entireCell: false });
  const [message, setMessage] = useState("");
  const tabs = (["Find", "Replace"] as const).map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)} className={`border border-b-0 px-3 py-1 ${tab === name ? "border-[#adadad] bg-white" : "border-transparent"}`}>{name === "Find" ? "Fin" : "Re"}<u>{name === "Find" ? "d" : "p"}</u>{name === "Find" ? "" : "lace"}</button>);
  return (
    <DialogShell title="Find and Replace" onCancel={onCancel} width={480} footer={<>
      {tab === "Replace" && <><DialogButton onClick={() => setMessage(onReplaceAll(find, replace, options))} disabled={!find}>Replace <u>A</u>ll</DialogButton><DialogButton onClick={() => setMessage(onReplace(find, replace, options))} disabled={!find}><u>R</u>eplace</DialogButton></>}
      <DialogButton primary onClick={() => setMessage(onFindNext(find, options))} disabled={!find}>Find Next</DialogButton><DialogButton onClick={onCancel}>Close</DialogButton></>}>
      <div role="tablist" className="flex gap-0.5 border-b border-[#adadad]">{tabs}</div>
      <div className="border border-t-0 border-[#adadad] bg-white p-3">
        <label className="grid grid-cols-[90px_1fr] items-center gap-2">Fi<u>n</u>d what:<input autoFocus value={find} onChange={(event) => setFind(event.target.value)} className={field} /></label>
        {tab === "Replace" && <label className="mt-2 grid grid-cols-[90px_1fr] items-center gap-2">R<u>e</u>place with:<input value={replace} onChange={(event) => setReplace(event.target.value)} className={field} /></label>}
        <div className="mt-3 flex gap-4"><label className="flex items-center gap-1.5"><input type="checkbox" checked={options.matchCase} onChange={(event) => setOptions({ ...options, matchCase: event.target.checked })} /> Match <u>c</u>ase</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={options.entireCell} onChange={(event) => setOptions({ ...options, entireCell: event.target.checked })} /> Match entire cell c<u>o</u>ntents</label></div>
      </div>
      {message && <p role="status" className="mt-2 text-[#1e1e1e]">{message}</p>}
    </DialogShell>
  );
}

// ---------- Page Setup (Page, Margins, Header/Footer, Sheet) ----------
export type PageSetupResult = Pick<SheetSettings, "orientation" | "paperSize" | "margins" | "printArea" | "printTitleRows" | "printTitleCols" | "printGridlines" | "printHeadings"> & { header: HeaderFooter; footer: HeaderFooter };
export function PageSetupDialog({ sheet, initialTab = "Page", onOk, onCancel, onCustomHeader }: { sheet: SheetSettings; initialTab?: "Page" | "Margins" | "Header/Footer" | "Sheet"; onOk: (result: PageSetupResult) => void; onCancel: () => void; onCustomHeader: () => void }) {
  const [tab, setTab] = useState(initialTab);
  const [value, setValue] = useState<PageSetupResult>({ orientation: sheet.orientation, paperSize: sheet.paperSize, margins: sheet.margins, printArea: sheet.printArea, printTitleRows: sheet.printTitleRows ?? null, printTitleCols: sheet.printTitleCols ?? null, printGridlines: sheet.printGridlines, printHeadings: sheet.printHeadings, header: sheet.header, footer: sheet.footer });
  const [error, setError] = useState("");
  const set = <K extends keyof PageSetupResult>(key: K, v: PageSetupResult[K]) => setValue((current) => ({ ...current, [key]: v }));
  const submit = () => {
    const area = value.printArea?.trim().toUpperCase().replace(/\$/g, "") || null, rows = value.printTitleRows?.trim() || null, cols = value.printTitleCols?.trim().toUpperCase() || null;
    if (area && !/^[A-Z]{1,2}[0-9]{1,3}(:[A-Z]{1,2}[0-9]{1,3})?$/.test(area)) return setError("Print area must be a range such as A1:L31.");
    if (rows && !/^\$?[0-9]{1,3}:\$?[0-9]{1,3}$/.test(rows)) return setError("Rows to repeat at top must look like $1:$1.");
    if (cols && !/^\$?[A-Z]{1,2}:\$?[A-Z]{1,2}$/.test(cols)) return setError("Columns to repeat at left must look like $A:$A.");
    onOk({ ...value, printArea: area, printTitleRows: rows, printTitleCols: cols });
  };
  const preview = (part: HeaderFooter) => [part.left, part.center, part.right].filter(Boolean).join("   ") || "(none)";
  return (
    <DialogShell title="Page Setup" onCancel={onCancel} width={500} footer={<><DialogButton primary onClick={submit}>OK</DialogButton><DialogButton onClick={onCancel}>Cancel</DialogButton></>}>
      <div role="tablist" className="flex gap-0.5 border-b border-[#adadad]">
        {(["Page", "Margins", "Header/Footer", "Sheet"] as const).map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)} className={`border border-b-0 px-3 py-1 ${tab === name ? "border-[#adadad] bg-white" : "border-transparent"}`}>{name}</button>)}
      </div>
      <div className="min-h-[220px] border border-t-0 border-[#adadad] bg-white p-3">
        {tab === "Page" && <>
          <fieldset><legend className="text-[#1e5aa8]">Orientation</legend>
            <label className="mr-6 inline-flex items-center gap-1.5"><input type="radio" checked={value.orientation === "portrait"} onChange={() => set("orientation", "portrait")} /> Portrai<u>t</u></label>
            <label className="inline-flex items-center gap-1.5"><input type="radio" checked={value.orientation === "landscape"} onChange={() => set("orientation", "landscape")} /> <u>L</u>andscape</label></fieldset>
          <label className="mt-4 flex items-center gap-2">Paper si<u>z</u>e:<select value={value.paperSize} onChange={(event) => set("paperSize", event.target.value as PaperSize)} className={`${field} flex-1`}>{PAPER_SIZES.map((size) => <option key={size}>{size}</option>)}</select></label>
        </>}
        {tab === "Margins" && <label className="flex items-center gap-2">Margins:<select value={value.margins} onChange={(event) => set("margins", event.target.value as PageSetupResult["margins"])} className={field}><option value="Normal">Normal (Top 0.75&quot;, Left 0.7&quot;)</option><option value="Wide">Wide (Top 1&quot;, Left 1&quot;)</option><option value="Narrow">Narrow (Top 0.75&quot;, Left 0.25&quot;)</option></select></label>}
        {tab === "Header/Footer" && <>
          <p className="text-[#555]">Header:</p><p className="mt-1 border border-[#adadad] px-2 py-3 text-center">{preview(value.header)}</p>
          <p className="mt-3 text-[#555]">Footer:</p><p className="mt-1 border border-[#adadad] px-2 py-3 text-center">{preview(value.footer)}</p>
          <div className="mt-3 flex gap-2"><DialogButton onClick={onCustomHeader}><u>C</u>ustom Header...</DialogButton><DialogButton onClick={onCustomHeader}>C<u>u</u>stom Footer...</DialogButton></div>
        </>}
        {tab === "Sheet" && <>
          <label className="grid grid-cols-[150px_1fr] items-center gap-2">Print <u>a</u>rea:<input value={value.printArea ?? ""} onChange={(event) => set("printArea", event.target.value)} className={field} /></label>
          <p className="mt-3 text-[#1e5aa8]">Print titles</p>
          <label className="mt-1 grid grid-cols-[150px_1fr] items-center gap-2"><span><u>R</u>ows to repeat at top:</span><input value={value.printTitleRows ?? ""} placeholder="$1:$1" onChange={(event) => set("printTitleRows", event.target.value)} className={field} /></label>
          <label className="mt-1 grid grid-cols-[150px_1fr] items-center gap-2"><span><u>C</u>olumns to repeat at left:</span><input value={value.printTitleCols ?? ""} placeholder="$A:$A" onChange={(event) => set("printTitleCols", event.target.value)} className={field} /></label>
          <p className="mt-3 text-[#1e5aa8]">Print</p>
          <label className="mt-1 flex items-center gap-1.5"><input type="checkbox" checked={value.printGridlines} onChange={(event) => set("printGridlines", event.target.checked)} /> <u>G</u>ridlines</label>
          <label className="mt-1 flex items-center gap-1.5"><input type="checkbox" checked={value.printHeadings} onChange={(event) => set("printHeadings", event.target.checked)} /> Row and colu<u>m</u>n headings</label>
        </>}
        {error && <p role="alert" className="mt-3 text-[#c00000]">{error}</p>}
      </div>
    </DialogShell>
  );
}

// ---------- Symbol ----------
const SYMBOLS = ["₹", "$", "€", "£", "¥", "©", "®", "™", "°", "±", "×", "÷", "≠", "≤", "≥", "√", "∞", "π", "Ω", "µ", "§", "¶", "•", "…", "←", "↑", "→", "↓", "↔", "✓", "✗", "★", "☆", "♦", "♣", "♠", "♥", "½", "¼", "¾", "²", "³", "α", "β", "γ", "Δ", "Σ", "‰", "№", "¢"];
export function SymbolDialog({ onInsert, onCancel }: { onInsert: (symbol: string) => void; onCancel: () => void }) {
  const [picked, setPicked] = useState(SYMBOLS[0]);
  return (
    <DialogShell title="Symbol" onCancel={onCancel} width={430} footer={<><DialogButton primary onClick={() => onInsert(picked)}><u>I</u>nsert</DialogButton><DialogButton onClick={onCancel}>Cancel</DialogButton></>}>
      <div className="grid grid-cols-10 border-l border-t border-[#adadad] bg-white">
        {SYMBOLS.map((symbol) => <button key={symbol} type="button" aria-label={`Symbol ${symbol}`} onClick={() => setPicked(symbol)} onDoubleClick={() => onInsert(symbol)} className={`h-8 border-b border-r border-[#adadad] text-[16px] ${picked === symbol ? "bg-[#0078d7] text-white" : "hover:bg-[#e5f1fb]"}`}>{symbol}</button>)}
      </div>
      <p className="mt-2">Selected: <span className="text-[16px]">{picked}</span></p>
    </DialogShell>
  );
}

// ---------- Zoom ----------
export function ZoomDialog({ value, onOk, onCancel, onFitSelection }: { value: number; onOk: (zoom: number) => void; onCancel: () => void; onFitSelection: () => void }) {
  const presets = [200, 100, 75, 50, 25];
  const [choice, setChoice] = useState<string>(presets.includes(value) ? String(value) : "custom");
  const [custom, setCustom] = useState(String(value));
  const submit = () => { if (choice === "fit") { onFitSelection(); return; } const zoom = choice === "custom" ? Number(custom) : Number(choice); if (Number.isFinite(zoom) && zoom >= 10 && zoom <= 400) onOk(Math.round(zoom)); };
  return (
    <DialogShell title="Zoom" onCancel={onCancel} width={240} footer={<><DialogButton primary onClick={submit}>OK</DialogButton><DialogButton onClick={onCancel}>Cancel</DialogButton></>}>
      <fieldset><legend className="text-[#1e5aa8]">Magnification</legend>
        {presets.map((preset) => <label key={preset} className="flex items-center gap-1.5 py-0.5"><input type="radio" checked={choice === String(preset)} onChange={() => setChoice(String(preset))} /> {preset}%</label>)}
        <label className="flex items-center gap-1.5 py-0.5"><input type="radio" checked={choice === "fit"} onChange={() => setChoice("fit")} /> <u>F</u>it selection</label>
        <label className="flex items-center gap-1.5 py-0.5"><input type="radio" checked={choice === "custom"} onChange={() => setChoice("custom")} /> <u>C</u>ustom: <input aria-label="Custom zoom" value={custom} onFocus={() => setChoice("custom")} onChange={(event) => setCustom(event.target.value)} className={`${field} w-14`} />%</label>
      </fieldset>
    </DialogShell>
  );
}

// ---------- AutoFilter dropdown ----------
export function FilterMenu({ x, y, values, hidden, onSort, onOk, onCancel }: { x: number; y: number; values: string[]; hidden: string[]; onSort: (descending: boolean) => void; onOk: (hidden: string[]) => void; onCancel: () => void }) {
  const [shown, setShown] = useState(() => new Set(values.filter((value) => !hidden.includes(value))));
  const [search, setSearch] = useState("");
  const all = shown.size === values.length;
  const visible = values.filter((value) => value.toLowerCase().includes(search.toLowerCase()));
  return (
    <div data-xl-filter role="dialog" aria-label="Filter" className="fixed z-[86] w-60 border border-[#8a8a8a] bg-white py-1 text-[12px] shadow-xl" style={{ left: Math.min(x, (typeof window === "undefined" ? 1200 : window.innerWidth) - 250), top: Math.min(y, (typeof window === "undefined" ? 800 : window.innerHeight) - 380) }}>
      <button type="button" onClick={() => onSort(false)} className="block w-full px-6 py-1 text-left hover:bg-[#e5f1fb]"><u>S</u>ort A to Z</button>
      <button type="button" onClick={() => onSort(true)} className="block w-full px-6 py-1 text-left hover:bg-[#e5f1fb]">Sort Z to A</button>
      <div className="my-1 border-t border-[#e1e1e1]" />
      <button type="button" onClick={() => onOk([])} disabled={!hidden.length} className="block w-full px-6 py-1 text-left hover:bg-[#e5f1fb] disabled:text-[#999]"><u>C</u>lear Filter</button>
      <div className="px-2 pt-1"><input aria-label="Search" placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} className={`${field} w-full`} /></div>
      <div className="mx-2 mt-1 h-36 overflow-y-auto border border-[#adadad] p-1">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={all} onChange={() => setShown(all ? new Set() : new Set(values))} /> (Select All)</label>
        {visible.map((value) => <label key={value} className="flex items-center gap-1.5"><input type="checkbox" checked={shown.has(value)} onChange={() => setShown((current) => { const next = new Set(current); if (next.has(value)) next.delete(value); else next.add(value); return next; })} /> {value === "" ? "(Blanks)" : value}</label>)}
      </div>
      <div className="flex justify-end gap-2 px-2 py-2"><DialogButton primary onClick={() => onOk(values.filter((value) => !shown.has(value)))} disabled={shown.size === 0}>OK</DialogButton><DialogButton onClick={onCancel}>Cancel</DialogButton></div>
    </div>
  );
}
