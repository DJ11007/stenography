"use client";
import { useState } from "react";
import type { ConditionalFormat, DataValidation, ValidationOperator, ValidationType } from "@/lib/excel-document";
import { CONDITIONAL_STYLES } from "@/lib/excel-sheet-model";
import type { DateUnit, SeriesType } from "@/lib/excel-series";
import { DialogButton, DialogShell } from "./excel-dialogs";

// More of Excel 2013's dialog boxes: Paste Special, Insert / Delete (cells), Series, Go To Special, Insert Hyperlink,
// New Name and Name Manager, Data Validation, Convert Text to Columns, Conditional Formatting Rules Manager, Colors.
const field = "border border-[#adadad] bg-white px-1.5 py-1 outline-none focus:border-[#0078d7]";
const Radio = ({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: () => void; disabled?: boolean }) => <label className={`flex items-center gap-1.5 py-0.5 ${disabled ? "text-[#a0a0a0]" : ""}`}><input type="radio" checked={checked} onChange={onChange} disabled={disabled} /> {label}</label>;
const Footer = ({ onOk, onCancel, okDisabled }: { onOk: () => void; onCancel: () => void; okDisabled?: boolean }) => <><DialogButton primary onClick={onOk} disabled={okDisabled}>OK</DialogButton><DialogButton onClick={onCancel}>Cancel</DialogButton></>;

// ---------- Paste Special ----------
export type PasteSpecialChoice = { what: "all" | "formulas" | "values" | "formats" | "comments" | "allExceptBorders" | "columnWidths"; operation: "none" | "add" | "subtract" | "multiply" | "divide"; skipBlanks: boolean; transpose: boolean };
export function PasteSpecialDialog({ onOk, onCancel }: { onOk: (choice: PasteSpecialChoice) => void; onCancel: () => void }) {
  const [choice, setChoice] = useState<PasteSpecialChoice>({ what: "all", operation: "none", skipBlanks: false, transpose: false });
  const set = <K extends keyof PasteSpecialChoice>(key: K, value: PasteSpecialChoice[K]) => setChoice((current) => ({ ...current, [key]: value }));
  const whats: [PasteSpecialChoice["what"], string][] = [["all", "All"], ["formulas", "Formulas"], ["values", "Values"], ["formats", "Formats"], ["comments", "Comments"], ["allExceptBorders", "All except borders"], ["columnWidths", "Column widths"]];
  const operations: [PasteSpecialChoice["operation"], string][] = [["none", "None"], ["add", "Add"], ["subtract", "Subtract"], ["multiply", "Multiply"], ["divide", "Divide"]];
  return (
    <DialogShell title="Paste Special" onCancel={onCancel} width={400} footer={<Footer onOk={() => onOk(choice)} onCancel={onCancel} />}>
      <fieldset><legend className="text-[#1e5aa8]">Paste</legend><div className="grid grid-cols-2">{whats.map(([value, label]) => <Radio key={value} label={label} checked={choice.what === value} onChange={() => set("what", value)} />)}</div></fieldset>
      <fieldset className="mt-3"><legend className="text-[#1e5aa8]">Operation</legend><div className="grid grid-cols-2">{operations.map(([value, label]) => <Radio key={value} label={label} checked={choice.operation === value} onChange={() => set("operation", value)} />)}</div></fieldset>
      <div className="mt-3 flex gap-6"><label className="flex items-center gap-1.5"><input type="checkbox" checked={choice.skipBlanks} onChange={(event) => set("skipBlanks", event.target.checked)} /> Skip <u>b</u>lanks</label><label className="flex items-center gap-1.5"><input type="checkbox" checked={choice.transpose} onChange={(event) => set("transpose", event.target.checked)} /> Transpos<u>e</u></label></div>
    </DialogShell>
  );
}

// ---------- Insert / Delete (cells) ----------
export type ShiftChoice = "shiftRight" | "shiftDown" | "shiftLeft" | "shiftUp" | "entireRow" | "entireColumn";
export function InsertDeleteCellsDialog({ mode, onOk, onCancel }: { mode: "insert" | "delete"; onOk: (choice: ShiftChoice) => void; onCancel: () => void }) {
  const options: [ShiftChoice, string][] = mode === "insert" ? [["shiftRight", "Shift cells right"], ["shiftDown", "Shift cells down"], ["entireRow", "Entire row"], ["entireColumn", "Entire column"]] : [["shiftLeft", "Shift cells left"], ["shiftUp", "Shift cells up"], ["entireRow", "Entire row"], ["entireColumn", "Entire column"]];
  const [choice, setChoice] = useState<ShiftChoice>(options[mode === "insert" ? 1 : 1][0]);
  return (
    <DialogShell title={mode === "insert" ? "Insert" : "Delete"} onCancel={onCancel} width={230} footer={<Footer onOk={() => onOk(choice)} onCancel={onCancel} />}>
      <fieldset><legend className="text-[#1e5aa8]">{mode === "insert" ? "Insert" : "Delete"}</legend>{options.map(([value, label]) => <Radio key={value} label={label} checked={choice === value} onChange={() => setChoice(value)} />)}</fieldset>
    </DialogShell>
  );
}

// ---------- Series ----------
// Excel 2013's Series box: Series in (Rows / Columns), Type (Linear / Growth / Date / AutoFill), Date unit (only for
// Date), Trend (only for Linear / Growth), Step value and Stop value (not for AutoFill).
export type SeriesChoice = { direction: "rows" | "columns"; type: SeriesType; dateUnit: DateUnit; step: number; stop: number | null; trend: boolean };
export function SeriesDialog({ defaultDirection, defaultType = "linear", onOk, onCancel }: { defaultDirection: "rows" | "columns"; defaultType?: SeriesType; onOk: (choice: SeriesChoice) => void; onCancel: () => void }) {
  const [direction, setDirection] = useState(defaultDirection);
  const [type, setType] = useState<SeriesType>(defaultType);
  const [dateUnit, setDateUnit] = useState<DateUnit>("day");
  const [trend, setTrend] = useState(false);
  const [step, setStep] = useState("1"), [stop, setStop] = useState("");
  const usesStep = type !== "autofill" && !(trend && type !== "date");
  const ok = type === "autofill" || ((!usesStep || (step.trim() !== "" && Number.isFinite(Number(step)))) && (stop.trim() === "" || Number.isFinite(Number(stop))));
  const box = "rounded-sm border border-[#d5d5d5] px-2 pb-1.5 pt-0.5";
  return (
    <DialogShell title="Series" onCancel={onCancel} width={330} footer={<Footer okDisabled={!ok} onOk={() => onOk({ direction, type, dateUnit, trend: trend && (type === "linear" || type === "growth"), step: Number(step) || 0, stop: stop.trim() === "" || type === "autofill" ? null : Number(stop) })} onCancel={onCancel} />}>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2">
        <fieldset className={box}><legend className="px-0.5">Series in</legend><Radio label="Rows" checked={direction === "rows"} onChange={() => setDirection("rows")} /><Radio label="Columns" checked={direction === "columns"} onChange={() => setDirection("columns")} /></fieldset>
        <fieldset className={box}><legend className="px-0.5">Type</legend>{([["linear", "Linear"], ["growth", "Growth"], ["date", "Date"], ["autofill", "AutoFill"]] as [SeriesType, string][]).map(([value, label]) => <Radio key={value} label={label} checked={type === value} onChange={() => setType(value)} />)}</fieldset>
        <fieldset className={box}><legend className={`px-0.5 ${type === "date" ? "" : "text-[#a0a0a0]"}`}>Date unit</legend>{([["day", "Day"], ["weekday", "Weekday"], ["month", "Month"], ["year", "Year"]] as [DateUnit, string][]).map(([value, label]) => <Radio key={value} label={label} disabled={type !== "date"} checked={dateUnit === value} onChange={() => setDateUnit(value)} />)}</fieldset>
      </div>
      <label className={`mt-2 flex items-center gap-1.5 ${type === "linear" || type === "growth" ? "" : "text-[#a0a0a0]"}`}><input type="checkbox" checked={trend} disabled={!(type === "linear" || type === "growth")} onChange={(event) => setTrend(event.target.checked)} /> <span><u>T</u>rend</span></label>
      <div className="mt-2 flex gap-3">
        <label className={`flex items-center gap-1.5 ${usesStep ? "" : "text-[#a0a0a0]"}`}>Step value: <input aria-label="Step value" disabled={!usesStep} value={step} onChange={(event) => setStep(event.target.value)} className={`${field} w-20`} /></label>
        <label className={`flex items-center gap-1.5 ${type === "autofill" ? "text-[#a0a0a0]" : ""}`}>Stop value: <input aria-label="Stop value" disabled={type === "autofill"} value={stop} onChange={(event) => setStop(event.target.value)} className={`${field} w-20`} /></label>
      </div>
    </DialogShell>
  );
}

// ---------- Go To Special ----------
export type GoToSpecialChoice = "comments" | "constants" | "formulas" | "blanks" | "conditional" | "validation";
export function GoToSpecialDialog({ onOk, onCancel }: { onOk: (choice: GoToSpecialChoice) => void; onCancel: () => void }) {
  const [choice, setChoice] = useState<GoToSpecialChoice>("comments");
  const options: [GoToSpecialChoice, string][] = [["comments", "Comments"], ["constants", "Constants"], ["formulas", "Formulas"], ["blanks", "Blanks"], ["conditional", "Conditional formats"], ["validation", "Data validation"]];
  return (
    <DialogShell title="Go To Special" onCancel={onCancel} width={300} footer={<Footer onOk={() => onOk(choice)} onCancel={onCancel} />}>
      <fieldset><legend className="text-[#1e5aa8]">Select</legend>{options.map(([value, label]) => <Radio key={value} label={label} checked={choice === value} onChange={() => setChoice(value)} />)}</fieldset>
    </DialogShell>
  );
}

// ---------- Insert Hyperlink ----------
export function HyperlinkDialog({ initialText, initialAddress, onOk, onRemove, onCancel }: { initialText: string; initialAddress: string; onOk: (text: string, address: string) => void; onRemove?: () => void; onCancel: () => void }) {
  const [text, setText] = useState(initialText), [address, setAddress] = useState(initialAddress);
  return (
    <DialogShell title="Insert Hyperlink" onCancel={onCancel} width={460} footer={<>{onRemove && <DialogButton onClick={onRemove}><u>R</u>emove Link</DialogButton>}<Footer okDisabled={!address.trim()} onOk={() => onOk(text, address.trim())} onCancel={onCancel} /></>}>
      <label className="grid grid-cols-[110px_1fr] items-center gap-2"><u>T</u>ext to display:<input value={text} onChange={(event) => setText(event.target.value)} className={field} /></label>
      <label className="mt-3 grid grid-cols-[110px_1fr] items-center gap-2">Addr<u>e</u>ss:<input autoFocus value={address} placeholder="https://www.example.com or a cell such as A1" onChange={(event) => setAddress(event.target.value)} className={field} /></label>
    </DialogShell>
  );
}

// ---------- New Name / Name Manager ----------
export function DefineNameDialog({ refersTo, onOk, onCancel }: { refersTo: string; onOk: (name: string, range: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(""), [range, setRange] = useState(refersTo);
  const valid = /^[A-Za-z_][A-Za-z0-9_.]{0,39}$/.test(name) && !/^[A-Z]{1,2}[0-9]{1,3}$/i.test(name) && /^=?\$?[A-Z]{1,2}\$?[0-9]{1,3}(:\$?[A-Z]{1,2}\$?[0-9]{1,3})?$/i.test(range.trim());
  return (
    <DialogShell title="New Name" onCancel={onCancel} width={400} footer={<Footer okDisabled={!valid} onOk={() => onOk(name, range.trim().replace(/^=/, "").toUpperCase())} onCancel={onCancel} />}>
      <label className="grid grid-cols-[80px_1fr] items-center gap-2"><u>N</u>ame:<input autoFocus value={name} onChange={(event) => setName(event.target.value)} className={field} /></label>
      <label className="mt-2 grid grid-cols-[80px_1fr] items-center gap-2">Scope:<select className={field} defaultValue="Workbook"><option>Workbook</option></select></label>
      <label className="mt-2 grid grid-cols-[80px_1fr] items-center gap-2"><u>R</u>efers to:<input value={range} onChange={(event) => setRange(event.target.value)} className={field} /></label>
      {name && !valid && <p className="mt-2 text-[#c00000]">The name must start with a letter or _, have no spaces, and must not look like a cell reference.</p>}
    </DialogShell>
  );
}
export function NameManagerDialog({ names, onDelete, onNew, onCancel }: { names: Record<string, string>; onDelete: (name: string) => void; onNew: () => void; onCancel: () => void }) {
  const [picked, setPicked] = useState<string | null>(Object.keys(names)[0] ?? null);
  return (
    <DialogShell title="Name Manager" onCancel={onCancel} width={480} footer={<DialogButton onClick={onCancel}>Close</DialogButton>}>
      <div className="mb-2 flex gap-2"><DialogButton onClick={onNew}><u>N</u>ew...</DialogButton><DialogButton onClick={() => { if (picked) { onDelete(picked); setPicked(null); } }} disabled={!picked}><u>D</u>elete</DialogButton></div>
      <table className="w-full border border-[#adadad] bg-white text-left"><thead><tr className="bg-[#f0f0f0]"><th className="px-2 py-1">Name</th><th className="px-2 py-1">Refers To</th><th className="px-2 py-1">Scope</th></tr></thead>
        <tbody>{Object.entries(names).map(([name, range]) => <tr key={name} onClick={() => setPicked(name)} className={picked === name ? "bg-[#0078d7] text-white" : "hover:bg-[#e5f1fb]"}><td className="px-2 py-1">{name}</td><td className="px-2 py-1">={range}</td><td className="px-2 py-1">Workbook</td></tr>)}
          {!Object.keys(names).length && <tr><td colSpan={3} className="px-2 py-3 text-center text-[#777]">No names defined.</td></tr>}</tbody></table>
    </DialogShell>
  );
}

// ---------- Data Validation ----------
const OPERATORS: [ValidationOperator, string][] = [["between", "between"], ["notBetween", "not between"], ["equal", "equal to"], ["notEqual", "not equal to"], ["greater", "greater than"], ["less", "less than"], ["greaterOrEqual", "greater than or equal to"], ["lessOrEqual", "less than or equal to"]];
export function DataValidationDialog({ current, onOk, onClear, onCancel }: { current: DataValidation | null; onOk: (rule: Omit<DataValidation, "range">) => void; onClear: () => void; onCancel: () => void }) {
  const [tab, setTab] = useState<"Settings" | "Error Alert">("Settings");
  const [type, setType] = useState<ValidationType | "any">(current?.type ?? "any");
  const [operator, setOperator] = useState<ValidationOperator>(current?.operator ?? "between");
  const [value1, setValue1] = useState(current?.value1 ?? ""), [value2, setValue2] = useState(current?.value2 ?? ""), [list, setList] = useState(current?.list ?? "");
  const [title, setTitle] = useState(current?.title ?? ""), [message, setMessage] = useState(current?.message ?? "");
  const two = operator === "between" || operator === "notBetween";
  const ready = type === "any" || (type === "list" ? list.trim() !== "" : value1.trim() !== "" && (!two || value2.trim() !== ""));
  const submit = () => { if (type === "any") { onClear(); return; } onOk({ type, ...(type === "list" ? { list: list.trim() } : { operator, value1: value1.trim(), ...(two ? { value2: value2.trim() } : {}) }), ...(title.trim() ? { title: title.trim() } : {}), ...(message.trim() ? { message: message.trim() } : {}) }); };
  const label1 = two ? "Minimum:" : operator === "equal" || operator === "notEqual" ? "Value:" : operator.startsWith("greater") ? "Minimum:" : "Maximum:";
  return (
    <DialogShell title="Data Validation" onCancel={onCancel} width={460} footer={<><DialogButton onClick={onClear}><u>C</u>lear All</DialogButton><Footer okDisabled={!ready} onOk={submit} onCancel={onCancel} /></>}>
      <div role="tablist" className="flex gap-0.5 border-b border-[#adadad]">{(["Settings", "Error Alert"] as const).map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)} className={`border border-b-0 px-3 py-1 ${tab === name ? "border-[#adadad] bg-white" : "border-transparent"}`}>{name}</button>)}</div>
      <div className="min-h-[180px] border border-t-0 border-[#adadad] bg-white p-3">
        {tab === "Settings" ? <>
          <p className="text-[#1e5aa8]">Validation criteria</p>
          <label className="mt-2 grid grid-cols-[70px_1fr] items-center gap-2"><u>A</u>llow:<select aria-label="Allow" value={type} onChange={(event) => setType(event.target.value as typeof type)} className={field}><option value="any">Any value</option><option value="whole">Whole number</option><option value="decimal">Decimal</option><option value="list">List</option><option value="date">Date</option><option value="textLength">Text length</option></select></label>
          {type !== "any" && type !== "list" && <>
            <label className="mt-2 grid grid-cols-[70px_1fr] items-center gap-2"><u>D</u>ata:<select aria-label="Data" value={operator} onChange={(event) => setOperator(event.target.value as ValidationOperator)} className={field}>{OPERATORS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
            <label className="mt-2 grid grid-cols-[70px_1fr] items-center gap-2">{label1}<input aria-label={label1} value={value1} placeholder={type === "date" ? "25-10-2026" : ""} onChange={(event) => setValue1(event.target.value)} className={field} /></label>
            {two && <label className="mt-2 grid grid-cols-[70px_1fr] items-center gap-2">Ma<u>x</u>imum:<input aria-label="Maximum:" value={value2} onChange={(event) => setValue2(event.target.value)} className={field} /></label>}
          </>}
          {type === "list" && <label className="mt-2 grid grid-cols-[70px_1fr] items-center gap-2"><u>S</u>ource:<input aria-label="Source" value={list} placeholder="Yes,No,Maybe" onChange={(event) => setList(event.target.value)} className={field} /></label>}
        </> : <>
          <p>When user enters invalid data, show this error alert:</p>
          <label className="mt-2 grid gap-1"><u>T</u>itle:<input value={title} onChange={(event) => setTitle(event.target.value)} className={field} /></label>
          <label className="mt-2 grid gap-1"><u>E</u>rror message:<textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)} className={`${field} resize-none`} /></label>
        </>}
      </div>
    </DialogShell>
  );
}

// ---------- Convert Text to Columns ----------
export function TextToColumnsDialog({ onOk, onCancel }: { onOk: (delimiters: string[]) => void; onCancel: () => void }) {
  const [delimiters, setDelimiters] = useState<string[]>(["\t"]);
  const [other, setOther] = useState("");
  const options: [string, string][] = [["\t", "Tab"], [";", "Semicolon"], [",", "Comma"], [" ", "Space"]];
  const toggle = (value: string) => setDelimiters((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  const all = [...delimiters, ...(other ? [other] : [])];
  return (
    <DialogShell title="Convert Text to Columns Wizard" onCancel={onCancel} width={440} footer={<><DialogButton onClick={onCancel}>Cancel</DialogButton><DialogButton primary onClick={() => onOk(all)} disabled={!all.length}><u>F</u>inish</DialogButton></>}>
      <p>The data is <b>Delimited</b>: characters such as commas or tabs separate each field.</p>
      <fieldset className="mt-3"><legend className="text-[#1e5aa8]">Delimiters</legend>
        {options.map(([value, label]) => <label key={label} className="flex items-center gap-1.5 py-0.5"><input type="checkbox" checked={delimiters.includes(value)} onChange={() => toggle(value)} /> {label}</label>)}
        <label className="flex items-center gap-1.5 py-0.5">Other: <input aria-label="Other delimiter" maxLength={1} value={other} onChange={(event) => setOther(event.target.value)} className={`${field} w-10`} /></label>
      </fieldset>
    </DialogShell>
  );
}

// ---------- Conditional Formatting Rules Manager ----------
const RULE_NAMES: Record<string, string> = { greaterThan: "Cell Value >", lessThan: "Cell Value <", between: "Cell Value between", equalTo: "Cell Value =", textContains: "Cell Value contains", duplicate: "Duplicate Values", unique: "Unique Values", top: "Top", bottom: "Bottom", topPercent: "Top %", bottomPercent: "Bottom %", aboveAverage: "Above Average", belowAverage: "Below Average", dataBar: "Data Bar", colorScale: "Graded Color Scale", iconSet: "Icon Set" };
export function ManageRulesDialog({ rules, onDelete, onCancel }: { rules: ConditionalFormat[]; onDelete: (index: number) => void; onCancel: () => void }) {
  const [picked, setPicked] = useState<number | null>(rules.length ? 0 : null);
  return (
    <DialogShell title="Conditional Formatting Rules Manager" onCancel={onCancel} width={560} footer={<DialogButton onClick={onCancel}>Close</DialogButton>}>
      <div className="mb-2 flex gap-2"><DialogButton onClick={() => { if (picked !== null) { onDelete(picked); setPicked(null); } }} disabled={picked === null}><u>D</u>elete Rule</DialogButton></div>
      <table className="w-full border border-[#adadad] bg-white text-left"><thead><tr className="bg-[#f0f0f0]"><th className="px-2 py-1">Rule (applied in order shown)</th><th className="px-2 py-1">Format</th><th className="px-2 py-1">Applies to</th></tr></thead>
        <tbody>{rules.map((rule, index) => { const style = CONDITIONAL_STYLES[rule.style]; return (
          <tr key={index} onClick={() => setPicked(index)} className={picked === index ? "bg-[#0078d7] text-white" : "hover:bg-[#e5f1fb]"}>
            <td className="px-2 py-1">{RULE_NAMES[rule.type] ?? rule.type}{rule.value !== undefined ? ` ${rule.value}` : ""}{rule.value2 !== undefined ? ` and ${rule.value2}` : ""}</td>
            <td className="px-2 py-1"><span className="inline-block px-2" style={{ background: style.fill ? `#${style.fill}` : style.bar ? `#${style.bar}` : style.scale ? `linear-gradient(90deg, ${style.scale.map((c) => `#${c}`).join(",")})` : undefined, color: style.font ? `#${style.font}` : undefined, border: style.border }}>AaBbCcYyZz</span></td>
            <td className="px-2 py-1">={rule.range}</td>
          </tr>); })}
          {!rules.length && <tr><td colSpan={3} className="px-2 py-3 text-center text-[#777]">There are no conditional formatting rules on this sheet.</td></tr>}</tbody></table>
    </DialogShell>
  );
}

// ---------- More Colors ----------
export function MoreColorsDialog({ title, initial, onOk, onCancel }: { title: string; initial: string | null; onOk: (hex: string) => void; onCancel: () => void }) {
  const [hex, setHex] = useState(initial ?? "000000");
  const valid = /^[0-9A-Fa-f]{6}$/.test(hex);
  return (
    <DialogShell title="Colors" onCancel={onCancel} width={320} footer={<Footer okDisabled={!valid} onOk={() => onOk(hex.toUpperCase())} onCancel={onCancel} />}>
      <p>{title}</p>
      <div className="mt-2 flex items-center gap-3"><input type="color" aria-label="Color picker" value={`#${valid ? hex : "000000"}`} onChange={(event) => setHex(event.target.value.slice(1))} className="h-16 w-24" />
        <label className="flex items-center gap-1.5">Hex: #<input aria-label="Hex" value={hex} maxLength={6} onChange={(event) => setHex(event.target.value.replace(/[^0-9A-Fa-f]/g, ""))} className={`${field} w-20`} /></label></div>
      <div className="mt-3 flex gap-2"><span>New</span><span className="h-6 w-12 border" style={{ background: valid ? `#${hex}` : "#fff" }} /><span>Current</span><span className="h-6 w-12 border" style={{ background: initial ? `#${initial}` : "#fff" }} /></div>
    </DialogShell>
  );
}
