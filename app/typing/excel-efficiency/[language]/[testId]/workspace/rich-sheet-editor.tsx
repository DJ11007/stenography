"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { columnLetters, columnIndex, computedCellValue, type SheetCells } from "@/lib/excel-formula";
import { autosaveExcelDocument, submitExcelDocument } from "../../../actions";

export type SheetCell = { value: string | number | null; formula: string | null; bold: boolean; italic: boolean; underline: boolean; fontColor: string | null; fillColor: string | null; border: string | null; numberFormat: "General" | "Number" | "Currency" | "Percentage"; align: "left" | "center" | "right" };
export type ExcelDocument = { schemaVersion: "2"; rows: number; cols: number; cells: Record<string, SheetCell>; operations: string[]; savedAt: string };

const EMPTY_CELL: SheetCell = { value: null, formula: null, bold: false, italic: false, underline: false, fontColor: null, fillColor: null, border: null, numberFormat: "General", align: "left" };
const SAFE_COLORS = ["#000000", "#B91C1C", "#1D4ED8", "#15803D", "#A16207", "#6D28D9"];
const SAFE_FILLS = ["transparent", "#FEF9C3", "#DBEAFE", "#DCFCE7", "#FEE2E2", "#F3E8FF"];

function refAt(row: number, col: number) { return `${columnLetters(col)}${row}`; }
function cellRef(ref: string) { const match = ref.match(/^([A-Z]{1,2})([0-9]{1,3})$/); return match ? { col: columnIndex(match[1]), row: Number(match[2]) } : null; }
function rangeBetween(a: string, b: string): string[] {
  const from = cellRef(a), to = cellRef(b);
  if (!from || !to) return [a];
  const refs: string[] = [];
  for (let row = Math.min(from.row, to.row); row <= Math.max(from.row, to.row); row++)
    for (let col = Math.min(from.col, to.col); col <= Math.max(from.col, to.col); col++) refs.push(refAt(row, col));
  return refs;
}
function displayValue(cell: SheetCell): string {
  const raw = cell.formula ? cell.formula : cell.value;
  if (raw == null) return "";
  return String(raw);
}
function formatNumberDisplay(value: unknown, format: SheetCell["numberFormat"]): string {
  if (typeof value !== "number") return value == null ? "" : String(value);
  if (format === "Currency") return `₹${value.toFixed(2)}`;
  if (format === "Percentage") return `${(value * 100).toFixed(1)}%`;
  if (format === "Number") return value.toFixed(2);
  return String(value);
}

export function RichSheetEditor({ attemptId, original, initialDocument, locked }: { attemptId: string; original: ExcelDocument; initialDocument?: ExcelDocument | null; locked: boolean }) {
  const router = useRouter();
  const base = initialDocument && initialDocument.schemaVersion === "2" ? initialDocument : original;
  const [rows, setRows] = useState(base.rows);
  const [cols, setCols] = useState(base.cols);
  const [cells, setCells] = useState<Record<string, SheetCell>>(base.cells);
  const [operations, setOperations] = useState<Set<string>>(new Set(base.operations ?? []));
  const [selected, setSelected] = useState("A1");
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);
  const [editingRef, setEditingRef] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [status, setStatus] = useState("Ready");
  const [submitted, setSubmitted] = useState(locked);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editingRef) editInputRef.current?.focus(); }, [editingRef]);
  useEffect(() => () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); }, []);

  const selectionRefs = useMemo(() => (rangeAnchor && rangeAnchor !== selected ? rangeBetween(rangeAnchor, selected) : [selected]), [rangeAnchor, selected]);
  const sheetCellsForFormulas: SheetCells = useMemo(() => Object.fromEntries(Object.entries(cells).map(([ref, cell]) => [ref, { value: cell.value, formula: cell.formula }])), [cells]);

  const markOperation = (op: string) => setOperations((current) => { const next = new Set(current); next.add(op); return next; });

  const scheduleAutosave = (nextCells: Record<string, SheetCell>, nextRows: number, nextCols: number, nextOps: Set<string>) => {
    if (submitted) return;
    setStatus("Unsaved changes");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      setStatus("Saving…");
      const document: ExcelDocument = { schemaVersion: "2", rows: nextRows, cols: nextCols, cells: nextCells, operations: [...nextOps].slice(0, 256), savedAt: new Date().toISOString() };
      const result = await autosaveExcelDocument(attemptId, document);
      setStatus(result.ok ? "Saved" : result.error);
    }, 800);
  };

  const updateCells = (updater: (current: Record<string, SheetCell>) => Record<string, SheetCell>, op?: string) => {
    setCells((current) => {
      const next = updater(current);
      const nextOps = op ? (() => { const set = new Set(operations); set.add(op); return set; })() : operations;
      if (op) setOperations(nextOps);
      scheduleAutosave(next, rows, cols, nextOps);
      return next;
    });
  };

  const commitEdit = (ref: string, raw: string) => {
    updateCells((current) => {
      const existing = current[ref] ?? EMPTY_CELL;
      const isFormula = raw.startsWith("=");
      const numeric = !isFormula && raw.trim() !== "" && Number.isFinite(Number(raw)) ? Number(raw) : null;
      const value = isFormula ? existing.value : (numeric !== null ? numeric : (raw === "" ? null : raw));
      return { ...current, [ref]: { ...existing, value, formula: isFormula ? raw : null } };
    }, isFormulaOp(raw));
    setEditingRef(null);
  };
  function isFormulaOp(raw: string) { const match = raw.match(/^=([A-Z]+)\(/i); return match ? `formula:${match[1].toUpperCase()}` : undefined; }

  const applyToSelection = (patch: Partial<SheetCell>, op: string) => {
    updateCells((current) => {
      const next = { ...current };
      for (const ref of selectionRefs) next[ref] = { ...(next[ref] ?? EMPTY_CELL), ...patch };
      return next;
    }, op);
  };

  const toggleStyle = (key: "bold" | "italic" | "underline") => applyToSelection({ [key]: !(cells[selected]?.[key] ?? false) } as Partial<SheetCell>, key);
  const setColor = (key: "fontColor" | "fillColor", value: string) => applyToSelection({ [key]: value === "transparent" ? null : value } as Partial<SheetCell>, key);
  const setNumberFormat = (value: SheetCell["numberFormat"]) => applyToSelection({ numberFormat: value }, "numberFormat");
  const setAlign = (value: SheetCell["align"]) => applyToSelection({ align: value }, "align");
  const setBorder = () => applyToSelection({ border: cells[selected]?.border ? null : "1px solid #0f766e" }, "border");

  const sortRange = (direction: "asc" | "desc") => {
    if (selectionRefs.length < 2) { setStatus("Select a range of cells to sort first."); return; }
    const refsSorted = [...selectionRefs].sort((a, b) => { const A = cellRef(a)!, B = cellRef(b)!; return A.row - B.row || A.col - B.col; });
    const values = refsSorted.map((ref) => cells[ref] ?? EMPTY_CELL);
    const ordered = [...values].sort((a, b) => {
      const av = a.value, bv = b.value;
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av ?? "").localeCompare(String(bv ?? ""));
    });
    if (direction === "desc") ordered.reverse();
    updateCells((current) => { const next = { ...current }; refsSorted.forEach((ref, index) => { next[ref] = ordered[index]; }); return next; }, direction === "asc" ? "sortAscending" : "sortDescending");
  };

  const insertRow = () => { const at = cellRef(selected)?.row ?? 1; updateCells((current) => shiftRows(current, at, 1), "insertRow"); setRows((value) => value + 1); };
  const deleteRow = () => { const at = cellRef(selected)?.row ?? 1; updateCells((current) => shiftRows(current, at, -1), "deleteRow"); setRows((value) => Math.max(1, value - 1)); };
  const insertColumn = () => { const at = cellRef(selected)?.col ?? 0; updateCells((current) => shiftColumns(current, at, 1), "insertColumn"); setCols((value) => value + 1); };
  const deleteColumn = () => { const at = cellRef(selected)?.col ?? 0; updateCells((current) => shiftColumns(current, at, -1), "deleteColumn"); setCols((value) => Math.max(1, value - 1)); };

  const move = (deltaRow: number, deltaCol: number) => { const at = cellRef(selected); if (!at) return; const row = Math.min(Math.max(at.row + deltaRow, 1), rows), col = Math.min(Math.max(at.col + deltaCol, 0), cols - 1); setSelected(refAt(row, col)); setRangeAnchor(null); };

  const submit = async () => {
    if (!confirm("Submit your final sheet? You cannot edit it afterward.")) return;
    setStatus("Submitting…");
    const document: ExcelDocument = { schemaVersion: "2", rows, cols, cells, operations: [...operations].slice(0, 256), savedAt: new Date().toISOString() };
    const result = await submitExcelDocument(attemptId, document);
    if (!result.ok) { setStatus(result.error); return; }
    setSubmitted(true);
    setStatus("Test submitted successfully");
    router.push(`/typing/excel-efficiency/results/${attemptId}`);
  };

  const activeCell = cells[selected] ?? EMPTY_CELL;
  const formulaBarValue = editingRef === selected ? editValue : (activeCell.formula ?? (activeCell.value == null ? "" : String(activeCell.value)));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="toolbar" aria-label="Spreadsheet controls" className="flex flex-wrap items-center gap-1.5 border-b bg-white px-3 py-2">
        <RibbonButton active={activeCell.bold} onClick={() => toggleStyle("bold")} label="Bold"><strong>B</strong></RibbonButton>
        <RibbonButton active={activeCell.italic} onClick={() => toggleStyle("italic")} label="Italic"><em>I</em></RibbonButton>
        <RibbonButton active={activeCell.underline} onClick={() => toggleStyle("underline")} label="Underline"><u>U</u></RibbonButton>
        <ColorMenu label="Font color" colors={SAFE_COLORS} onPick={(color) => setColor("fontColor", color)} swatch="A" />
        <ColorMenu label="Fill color" colors={SAFE_FILLS} onPick={(color) => setColor("fillColor", color)} swatch="🎨" />
        <RibbonButton active={Boolean(activeCell.border)} onClick={setBorder} label="Borders">▦</RibbonButton>
        <select aria-label="Number format" value={activeCell.numberFormat} onChange={(event) => setNumberFormat(event.target.value as SheetCell["numberFormat"])} className="input h-8 py-0 text-xs">
          {(["General", "Number", "Currency", "Percentage"] as const).map((format) => <option key={format} value={format}>{format}</option>)}
        </select>
        <RibbonButton active={activeCell.align === "left"} onClick={() => setAlign("left")} label="Align left">⯇</RibbonButton>
        <RibbonButton active={activeCell.align === "center"} onClick={() => setAlign("center")} label="Align center">☰</RibbonButton>
        <RibbonButton active={activeCell.align === "right"} onClick={() => setAlign("right")} label="Align right">⯈</RibbonButton>
        <RibbonButton onClick={() => sortRange("asc")} label="Sort ascending">A→Z</RibbonButton>
        <RibbonButton onClick={() => sortRange("desc")} label="Sort descending">Z→A</RibbonButton>
        <RibbonButton onClick={insertRow} label="Insert row">+Row</RibbonButton>
        <RibbonButton onClick={deleteRow} label="Delete row">−Row</RibbonButton>
        <RibbonButton onClick={insertColumn} label="Insert column">+Col</RibbonButton>
        <RibbonButton onClick={deleteColumn} label="Delete column">−Col</RibbonButton>
        <span className="ml-auto text-xs font-bold text-slate-500">{status}</span>
      </div>
      <div className="flex items-center gap-2 border-b bg-slate-50 px-3 py-1.5">
        <span className="w-16 shrink-0 rounded border bg-white px-2 py-1 text-center text-xs font-black">{selected}</span>
        <span className="text-slate-400">fx</span>
        <input
          value={formulaBarValue}
          onChange={(event) => { setEditingRef(selected); setEditValue(event.target.value); }}
          onKeyDown={(event) => { if (event.key === "Enter") { commitEdit(selected, formulaBarValue); move(1, 0); } }}
          onBlur={() => { if (editingRef === selected) commitEdit(selected, formulaBarValue); }}
          disabled={submitted}
          aria-label="Formula bar"
          className="input h-8 flex-1 py-0 font-mono text-xs"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-10 w-10 border bg-slate-200" />
              {Array.from({ length: cols }, (_, col) => <th key={col} className="sticky top-0 z-10 min-w-24 border bg-slate-200 px-2 py-1 font-black">{columnLetters(col)}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, rowIndex) => {
              const row = rowIndex + 1;
              return (
                <tr key={row}>
                  <th className="sticky left-0 z-10 border bg-slate-200 px-2 font-black">{row}</th>
                  {Array.from({ length: cols }, (_, col) => {
                    const ref = refAt(row, col);
                    const cell = cells[ref] ?? EMPTY_CELL;
                    const isSelected = selectionRefs.includes(ref);
                    const isEditing = editingRef === ref;
                    const computed = cell.formula ? computedCellValue(ref, sheetCellsForFormulas) : cell.value;
                    return (
                      <td
                        key={ref}
                        onMouseDown={(event) => { if (event.shiftKey) { setRangeAnchor((current) => current ?? selected); setSelected(ref); } else { setSelected(ref); setRangeAnchor(null); } }}
                        onDoubleClick={() => { if (submitted) return; setEditingRef(ref); setEditValue(cell.formula ?? (cell.value == null ? "" : String(cell.value))); }}
                        style={{ backgroundColor: cell.fillColor ? `#${cell.fillColor}` : undefined, border: cell.border ?? undefined }}
                        className={`min-w-24 border px-2 py-1 ${isSelected ? "outline outline-2 outline-emerald-600" : ""} ${cell.align === "center" ? "text-center" : cell.align === "right" ? "text-right" : "text-left"}`}
                      >
                        {isEditing ? (
                          <input
                            ref={editInputRef}
                            value={editValue}
                            onChange={(event) => setEditValue(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") { commitEdit(ref, editValue); move(1, 0); }
                              else if (event.key === "Tab") { event.preventDefault(); commitEdit(ref, editValue); move(0, 1); }
                              else if (event.key === "Escape") setEditingRef(null);
                            }}
                            onBlur={() => commitEdit(ref, editValue)}
                            className="w-full min-w-20 border-none bg-transparent p-0 outline-none"
                            autoFocus
                          />
                        ) : (
                          <span style={{ fontWeight: cell.bold ? 700 : undefined, fontStyle: cell.italic ? "italic" : undefined, textDecoration: cell.underline ? "underline" : undefined, color: cell.fontColor ? `#${cell.fontColor}` : undefined }}>
                            {formatNumberDisplay(computed, cell.numberFormat)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="flex items-center justify-between gap-3 border-t bg-slate-950 px-4 py-3 text-white">
        <p aria-live="polite" className="text-sm font-bold">Autosave: {status}</p>
        <button type="button" disabled={submitted} onClick={submit} className="rounded-xl bg-red-600 px-5 py-3 font-black text-white outline-none hover:bg-red-500 disabled:bg-slate-500">Submit Final Sheet</button>
      </footer>
    </div>
  );
}

function shiftRows(cells: Record<string, SheetCell>, at: number, delta: number): Record<string, SheetCell> {
  const next: Record<string, SheetCell> = {};
  for (const [ref, cell] of Object.entries(cells)) {
    const parsed = cellRef(ref);
    if (!parsed) continue;
    if (delta > 0 && parsed.row >= at) next[refAt(parsed.row + 1, parsed.col)] = cell;
    else if (delta < 0 && parsed.row === at) continue;
    else if (delta < 0 && parsed.row > at) next[refAt(parsed.row - 1, parsed.col)] = cell;
    else next[ref] = cell;
  }
  return next;
}
function shiftColumns(cells: Record<string, SheetCell>, at: number, delta: number): Record<string, SheetCell> {
  const next: Record<string, SheetCell> = {};
  for (const [ref, cell] of Object.entries(cells)) {
    const parsed = cellRef(ref);
    if (!parsed) continue;
    if (delta > 0 && parsed.col >= at) next[refAt(parsed.row, parsed.col + 1)] = cell;
    else if (delta < 0 && parsed.col === at) continue;
    else if (delta < 0 && parsed.col > at) next[refAt(parsed.row, parsed.col - 1)] = cell;
    else next[ref] = cell;
  }
  return next;
}

function RibbonButton({ children, onClick, active, label }: { children: React.ReactNode; onClick: () => void; active?: boolean; label: string }) {
  return <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onClick} aria-pressed={active} aria-label={label} title={label} className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-black ${active ? "border-emerald-600 bg-emerald-100 text-emerald-900" : "border-slate-200 bg-white hover:bg-slate-50"}`}>{children}</button>;
}
function ColorMenu({ label, colors, onPick, swatch }: { label: string; colors: string[]; onPick: (color: string) => void; swatch: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <RibbonButton onClick={() => setOpen((value) => !value)} label={label}>{swatch}</RibbonButton>
      {open && (
        <span className="absolute left-0 top-full z-20 mt-1 flex gap-1 rounded-lg border bg-white p-2 shadow-lg">
          {colors.map((color) => <button key={color} type="button" aria-label={color} onMouseDown={(event) => event.preventDefault()} onClick={() => { onPick(color.replace("#", "")); setOpen(false); }} className="h-6 w-6 rounded border" style={{ backgroundColor: color }} />)}
        </span>
      )}
    </span>
  );
}
