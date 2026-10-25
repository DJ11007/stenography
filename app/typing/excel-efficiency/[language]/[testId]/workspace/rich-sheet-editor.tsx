"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { columnLetters } from "@/lib/excel-formula";
import { autosaveExcelDocument, submitExcelDocument } from "../../../actions";
import { ConfirmDialog } from "@/components/efficiency/exam-chrome";
import { PAPER_SIZES, toExcelDocumentV3, type ExcelDocument, type ExcelDocumentV2, type HeaderFooter, type SheetCell, type SheetSettings } from "@/lib/excel-document";
import {
  EMPTY_CELL, DEFAULT_FONT, DEFAULT_FONT_SIZE, MAX_COLS, MAX_ROWS, STYLE_KEYS, applyBorder, autoSumRange, borderCss, expandForMerges, formatCellValue, isBlankCell,
  mergeAt, mergeRanges, normalizeRect, parseEntry, parseRange, previewHeaderText, rangeString, recomputeFormulas, rectContains, rectRefs, refAt,
  shiftColumns, shiftRows, unmergeRanges, usedExtent, type BorderStyle, type Rect,
} from "@/lib/excel-sheet-model";

export type { ExcelDocument } from "@/lib/excel-document";

// The Excel Efficiency workspace, laid out like Microsoft Excel 2013: FILE / HOME / INSERT / PAGE LAYOUT /
// FORMULAS / VIEW ribbon, Name Box and formula bar, a grid with merged cells, drag selection, typing straight
// into a cell, Ctrl shortcuts, Format Painter, Header & Footer, page setup and the status bar. Everything a
// question can ask about is saved in the sheet (schemaVersion "3") so the marking can check it.

const FONTS = ["Calibri", "Calibri Light", "Arial", "Arial Black", "Cambria", "Times New Roman", "Verdana", "Tahoma", "Georgia", "Courier New", "Trebuchet MS", "Comic Sans MS", "Segoe UI", "Mangal", "Kruti Dev 010"];
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
const THEME_COLORS = [
  ["FFFFFF", "000000", "E7E6E6", "44546A", "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47"],
  ["F2F2F2", "7F7F7F", "D0CECE", "D6DCE4", "D9E2F3", "FBE5D5", "EDEDED", "FFF2CC", "DEEBF6", "E2EFD9"],
  ["D8D8D8", "595959", "AEABAB", "ADB9CA", "B4C6E7", "F7CBAC", "DBDBDB", "FFE599", "BDD7EE", "C5E0B3"],
  ["BFBFBF", "3F3F3F", "757070", "8496B0", "8EAADB", "F4B183", "C9C9C9", "FFD965", "9CC3E5", "A8D08D"],
  ["A5A5A5", "262626", "3A3838", "323F4F", "2F5496", "C55A11", "7B7B7B", "BF9000", "2E75B5", "538135"],
  ["7F7F7F", "0C0C0C", "171616", "222A35", "1F3864", "833C0B", "525252", "7F6000", "1E4E79", "375623"],
];
const STANDARD_COLORS: [string, string][] = [["C00000", "Dark Red"], ["FF0000", "Red"], ["FFC000", "Orange"], ["FFFF00", "Yellow"], ["92D050", "Light Green"], ["00B050", "Green"], ["00B0F0", "Light Blue"], ["0070C0", "Blue"], ["002060", "Dark Blue"], ["7030A0", "Purple"]];
const PAPER_LABELS: Record<string, string> = { Letter: "Letter 8.5\" × 11\"", Legal: "Legal 8.5\" × 14\"", A4: "A4 8.27\" × 11.69\"", A5: "A5 5.83\" × 8.27\"", A3: "A3 11.69\" × 16.54\"", Executive: "Executive 7.25\" × 10.5\"", Tabloid: "Tabloid 11\" × 17\"", B5: "B5 6.93\" × 9.84\"" };
const HEADER_CODES: [string, string][] = [["&[Page]", "Page Number"], ["&[Pages]", "Number of Pages"], ["&[Date]", "Current Date"], ["&[Time]", "Current Time"], ["&[File]", "File Name"], ["&[Tab]", "Sheet Name"]];
const COL_WIDTH = 72, ROW_HEADER_WIDTH = 40;

type Snapshot = { cells: Record<string, SheetCell>; merges: string[]; sheet: SheetSettings };
type Tab = "HOME" | "INSERT" | "PAGE LAYOUT" | "FORMULAS" | "VIEW";
type Clip = { rect: Rect; cells: Record<string, SheetCell>; cut: boolean };

const cellOf = (cells: Record<string, SheetCell>, ref: string): SheetCell => cells[ref] ?? EMPTY_CELL;
const styleOf = (cell: SheetCell) => Object.fromEntries(STYLE_KEYS.map((key) => [key, cell[key] ?? null])) as Partial<SheetCell>;

export function RichSheetEditor({ attemptId, original, initialDocument, locked, autoSubmit = false }: { attemptId: string; original: ExcelDocument | ExcelDocumentV2; initialDocument?: ExcelDocument | ExcelDocumentV2 | null; locked: boolean; autoSubmit?: boolean }) {
  const router = useRouter();
  const start = useMemo(() => toExcelDocumentV3(initialDocument) ?? toExcelDocumentV3(original)!, []); // eslint-disable-line react-hooks/exhaustive-deps -- the starting sheet only
  // The saved sheet never has fewer rows/columns than the starting sheet.
  const [baseRows] = useState(() => toExcelDocumentV3(original)?.rows ?? start.rows), [baseCols] = useState(() => toExcelDocumentV3(original)?.cols ?? start.cols);
  const [cells, setCells] = useState<Record<string, SheetCell>>(start.cells);
  const [merges, setMerges] = useState<string[]>(start.merges);
  const [sheet, setSheet] = useState<SheetSettings>(start.sheet);
  const [operations, setOperations] = useState<string[]>(start.operations ?? []);
  const [anchor, setAnchor] = useState({ row: 1, col: 0 });
  const [focus, setFocus] = useState({ row: 1, col: 0 });
  const [editing, setEditing] = useState<{ ref: string; value: string; fromBar: boolean } | null>(null);
  const [tab, setTab] = useState<Tab>("HOME");
  const [menu, setMenu] = useState<string | null>(null);
  const [painter, setPainter] = useState<{ style: Partial<SheetCell>; sticky: boolean } | null>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  const [headerDialog, setHeaderDialog] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState("Ready");
  const [submitted, setSubmitted] = useState(locked);
  const [finalSubmitting, setFinalSubmitting] = useState(false);
  const [lastFont, setLastFont] = useState("FF0000"), [lastFill, setLastFill] = useState("FFFF00");
  const undoStack = useRef<Snapshot[]>([]), redoStack = useRef<Snapshot[]>([]);
  const dragging = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  // The grid listens through a hidden text box, as Google Sheets does: typed text arrives whether it comes as
  // key presses, from an input method (Hindi keyboards, phones) or as pasted text.
  const typingRef = useRef<HTMLInputElement>(null);
  const focusGrid = () => typingRef.current?.focus({ preventScroll: true });
  // Counts changes to the sheet; autosave runs after each one (never on first load).
  const [revision, setRevision] = useState(0);

  const selection = useMemo(() => expandForMerges(normalizeRect(anchor, focus), merges), [anchor, focus, merges]);
  const activeRef = refAt(focus.row, focus.col);
  const activeMerge = mergeAt(merges, focus.row, focus.col);
  const activeCellRef = activeMerge ? refAt(activeMerge.r1, activeMerge.c1) : activeRef;
  const active = cellOf(cells, activeCellRef);
  const displayRows = useMemo(() => { const extent = usedExtent(cells, merges, sheet, baseRows, baseCols); return Math.min(MAX_ROWS, Math.max(50, extent.rows + 25, focus.row + 10)); }, [cells, merges, sheet, focus.row, baseRows, baseCols]);
  const displayCols = MAX_COLS;

  // ---------- saving ----------
  const buildDocument = useCallback((c = cells, m = merges, s = sheet, ops = operations): ExcelDocument => {
    const values = recomputeFormulas(c);
    const kept = Object.fromEntries(Object.entries(values).filter(([, cell]) => !isBlankCell(cell)));
    const extent = usedExtent(kept, m, s, baseRows, baseCols);
    return { schemaVersion: "3", rows: extent.rows, cols: extent.cols, cells: kept, merges: m, sheet: s, operations: ops.slice(0, 256), savedAt: new Date().toISOString() };
  }, [cells, merges, sheet, operations, baseRows, baseCols]);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (revision === 0 || submitted) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      setStatus("Saving…");
      const result = await autosaveExcelDocument(attemptId, buildDocument());
      setStatus(result.ok ? "Saved" : result.error);
    }, 800);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [revision]); // eslint-disable-line react-hooks/exhaustive-deps -- saves after each change

  // Development only: lets the local test page read the sheet as it would be saved.
  useEffect(() => { if (process.env.NODE_ENV !== "production") (window as unknown as { __excelDocument?: () => ExcelDocument }).__excelDocument = () => buildDocument(); });

  // ---------- changing the sheet (one undo step each) ----------
  const record = (op: string) => setOperations((current) => (current.includes(op) ? current : [...current, op]));
  const change = (op: string, next: Partial<Snapshot>) => {
    if (submitted) return;
    undoStack.current.push({ cells, merges, sheet }); if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
    if (next.cells) setCells(recomputeFormulas(next.cells));
    if (next.merges) setMerges(next.merges);
    if (next.sheet) setSheet(next.sheet);
    record(op);
    setStatus("Unsaved changes");
    setRevision((value) => value + 1);
  };
  const undo = () => { const last = undoStack.current.pop(); if (!last) return; redoStack.current.push({ cells, merges, sheet }); setCells(last.cells); setMerges(last.merges); setSheet(last.sheet); setRevision((value) => value + 1); };
  const redo = () => { const next = redoStack.current.pop(); if (!next) return; undoStack.current.push({ cells, merges, sheet }); setCells(next.cells); setMerges(next.merges); setSheet(next.sheet); setRevision((value) => value + 1); };
  const setSheetOption = <K extends keyof SheetSettings>(key: K, value: SheetSettings[K], op: string) => change(op, { sheet: { ...sheet, [key]: value } });

  /** Apply a formatting change to every cell of the selection (merged areas included). */
  const formatSelection = (patch: Partial<SheetCell>, op: string, rect = selection) => {
    const next = { ...cells };
    for (const ref of rectRefs(rect)) next[ref] = { ...cellOf(next, ref), ...patch };
    change(op, { cells: next });
  };
  const toggle = (key: "bold" | "italic" | "underline" | "wrap") => formatSelection({ [key]: !active[key] }, key);

  // ---------- selecting ----------
  const select = (row: number, col: number, extend = false) => {
    const r = Math.min(Math.max(row, 1), MAX_ROWS), c = Math.min(Math.max(col, 0), MAX_COLS - 1);
    setFocus({ row: r, col: c }); if (!extend) setAnchor({ row: r, col: c });
  };
  const selectRect = (rect: Rect) => { setAnchor({ row: rect.r1, col: rect.c1 }); setFocus({ row: rect.r2, col: rect.c2 }); };
  const moveBy = (dRow: number, dCol: number, extend = false) => {
    let row = focus.row + dRow, col = focus.col + dCol;
    const merged = mergeAt(merges, focus.row, focus.col);
    if (merged && !extend) { if (dRow > 0) row = merged.r2 + 1; if (dCol > 0) col = merged.c2 + 1; if (dRow < 0) row = merged.r1 - 1; if (dCol < 0) col = merged.c1 - 1; }
    const target = mergeAt(merges, row, col);
    if (target && !extend) { row = target.r1; col = target.c1; }
    select(row, col, extend);
  };

  // ---------- typing into cells ----------
  const beginEdit = (initial?: string, fromBar = false) => { if (submitted) return; setEditing({ ref: activeCellRef, value: initial ?? (active.formula ?? (active.value == null ? "" : String(active.value))), fromBar }); };
  useEffect(() => { if (editing && !editing.fromBar) editInputRef.current?.focus(); }, [editing?.ref]); // eslint-disable-line react-hooks/exhaustive-deps
  const commitEdit = (move: "down" | "right" | "none" = "none") => {
    if (!editing) return;
    const entry = parseEntry(editing.value);
    const current = cellOf(cells, editing.ref);
    if (entry.value !== current.value || entry.formula !== current.formula) {
      const fn = entry.formula?.match(/^=\s*([A-Z]+)\s*\(/i)?.[1]?.toUpperCase();
      change(fn ? `formula:${fn}` : entry.formula ? "formula" : "edit", { cells: { ...cells, [editing.ref]: { ...current, ...entry } } });
    }
    setEditing(null);
    if (move === "down") moveBy(1, 0); else if (move === "right") moveBy(0, 1);
    focusGrid();
  };
  const clearContents = () => { const next = { ...cells }; for (const ref of rectRefs(selection)) if (next[ref]) next[ref] = { ...next[ref], value: null, formula: null }; change("clearContents", { cells: next }); };
  const clearFormats = () => { const next = { ...cells }; for (const ref of rectRefs(selection)) if (next[ref]) next[ref] = { ...EMPTY_CELL, value: next[ref].value, formula: next[ref].formula }; change("clearFormats", { cells: next }); };
  const clearAll = () => { const next = { ...cells }; for (const ref of rectRefs(selection)) delete next[ref]; change("clearContents", { cells: next, merges: unmergeRanges(merges, selection) }); };

  // ---------- clipboard and Format Painter ----------
  const copy = (cut = false) => {
    const copied: Record<string, SheetCell> = {};
    for (const ref of rectRefs(selection)) copied[ref] = cellOf(cells, ref);
    setClip({ rect: selection, cells: copied, cut }); record(cut ? "cut" : "copy");
    const text = Array.from({ length: selection.r2 - selection.r1 + 1 }, (_, i) => Array.from({ length: selection.c2 - selection.c1 + 1 }, (_, j) => { const cell = copied[refAt(selection.r1 + i, selection.c1 + j)]; return cell?.value == null ? "" : String(cell.value); }).join("\t")).join("\n");
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    setNotice(cut ? "Select where to paste, then press Paste (Ctrl+V)." : null);
  };
  const paste = () => {
    if (!clip) { setNotice("Copy or cut cells first (Ctrl+C / Ctrl+X), then select where to paste."); return; }
    const next = { ...cells };
    if (clip.cut) for (const ref of rectRefs(clip.rect)) delete next[ref];
    const height = clip.rect.r2 - clip.rect.r1, width = clip.rect.c2 - clip.rect.c1;
    for (let i = 0; i <= height; i++) for (let j = 0; j <= width; j++) {
      const row = focus.row + i, col = focus.col + j;
      if (row > MAX_ROWS || col >= MAX_COLS) continue;
      next[refAt(row, col)] = { ...clip.cells[refAt(clip.rect.r1 + i, clip.rect.c1 + j)] };
    }
    change("paste", { cells: next });
    selectRect({ r1: focus.row, c1: focus.col, r2: Math.min(MAX_ROWS, focus.row + height), c2: Math.min(MAX_COLS - 1, focus.col + width) });
    if (clip.cut) setClip(null);
    setNotice(null);
  };
  /** Ctrl+V: cells copied here, or else text copied from elsewhere (tabs and lines become cells). */
  const pasteText = (text: string) => {
    if (clip) { paste(); return; }
    const lines = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").slice(0, MAX_ROWS);
    if (!lines.length || (lines.length === 1 && lines[0] === "")) return;
    const next = { ...cells };
    lines.forEach((line, i) => line.split("\t").slice(0, MAX_COLS).forEach((part, j) => {
      const row = focus.row + i, col = focus.col + j;
      if (row > MAX_ROWS || col >= MAX_COLS) return;
      const ref = refAt(row, col);
      next[ref] = { ...cellOf(next, ref), ...parseEntry(part) };
    }));
    change("paste", { cells: next });
  };
  const startPainter = (sticky: boolean) => { setPainter({ style: styleOf(active), sticky }); setNotice(sticky ? "Format Painter is on: click the cells to format. Press Esc or click Format Painter to stop." : "Click (or drag over) the cells to give them this formatting."); };
  const applyPainter = (rect: Rect) => {
    if (!painter) return;
    formatSelection(painter.style, "formatPainter", rect);
    if (!painter.sticky) { setPainter(null); setNotice(null); }
  };

  // ---------- merging ----------
  const merge = (kind: "center" | "across" | "cells") => {
    if (selection.r1 === selection.r2 && selection.c1 === selection.c2) { setNotice("Select two or more cells to merge."); return; }
    const result = mergeRanges(cells, merges, selection, kind === "across");
    let nextCells = result.cells;
    if (kind === "center") for (const ref of rectRefs(selection)) nextCells = { ...nextCells, [ref]: { ...cellOf(nextCells, ref), align: "center" } };
    change(kind === "center" ? "mergeCenter" : kind === "across" ? "mergeAcross" : "mergeCells", { cells: nextCells, merges: result.merges });
    if (result.discarded) setNotice("Merging cells only keeps the upper-left value and discards other values.");
  };
  const unmerge = () => change("unmerge", { merges: unmergeRanges(merges, selection) });
  // Merge & Center on a merged cell unmerges it, as in Excel.
  const mergeCenterToggle = () => { if (activeMerge) unmerge(); else merge("center"); };

  // ---------- rows, columns, sorting, AutoSum ----------
  const insertRow = () => { const shifted = shiftRows(cells, merges, selection.r1, 1); change("insertRow", shifted); };
  const deleteRow = () => { const shifted = shiftRows(cells, merges, selection.r1, -1); change("deleteRow", shifted); };
  const insertColumn = () => { const shifted = shiftColumns(cells, merges, selection.c1, 1); change("insertColumn", shifted); };
  const deleteColumn = () => { const shifted = shiftColumns(cells, merges, selection.c1, -1); change("deleteColumn", shifted); };
  const sortSelection = (direction: "asc" | "desc") => {
    if (selection.r1 === selection.r2) { setNotice("Select the rows to sort first."); return; }
    const rows = Array.from({ length: selection.r2 - selection.r1 + 1 }, (_, i) => selection.r1 + i);
    const key = (row: number) => cellOf(cells, refAt(row, selection.c1)).value;
    const ordered = [...rows].sort((a, b) => { const x = key(a), y = key(b); const result = typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? "")); return direction === "asc" ? result : -result; });
    const next = { ...cells };
    ordered.forEach((fromRow, index) => { for (let col = selection.c1; col <= selection.c2; col++) next[refAt(rows[index], col)] = cellOf(cells, refAt(fromRow, col)); });
    change(direction === "asc" ? "sortAscending" : "sortDescending", { cells: next });
  };
  const autoSum = (fn = "SUM") => {
    const range = autoSumRange(cells, focus.row, focus.col);
    if (!range) { beginEdit(`=${fn}()`); return; }
    const formula = `=${fn}(${range})`;
    change(`formula:${fn}`, { cells: { ...cells, [activeCellRef]: { ...active, ...parseEntry(formula) } } });
    record("autoSum");
  };

  // ---------- keyboard ----------
  const onGridKey = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (editing) return;
    const ctrl = event.ctrlKey || event.metaKey, key = event.key;
    // Ctrl+V is left to the paste event (onPaste), which also brings in text copied from elsewhere.
    if (ctrl && key.toLowerCase() === "v") return;
    if (ctrl && ["b", "i", "u", "c", "x", "z", "y", "a"].includes(key.toLowerCase())) {
      event.preventDefault();
      const k = key.toLowerCase();
      if (submitted && !["c", "a"].includes(k)) return;
      if (k === "b") toggle("bold"); else if (k === "i") toggle("italic"); else if (k === "u") toggle("underline");
      else if (k === "c") copy(); else if (k === "x") copy(true);
      else if (k === "z") undo(); else if (k === "y") redo(); else if (k === "a") selectRect({ r1: 1, c1: 0, r2: displayRows, c2: displayCols - 1 });
      return;
    }
    if (key.startsWith("Arrow")) { event.preventDefault(); const [dr, dc] = key === "ArrowUp" ? [-1, 0] : key === "ArrowDown" ? [1, 0] : key === "ArrowLeft" ? [0, -1] : [0, 1]; moveBy(dr, dc, event.shiftKey); return; }
    if (key === "Enter") { event.preventDefault(); moveBy(event.shiftKey ? -1 : 1, 0); return; }
    if (key === "Tab") { event.preventDefault(); moveBy(0, event.shiftKey ? -1 : 1); return; }
    if (key === "Escape") { setPainter(null); setClip(null); setNotice(null); setMenu(null); return; }
    if (submitted) return;
    if (key === "Delete" || key === "Backspace") { event.preventDefault(); clearContents(); return; }
    if (key === "F2") { event.preventDefault(); beginEdit(); return; }
    if (key.length === 1 && !ctrl && !event.altKey) { event.preventDefault(); beginEdit(key); }
  };

  // ---------- submitting ----------
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [submitProblem, setSubmitProblem] = useState<string | null>(null);
  const submitting = useRef(false);
  const submittedRef = useRef(locked);
  const submitNow = async (auto = false): Promise<boolean> => {
    if (submitting.current) return false;
    const finalDocument = buildDocument();
    submitting.current = true;
    if (autosaveTimer.current) { clearTimeout(autosaveTimer.current); autosaveTimer.current = null; }
    setStatus("Submitting…"); setFinalSubmitting(true);
    const fail = (message: string) => { setStatus(message); setFinalSubmitting(false); submitting.current = false; if (!auto) setSubmitProblem(message); return false; };
    try {
      const result = await submitExcelDocument(attemptId, finalDocument);
      if (!result.ok) {
        if (/already submitted/i.test(result.error)) { submittedRef.current = true; setSubmitted(true); router.push(`/typing/excel-efficiency/results/${attemptId}`); return true; }
        return fail(result.error);
      }
      submittedRef.current = true; setSubmitted(true); setStatus("Test submitted successfully");
      router.push(`/typing/excel-efficiency/results/${attemptId}`);
      return true;
    } catch { return fail("Submission failed. Check your internet connection and try again."); }
  };
  useEffect(() => {
    if (!autoSubmit || submitted) return;
    let cancelled = false;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    void (async () => {
      await sleep(1200);
      for (let attempt = 0; attempt < 6 && !cancelled; attempt++) { if ((await submitNow(true)) || submittedRef.current) return; await sleep(2500); }
      if (!cancelled) setSubmitProblem("Time is up, but your test could not be submitted automatically. Check your internet connection, then press Submit.");
    })();
    return () => { cancelled = true; };
  }, [autoSubmit]); // eslint-disable-line react-hooks/exhaustive-deps -- runs once when the clock expires

  useEffect(() => { const stop = () => { dragging.current = false; }; window.addEventListener("mouseup", stop); return () => window.removeEventListener("mouseup", stop); }, []);
  useEffect(() => { if (!menu) return; const close = (event: MouseEvent) => { if (!(event.target as HTMLElement).closest?.("[data-xl-menu]")) setMenu(null); }; window.addEventListener("mousedown", close); return () => window.removeEventListener("mousedown", close); }, [menu]);

  // ---------- status bar figures ----------
  const stats = useMemo(() => {
    const numbers = rectRefs(selection).map((ref) => cellOf(cells, ref).value).filter((value): value is number => typeof value === "number");
    const filled = rectRefs(selection).filter((ref) => cellOf(cells, ref).value != null).length;
    return numbers.length > 1 || filled > 1 ? { sum: numbers.reduce((a, b) => a + b, 0), count: filled, average: numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : null } : null;
  }, [cells, selection]);

  const nameBoxValue = selection.r1 === selection.r2 && selection.c1 === selection.c2 ? activeRef : (activeMerge && activeMerge.r1 === selection.r1 && activeMerge.c1 === selection.c1 && activeMerge.r2 === selection.r2 && activeMerge.c2 === selection.c2) ? refAt(activeMerge.r1, activeMerge.c1) : rangeString(selection);
  const [nameBox, setNameBox] = useState<string | null>(null);
  const goToName = (text: string) => { const rect = parseRange(text.trim()); if (rect) { selectRect(rect); setNotice(null); } else setNotice("Type a cell or range such as A27 or A27:L27."); setNameBox(null); focusGrid(); };
  const formulaBarValue = editing ? editing.value : (active.formula ?? (active.value == null ? "" : String(active.value)));
  const zoom = sheet.zoom || 100;

  const ribbon = (
    <div className="border-b border-slate-300 bg-[#f3f3f3] text-[12px] text-slate-800 select-none">
      <div role="tablist" aria-label="Ribbon tabs" className="flex items-end gap-0.5 bg-white px-2 pt-1">
        <span className="mr-1 rounded-t bg-[#217346] px-3 py-1 text-[11px] font-bold text-white">FILE</span>
        {(["HOME", "INSERT", "PAGE LAYOUT", "FORMULAS", "VIEW"] as Tab[]).map((name) => (
          <button key={name} role="tab" type="button" aria-selected={tab === name} onMouseDown={(event) => event.preventDefault()} onClick={() => { setTab(name); setMenu(null); }} className={`rounded-t px-3 py-1 text-[11px] font-semibold ${tab === name ? "border border-b-0 border-slate-300 bg-[#f3f3f3] text-[#217346]" : "text-slate-600 hover:text-[#217346]"}`}>{name}</button>
        ))}
        <span className="ml-auto pb-1 text-[11px] font-bold text-slate-500" aria-live="polite">{status}</span>
      </div>
      <div role="toolbar" aria-label="Spreadsheet controls" className="flex min-h-[92px] flex-wrap items-stretch gap-0 overflow-x-auto px-1 py-1">
        {tab === "HOME" && <>
          <Group label="Clipboard">
            <Big label="Paste" icon="📋" onClick={paste} disabled={submitted} />
            <div className="flex flex-col gap-0.5">
              <Small label="Cut" icon="✂" onClick={() => copy(true)} disabled={submitted} />
              <Small label="Copy" icon="⧉" onClick={() => copy()} />
              <Small label="Format Painter" icon="🖌" active={Boolean(painter)} onClick={() => (painter ? (setPainter(null), setNotice(null)) : startPainter(false))} onDoubleClick={() => startPainter(true)} disabled={submitted} />
            </div>
          </Group>
          <Group label="Font">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <select aria-label="Font" value={active.fontFamily ?? DEFAULT_FONT} disabled={submitted} onChange={(event) => formatSelection({ fontFamily: event.target.value === DEFAULT_FONT ? null : event.target.value }, "fontFamily")} className="h-6 w-36 rounded-sm border border-slate-300 bg-white px-1 text-[12px]">
                  {FONTS.map((font) => <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>)}
                </select>
                <FontSizeBox value={active.fontSize ?? DEFAULT_FONT_SIZE} disabled={submitted} onChange={(size) => formatSelection({ fontSize: size === DEFAULT_FONT_SIZE ? null : size }, "fontSize")} />
                <Small label="Increase Font Size" icon="A▲" onClick={() => { const size = active.fontSize ?? DEFAULT_FONT_SIZE; const next = FONT_SIZES.find((s) => s > size) ?? size + 2; formatSelection({ fontSize: next }, "fontSize"); }} disabled={submitted} compact />
                <Small label="Decrease Font Size" icon="A▼" onClick={() => { const size = active.fontSize ?? DEFAULT_FONT_SIZE; const next = [...FONT_SIZES].reverse().find((s) => s < size) ?? Math.max(1, size - 1); formatSelection({ fontSize: next === DEFAULT_FONT_SIZE ? null : next }, "fontSize"); }} disabled={submitted} compact />
              </div>
              <div className="flex items-center gap-1">
                <Small label="Bold (Ctrl+B)" icon={<b>B</b>} active={active.bold} onClick={() => toggle("bold")} disabled={submitted} compact />
                <Small label="Italic (Ctrl+I)" icon={<i>I</i>} active={active.italic} onClick={() => toggle("italic")} disabled={submitted} compact />
                <Small label="Underline (Ctrl+U)" icon={<u>U</u>} active={active.underline} onClick={() => toggle("underline")} disabled={submitted} compact />
                <MenuButton id="borders" menu={menu} setMenu={setMenu} label="Borders" icon="▦" disabled={submitted}>
                  {([["bottom", "Bottom Border"], ["top", "Top Border"], ["left", "Left Border"], ["right", "Right Border"], ["none", "No Border"], ["all", "All Borders"], ["outside", "Outside Borders"], ["thickBox", "Thick Box Border"]] as [BorderStyle, string][]).map(([style, label]) => (
                    <MenuItem key={style} onClick={() => { change("border", { cells: applyBorder(cells, selection, style) }); setMenu(null); }}>{label}</MenuItem>
                  ))}
                </MenuButton>
                <ColorSplit id="fill" label="Fill Color" swatch={lastFill} icon="🪣" menu={menu} setMenu={setMenu} disabled={submitted} noneLabel="No Fill" onApply={() => formatSelection({ fillColor: lastFill }, "fillColor")} onPick={(hex) => { if (hex) setLastFill(hex); formatSelection({ fillColor: hex }, "fillColor"); }} />
                <ColorSplit id="font" label="Font Color" swatch={lastFont} icon="A" menu={menu} setMenu={setMenu} disabled={submitted} noneLabel="Automatic" onApply={() => formatSelection({ fontColor: lastFont }, "fontColor")} onPick={(hex) => { if (hex) setLastFont(hex); formatSelection({ fontColor: hex }, "fontColor"); }} />
              </div>
            </div>
          </Group>
          <Group label="Alignment">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <Small label="Top Align" icon="⬆" active={active.vAlign === "top"} onClick={() => formatSelection({ vAlign: "top" }, "vAlign")} disabled={submitted} compact />
                <Small label="Middle Align" icon="↕" active={active.vAlign === "middle"} onClick={() => formatSelection({ vAlign: "middle" }, "vAlign")} disabled={submitted} compact />
                <Small label="Bottom Align" icon="⬇" active={!active.vAlign || active.vAlign === "bottom"} onClick={() => formatSelection({ vAlign: "bottom" }, "vAlign")} disabled={submitted} compact />
                <Small label="Wrap Text" icon="↵ Wrap Text" active={Boolean(active.wrap)} onClick={() => toggle("wrap")} disabled={submitted} compact />
              </div>
              <div className="flex items-center gap-1">
                <Small label="Align Left" icon="⯇≡" active={active.align === "left"} onClick={() => formatSelection({ align: "left" }, "align")} disabled={submitted} compact />
                <Small label="Center" icon="≡" active={active.align === "center"} onClick={() => formatSelection({ align: "center" }, "align")} disabled={submitted} compact />
                <Small label="Align Right" icon="≡⯈" active={active.align === "right"} onClick={() => formatSelection({ align: "right" }, "align")} disabled={submitted} compact />
                <span data-xl-menu className="relative flex">
                  <button type="button" disabled={submitted} onMouseDown={(event) => event.preventDefault()} onClick={mergeCenterToggle} aria-label="Merge & Center" title="Merge & Center" className={`flex h-6 items-center gap-1 rounded-l-sm border px-1.5 ${activeMerge ? "border-[#217346] bg-[#d5ead9]" : "border-transparent hover:border-slate-300 hover:bg-white"} disabled:opacity-40`}>⊞ Merge &amp; Center</button>
                  <button type="button" disabled={submitted} onMouseDown={(event) => event.preventDefault()} onClick={() => setMenu(menu === "merge" ? null : "merge")} aria-label="Merge options" aria-expanded={menu === "merge"} className="flex h-6 items-center rounded-r-sm border border-transparent px-1 hover:border-slate-300 hover:bg-white disabled:opacity-40">▾</button>
                  {menu === "merge" && <Menu>
                    <MenuItem onClick={() => { merge("center"); setMenu(null); }}>Merge &amp; Center</MenuItem>
                    <MenuItem onClick={() => { merge("across"); setMenu(null); }}>Merge Across</MenuItem>
                    <MenuItem onClick={() => { merge("cells"); setMenu(null); }}>Merge Cells</MenuItem>
                    <MenuItem onClick={() => { unmerge(); setMenu(null); }}>Unmerge Cells</MenuItem>
                  </Menu>}
                </span>
              </div>
            </div>
          </Group>
          <Group label="Number">
            <div className="flex flex-col gap-1">
              <select aria-label="Number Format" value={active.numberFormat ?? "General"} disabled={submitted} onChange={(event) => formatSelection({ numberFormat: event.target.value as SheetCell["numberFormat"] }, "numberFormat")} className="h-6 w-28 rounded-sm border border-slate-300 bg-white px-1">
                {(["General", "Number", "Currency", "Percentage"] as const).map((format) => <option key={format} value={format}>{format}</option>)}
              </select>
              <div className="flex gap-1">
                <Small label="Accounting Number Format" icon="₹" onClick={() => formatSelection({ numberFormat: "Currency" }, "numberFormat")} disabled={submitted} compact />
                <Small label="Percent Style" icon="%" onClick={() => formatSelection({ numberFormat: "Percentage" }, "numberFormat")} disabled={submitted} compact />
              </div>
            </div>
          </Group>
          <Group label="Cells">
            <MenuButton id="insert" menu={menu} setMenu={setMenu} label="Insert" icon="⊕ Insert" disabled={submitted}>
              <MenuItem onClick={() => { insertRow(); setMenu(null); }}>Insert Sheet Rows</MenuItem>
              <MenuItem onClick={() => { insertColumn(); setMenu(null); }}>Insert Sheet Columns</MenuItem>
            </MenuButton>
            <MenuButton id="delete" menu={menu} setMenu={setMenu} label="Delete" icon="⊖ Delete" disabled={submitted}>
              <MenuItem onClick={() => { deleteRow(); setMenu(null); }}>Delete Sheet Rows</MenuItem>
              <MenuItem onClick={() => { deleteColumn(); setMenu(null); }}>Delete Sheet Columns</MenuItem>
            </MenuButton>
          </Group>
          <Group label="Editing">
            <div className="flex flex-col gap-0.5">
              <MenuButton id="autosum" menu={menu} setMenu={setMenu} label="AutoSum" icon="Σ AutoSum" disabled={submitted} onMain={() => autoSum("SUM")}>
                {["SUM", "AVERAGE", "COUNT", "MAX", "MIN"].map((fn) => <MenuItem key={fn} onClick={() => { autoSum(fn); setMenu(null); }}>{fn === "SUM" ? "Sum" : fn === "AVERAGE" ? "Average" : fn === "COUNT" ? "Count Numbers" : fn === "MAX" ? "Max" : "Min"}</MenuItem>)}
              </MenuButton>
              <MenuButton id="clear" menu={menu} setMenu={setMenu} label="Clear" icon="⌫ Clear" disabled={submitted}>
                <MenuItem onClick={() => { clearAll(); setMenu(null); }}>Clear All</MenuItem>
                <MenuItem onClick={() => { clearFormats(); setMenu(null); }}>Clear Formats</MenuItem>
                <MenuItem onClick={() => { clearContents(); setMenu(null); }}>Clear Contents</MenuItem>
              </MenuButton>
              <MenuButton id="sort" menu={menu} setMenu={setMenu} label="Sort & Filter" icon="⇅ Sort" disabled={submitted}>
                <MenuItem onClick={() => { sortSelection("asc"); setMenu(null); }}>Sort A to Z</MenuItem>
                <MenuItem onClick={() => { sortSelection("desc"); setMenu(null); }}>Sort Z to A</MenuItem>
              </MenuButton>
            </div>
          </Group>
        </>}
        {tab === "INSERT" && <>
          <Group label="Text">
            <Big label="Header & Footer" icon="🗎" onClick={() => setHeaderDialog(true)} disabled={submitted} />
          </Group>
          <Group label="Symbols">
            <p className="max-w-[16rem] self-center px-2 text-[11px] text-slate-500">Header &amp; Footer opens the header and footer of the printed page: click a section, then use Page Number, Current Date and the other buttons.</p>
          </Group>
        </>}
        {tab === "PAGE LAYOUT" && <>
          <Group label="Page Setup">
            <MenuButton id="margins" menu={menu} setMenu={setMenu} label="Margins" icon="▭ Margins" big disabled={submitted}>
              {(["Normal", "Wide", "Narrow"] as const).map((value) => <MenuItem key={value} checked={sheet.margins === value} onClick={() => { setSheetOption("margins", value, "margins"); setMenu(null); }}>{value}</MenuItem>)}
            </MenuButton>
            <MenuButton id="orientation" menu={menu} setMenu={setMenu} label="Orientation" icon="⇆ Orientation" big disabled={submitted}>
              <MenuItem checked={sheet.orientation === "portrait"} onClick={() => { setSheetOption("orientation", "portrait", "orientation"); setMenu(null); }}>Portrait</MenuItem>
              <MenuItem checked={sheet.orientation === "landscape"} onClick={() => { setSheetOption("orientation", "landscape", "orientation"); setMenu(null); }}>Landscape</MenuItem>
            </MenuButton>
            <MenuButton id="size" menu={menu} setMenu={setMenu} label="Size" icon="🗋 Size" big disabled={submitted}>
              {PAPER_SIZES.map((size) => <MenuItem key={size} checked={sheet.paperSize === size} onClick={() => { setSheetOption("paperSize", size, "paperSize"); setMenu(null); }}>{PAPER_LABELS[size]}</MenuItem>)}
            </MenuButton>
            <MenuButton id="printArea" menu={menu} setMenu={setMenu} label="Print Area" icon="⎙ Print Area" big disabled={submitted}>
              <MenuItem onClick={() => { setSheetOption("printArea", rangeString(selection), "printArea"); setNotice(`Print area set to ${rangeString(selection)}.`); setMenu(null); }}>Set Print Area</MenuItem>
              <MenuItem onClick={() => { setSheetOption("printArea", null, "clearPrintArea"); setMenu(null); }}>Clear Print Area</MenuItem>
            </MenuButton>
          </Group>
          <Group label="Sheet Options">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-1">
              <span className="font-semibold">Gridlines</span><span className="font-semibold">Headings</span>
              <Check label="View" ariaLabel="Gridlines: View" checked={sheet.gridlines} disabled={submitted} onChange={(value) => setSheetOption("gridlines", value, "gridlines")} />
              <Check label="View" ariaLabel="Headings: View" checked={sheet.headings} disabled={submitted} onChange={(value) => setSheetOption("headings", value, "headings")} />
              <Check label="Print" ariaLabel="Gridlines: Print" checked={sheet.printGridlines} disabled={submitted} onChange={(value) => setSheetOption("printGridlines", value, "printGridlines")} />
              <Check label="Print" ariaLabel="Headings: Print" checked={sheet.printHeadings} disabled={submitted} onChange={(value) => setSheetOption("printHeadings", value, "printHeadings")} />
            </div>
          </Group>
        </>}
        {tab === "FORMULAS" && <>
          <Group label="Function Library">
            <MenuButton id="fx-autosum" menu={menu} setMenu={setMenu} label="AutoSum" icon="Σ AutoSum" big disabled={submitted} onMain={() => autoSum("SUM")}>
              {["SUM", "AVERAGE", "COUNT", "MAX", "MIN"].map((fn) => <MenuItem key={fn} onClick={() => { autoSum(fn); setMenu(null); }}>{fn}</MenuItem>)}
            </MenuButton>
            <p className="max-w-[18rem] self-center px-2 text-[11px] text-slate-500">Type a formula in a cell or the formula bar, e.g. <b>=SUM(I3:I4)</b> or <b>=I3+I4</b>. SUM, AVERAGE, COUNT, COUNTA, MAX, MIN and IF work, with + − × ÷ and $ references.</p>
          </Group>
        </>}
        {tab === "VIEW" && <>
          <Group label="Show">
            <div className="flex flex-col gap-1 px-1">
              <Check label="Gridlines" checked={sheet.gridlines} disabled={submitted} onChange={(value) => setSheetOption("gridlines", value, "gridlines")} />
              <Check label="Formula Bar" checked={sheet.formulaBar} disabled={submitted} onChange={(value) => setSheetOption("formulaBar", value, "formulaBar")} />
              <Check label="Headings" checked={sheet.headings} disabled={submitted} onChange={(value) => setSheetOption("headings", value, "headings")} />
            </div>
          </Group>
          <Group label="Zoom">
            <Small label="Zoom Out" icon="−" onClick={() => setSheet((s) => ({ ...s, zoom: Math.max(50, (s.zoom || 100) - 10) }))} />
            <Small label="100%" icon="100%" onClick={() => setSheet((s) => ({ ...s, zoom: 100 }))} />
            <Small label="Zoom In" icon="+" onClick={() => setSheet((s) => ({ ...s, zoom: Math.min(200, (s.zoom || 100) + 10) }))} />
          </Group>
        </>}
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {finalSubmitting && <div role="status" aria-live="assertive" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
          <span className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-cyan-100 text-3xl" aria-hidden>⏳</span>
          <h2 className="mt-5 text-2xl font-black text-slate-900">Submitting your sheet…</h2>
          <p className="mt-3 leading-7 text-slate-600">Please don&apos;t close this page or click Submit again. This can take a few moments -- your sheet is safe.</p>
        </div>
      </div>}
      {ribbon}
      {sheet.formulaBar && <div className="flex items-center gap-2 border-b border-slate-300 bg-white px-2 py-1">
        <input aria-label="Name Box" value={nameBox ?? nameBoxValue} onFocus={() => setNameBox(nameBoxValue)} onChange={(event) => setNameBox(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === "Enter") goToName(nameBox ?? ""); if (event.key === "Escape") { setNameBox(null); focusGrid(); } }} onBlur={() => setNameBox(null)} className="h-6 w-24 shrink-0 rounded-sm border border-slate-300 px-1 text-[12px]" />
        <span className="px-1 text-[13px] italic text-slate-500">fx</span>
        <input aria-label="Formula bar" value={formulaBarValue} disabled={submitted}
          onFocus={() => { if (!editing) beginEdit(undefined, true); }}
          onChange={(event) => setEditing((current) => ({ ref: current?.ref ?? activeCellRef, value: event.target.value, fromBar: true }))}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitEdit("down"); } else if (event.key === "Escape") { setEditing(null); focusGrid(); } }}
          onBlur={() => { if (editing?.fromBar) commitEdit(); }}
          className="h-6 flex-1 rounded-sm border border-slate-300 px-2 font-mono text-[12px]" />
      </div>}
      {notice && <p role="status" className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">{notice}<button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="px-1">✕</button></p>}
      <div ref={gridRef} role="grid" aria-label="Worksheet" aria-readonly={submitted} onMouseDown={() => { if (!editing) requestAnimationFrame(focusGrid); }}
        onKeyDown={(event) => { if ((event.target as HTMLElement).tagName !== "INPUT") onGridKey(event); }}
        className={`relative min-h-0 flex-1 overflow-auto outline-none ${painter ? "cursor-cell" : ""}`}>
        <input ref={typingRef} aria-label={`Cell ${activeRef}`} autoComplete="off" spellCheck={false} onKeyDown={onGridKey}
          onChange={(event) => { const text = event.target.value; event.target.value = ""; if (text && !submitted && !editing) beginEdit(text); }}
          onPaste={(event) => { event.preventDefault(); if (!submitted) pasteText(event.clipboardData.getData("text/plain")); }}
          className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0" />
        <div style={{ zoom: zoom / 100 } as CSSProperties}>
          <table className="border-separate border-spacing-0 text-[13px]" style={{ tableLayout: "fixed", fontFamily: DEFAULT_FONT, width: (sheet.headings ? ROW_HEADER_WIDTH : 0) + displayCols * COL_WIDTH }}>
            <colgroup>{sheet.headings && <col style={{ width: ROW_HEADER_WIDTH }} />}{Array.from({ length: displayCols }, (_, col) => <col key={col} style={{ width: COL_WIDTH }} />)}</colgroup>
            {sheet.headings && <thead>
              <tr>
                <th onMouseDown={(event) => { event.preventDefault(); selectRect({ r1: 1, c1: 0, r2: displayRows, c2: displayCols - 1 }); focusGrid(); }} className="sticky left-0 top-0 z-30 h-5 border-b border-r border-slate-300 bg-[#e6e6e6]" aria-label="Select all" />
                {Array.from({ length: displayCols }, (_, col) => (
                  <th key={col} scope="col" onMouseDown={(event) => { event.preventDefault(); if (event.shiftKey) setFocus({ row: displayRows, col }); else { setAnchor({ row: 1, col }); setFocus({ row: displayRows, col }); } focusGrid(); }}
                    className={`sticky top-0 z-20 h-5 border-b border-r border-slate-300 text-[11px] font-normal ${col >= selection.c1 && col <= selection.c2 ? "bg-[#d3d3d3] text-[#217346]" : "bg-[#f3f3f3] text-slate-600"}`}>{columnLetters(col)}</th>
                ))}
              </tr>
            </thead>}
            <tbody>
              {Array.from({ length: displayRows }, (_, index) => {
                const row = index + 1;
                return (
                  <tr key={row}>
                    {sheet.headings && <th scope="row" onMouseDown={(event) => { event.preventDefault(); if (event.shiftKey) setFocus({ row, col: displayCols - 1 }); else { setAnchor({ row, col: 0 }); setFocus({ row, col: displayCols - 1 }); } focusGrid(); }}
                      className={`sticky left-0 z-10 border-b border-r border-slate-300 px-1 text-right text-[11px] font-normal ${row >= selection.r1 && row <= selection.r2 ? "bg-[#d3d3d3] text-[#217346]" : "bg-[#f3f3f3] text-slate-600"}`}>{row}</th>}
                    {Array.from({ length: displayCols }, (_, col) => {
                      const merged = mergeAt(merges, row, col);
                      if (merged && (merged.r1 !== row || merged.c1 !== col)) return null;
                      const ref = refAt(row, col), cell = cellOf(cells, ref);
                      const span = merged ? { rowSpan: merged.r2 - merged.r1 + 1, colSpan: merged.c2 - merged.c1 + 1 } : {};
                      const inSelection = rectContains(selection, row, col);
                      const isActive = merged ? rectContains(merged, focus.row, focus.col) : ref === activeRef;
                      const isEditing = editing?.ref === ref && !editing.fromBar;
                      const numeric = typeof cell.value === "number";
                      const align = cell.align ?? (numeric ? "right" : "left");
                      // As in Excel, text runs on into the next cells only while they are empty.
                      const neighbour = cells[refAt(row, col + 1)];
                      const spill = !cell.wrap && !merged && !numeric && cell.value != null && align === "left" && (!neighbour || (neighbour.value == null && !neighbour.formula)) && !mergeAt(merges, row, col + 1);
                      const style: CSSProperties = {
                        backgroundColor: cell.fillColor ? `#${cell.fillColor}` : inSelection && !isActive ? "#dbe8f7" : undefined,
                        borderRight: sheet.gridlines ? "1px solid #d4d4d4" : "1px solid transparent", borderBottom: sheet.gridlines ? "1px solid #d4d4d4" : "1px solid transparent",
                        ...borderCss(cell.border),
                        textAlign: align, verticalAlign: cell.vAlign === "middle" ? "middle" : cell.vAlign === "top" ? "top" : "bottom",
                        fontFamily: cell.fontFamily ? `"${cell.fontFamily}", ${DEFAULT_FONT}, sans-serif` : undefined, fontSize: `${((cell.fontSize ?? DEFAULT_FONT_SIZE) * 4) / 3}px`,
                        fontWeight: cell.bold ? 700 : undefined, fontStyle: cell.italic ? "italic" : undefined, textDecoration: cell.underline ? "underline" : undefined, color: cell.fontColor ? `#${cell.fontColor}` : undefined,
                        whiteSpace: cell.wrap ? "normal" : "nowrap", overflow: spill ? "visible" : "hidden", height: 20, lineHeight: 1.2, zIndex: spill ? 1 : undefined,
                        outline: isActive ? "2px solid #217346" : undefined, outlineOffset: -2,
                      };
                      return (
                        <td key={ref} {...span} role="gridcell" aria-selected={inSelection} data-ref={ref} style={style}
                          className="relative max-w-0 px-1"
                          onMouseDown={(event) => {
                            if (editing && !isEditing) commitEdit();
                            focusGrid();
                            if (painter) { dragging.current = true; select(row, col); return; }
                            dragging.current = true;
                            select(row, col, event.shiftKey);
                          }}
                          onMouseEnter={() => { if (dragging.current) setFocus({ row, col }); }}
                          onMouseUp={() => { if (painter && dragging.current) { dragging.current = false; applyPainter(expandForMerges(normalizeRect(anchor, { row, col }), merges)); } }}
                          onDoubleClick={() => beginEdit()}>
                          {isEditing ? (
                            <input ref={editInputRef} aria-label={`Edit ${ref}`} value={editing.value} onChange={(event) => setEditing({ ref, value: event.target.value, fromBar: false })}
                              onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Enter") { event.preventDefault(); commitEdit("down"); } else if (event.key === "Tab") { event.preventDefault(); commitEdit("right"); } else if (event.key === "Escape") { setEditing(null); focusGrid(); } }}
                              onBlur={() => commitEdit()} className="absolute inset-0 z-10 w-full min-w-[120px] border-2 border-[#217346] bg-white px-1 outline-none" style={{ fontSize: style.fontSize, fontFamily: style.fontFamily as string | undefined }} />
                          ) : (
                            <span className="block" style={{ overflow: spill ? "visible" : "hidden", textOverflow: "clip", position: spill ? "relative" : undefined }}>{formatCellValue(cell.value, cell.numberFormat)}</span>
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
      </div>
      <div className="flex items-center gap-3 border-t border-slate-300 bg-[#f3f3f3] px-3 py-0.5 text-[11px] text-slate-600">
        <span className="rounded-t border border-b-0 border-slate-300 bg-white px-3 py-0.5 font-semibold text-[#217346]">Sheet1</span>
        <span>{editing ? "Edit" : painter ? "Format Painter" : clip ? "Select destination and press ENTER or choose Paste" : "Ready"}</span>
        {sheet.printArea && <span>Print area: {sheet.printArea}</span>}
        <span>{sheet.orientation === "landscape" ? "Landscape" : "Portrait"} · {sheet.paperSize}</span>
        {(sheet.header.left || sheet.header.center || sheet.header.right) && <span>Header: {[sheet.header.left, sheet.header.center, sheet.header.right].map((part) => previewHeaderText(part)).filter(Boolean).join(" | ")}</span>}
        <span className="ml-auto">{stats && <>{stats.average !== null && <>Average: {formatCellValue(stats.average, "General")} · </>}Count: {stats.count}{stats.average !== null && <> · Sum: {formatCellValue(stats.sum, "General")}</>}</>}</span>
        <span>{zoom}%</span>
      </div>
      <ConfirmDialog open={confirmSubmitOpen} title="Submit your test?" message="Submit your final sheet? You cannot edit it afterward." confirmLabel="Yes, submit" cancelLabel="Not yet" onCancel={() => setConfirmSubmitOpen(false)} onConfirm={() => { setConfirmSubmitOpen(false); void submitNow(false); }} />
      <ConfirmDialog open={submitProblem !== null} title="Could not submit" message={submitProblem} confirmLabel="OK" cancelLabel={null} tone="primary" onCancel={() => setSubmitProblem(null)} onConfirm={() => setSubmitProblem(null)} />
      {headerDialog && <HeaderFooterDialog header={sheet.header} footer={sheet.footer} onCancel={() => setHeaderDialog(false)} onOk={(header, footer) => { setHeaderDialog(false); const usedPage = [header, footer].some((part) => Object.values(part).some((text) => /&\[Page\]/i.test(text ?? ""))); change(usedPage ? "pageNumber" : "header", { sheet: { ...sheet, header, footer } }); record("header"); }} />}
      <footer className="flex items-center justify-between gap-3 border-t bg-slate-950 px-4 py-2 text-white">
        <p aria-live="polite" className="text-sm font-bold">Autosave: {status}</p>
        <button type="button" disabled={submitted} onClick={() => { if (editing) commitEdit(); if (!submitted) setConfirmSubmitOpen(true); }} className="rounded-xl bg-red-600 px-5 py-2.5 font-black text-white outline-none hover:bg-red-500 disabled:bg-slate-500">Submit</button>
      </footer>
    </div>
  );
}

// ---------- ribbon parts ----------
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return <div role="group" aria-label={label} className="flex flex-col border-r border-slate-300 px-2"><div className="flex flex-1 items-start gap-1">{children}</div><span className="mt-0.5 text-center text-[10px] text-slate-500">{label}</span></div>;
}
function Big({ label, icon, onClick, disabled }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClick} aria-label={label} title={label} className="flex w-14 flex-col items-center gap-0.5 rounded-sm border border-transparent px-1 py-1 hover:border-slate-300 hover:bg-white disabled:opacity-40"><span className="text-xl leading-none">{icon}</span><span className="text-[11px] leading-tight">{label}</span></button>;
}
function Small({ label, icon, onClick, onDoubleClick, active, disabled, compact }: { label: string; icon: React.ReactNode; onClick: () => void; onDoubleClick?: () => void; active?: boolean; disabled?: boolean; compact?: boolean }) {
  return <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClick} onDoubleClick={onDoubleClick} aria-label={label} aria-pressed={active} title={label} className={`flex h-6 items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 ${active ? "border-[#217346] bg-[#d5ead9]" : "border-transparent hover:border-slate-300 hover:bg-white"} disabled:opacity-40`}>{icon}{!compact && <span>{label}</span>}</button>;
}
function Menu({ children }: { children: React.ReactNode }) {
  return <div role="menu" className="absolute left-0 top-full z-50 mt-0.5 min-w-[11rem] rounded-sm border border-slate-300 bg-white py-1 text-[12px] shadow-lg">{children}</div>;
}
function MenuItem({ children, onClick, checked }: { children: React.ReactNode; onClick: () => void; checked?: boolean }) {
  return <button type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={onClick} className={`flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-[#d5ead9] ${checked ? "font-bold text-[#217346]" : ""}`}><span className="w-3">{checked ? "✓" : ""}</span>{children}</button>;
}
function MenuButton({ id, menu, setMenu, label, icon, children, disabled, big, onMain }: { id: string; menu: string | null; setMenu: (value: string | null) => void; label: string; icon: React.ReactNode; children: React.ReactNode; disabled?: boolean; big?: boolean; onMain?: () => void }) {
  const open = menu === id;
  return (
    <span data-xl-menu className="relative flex">
      {onMain && <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onMain} aria-label={label} title={label} className="flex h-6 items-center rounded-l-sm border border-transparent px-1.5 hover:border-slate-300 hover:bg-white disabled:opacity-40">{icon}</button>}
      <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => setMenu(open ? null : id)} aria-label={onMain ? `${label} options` : label} aria-haspopup="menu" aria-expanded={open} title={label}
        className={`flex items-center gap-1 whitespace-nowrap rounded-sm border border-transparent px-1.5 hover:border-slate-300 hover:bg-white disabled:opacity-40 ${big ? "h-14 flex-col justify-center" : "h-6"}`}>{!onMain && icon} ▾</button>
      {open && <Menu>{children}</Menu>}
    </span>
  );
}
function ColorSplit({ id, label, swatch, icon, menu, setMenu, onApply, onPick, noneLabel, disabled }: { id: string; label: string; swatch: string; icon: string; menu: string | null; setMenu: (value: string | null) => void; onApply: () => void; onPick: (hex: string | null) => void; noneLabel: string; disabled?: boolean }) {
  const open = menu === id;
  return (
    <span data-xl-menu className="relative flex">
      <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onApply} aria-label={label} title={label} className="flex h-6 flex-col items-center justify-center rounded-l-sm border border-transparent px-1 hover:border-slate-300 hover:bg-white disabled:opacity-40"><span className="text-[12px] font-bold leading-none">{icon}</span><span className="mt-0.5 h-1 w-4" style={{ backgroundColor: `#${swatch}` }} /></button>
      <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => setMenu(open ? null : id)} aria-label={`${label} palette`} aria-expanded={open} className="flex h-6 items-center rounded-r-sm border border-transparent px-0.5 hover:border-slate-300 hover:bg-white disabled:opacity-40">▾</button>
      {open && (
        <div role="menu" aria-label={`${label} palette`} className="absolute left-0 top-full z-50 mt-0.5 w-56 rounded-sm border border-slate-300 bg-white p-2 shadow-lg">
          <button type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => { onPick(null); setMenu(null); }} className="mb-1 w-full rounded-sm px-1 py-0.5 text-left text-[12px] hover:bg-[#d5ead9]">{noneLabel}</button>
          <p className="text-[11px] font-semibold text-slate-500">Theme Colors</p>
          <div className="mt-1 grid grid-cols-10 gap-0.5">{THEME_COLORS.flat().map((hex, index) => <button key={`${hex}-${index}`} type="button" role="menuitem" aria-label={`#${hex}`} title={`#${hex}`} onMouseDown={(event) => event.preventDefault()} onClick={() => { onPick(hex); setMenu(null); }} className="h-4 w-4 border border-slate-200" style={{ backgroundColor: `#${hex}` }} />)}</div>
          <p className="mt-2 text-[11px] font-semibold text-slate-500">Standard Colors</p>
          <div className="mt-1 grid grid-cols-10 gap-0.5">{STANDARD_COLORS.map(([hex, name]) => <button key={hex} type="button" role="menuitem" aria-label={`${name} (#${hex})`} title={name} onMouseDown={(event) => event.preventDefault()} onClick={() => { onPick(hex); setMenu(null); }} className="h-4 w-4 border border-slate-200" style={{ backgroundColor: `#${hex}` }} />)}</div>
        </div>
      )}
    </span>
  );
}
function FontSizeBox({ value, onChange, disabled }: { value: number; onChange: (size: number) => void; disabled?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const apply = (raw: string) => { const size = Number(raw); if (Number.isFinite(size) && size >= 1 && size <= 409) onChange(Math.round(size * 2) / 2); setText(null); };
  return (
    <span className="flex">
      <input aria-label="Font Size" list="xl-font-sizes" disabled={disabled} value={text ?? String(value)} onChange={(event) => { setText(event.target.value); if (FONT_SIZES.includes(Number(event.target.value))) apply(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); apply(text ?? String(value)); } }} onBlur={() => { if (text !== null) apply(text); }} className="h-6 w-12 rounded-sm border border-slate-300 bg-white px-1 text-[12px]" />
      <datalist id="xl-font-sizes">{FONT_SIZES.map((size) => <option key={size} value={size} />)}</datalist>
    </span>
  );
}
function Check({ label, checked, onChange, disabled, ariaLabel }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; ariaLabel?: string }) {
  return <label className="flex items-center gap-1.5 whitespace-nowrap"><input type="checkbox" aria-label={ariaLabel ?? label} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

// Insert > Header & Footer: the three header and footer sections of the printed page, with Excel's codes.
function HeaderFooterDialog({ header, footer, onOk, onCancel }: { header: HeaderFooter; footer: HeaderFooter; onOk: (header: HeaderFooter, footer: HeaderFooter) => void; onCancel: () => void }) {
  const [h, setH] = useState<HeaderFooter>({ ...header }), [f, setF] = useState<HeaderFooter>({ ...footer });
  const [target, setTarget] = useState<{ part: "header" | "footer"; side: "left" | "center" | "right" }>({ part: "header", side: "center" });
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const insert = (code: string) => {
    const key = `${target.part}-${target.side}`, input = inputs.current[key];
    const current = (target.part === "header" ? h : f)[target.side] ?? "";
    const at = input?.selectionStart ?? current.length, end = input?.selectionEnd ?? at;
    const next = `${current.slice(0, at)}${code}${current.slice(end)}`.slice(0, 255);
    (target.part === "header" ? setH : setF)((value) => ({ ...value, [target.side]: next }));
    requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(at + code.length, at + code.length); });
  };
  const section = (part: "header" | "footer", values: HeaderFooter, set: (value: HeaderFooter) => void) => (
    <fieldset className="mt-3 rounded-sm border border-slate-300 p-2">
      <legend className="px-1 text-[12px] font-semibold">{part === "header" ? "Header" : "Footer"}</legend>
      <div className="grid grid-cols-3 gap-2">
        {(["left", "center", "right"] as const).map((side) => (
          <label key={side} className="grid gap-1 text-[11px] font-semibold">{side === "left" ? "Left section" : side === "center" ? "Center section" : "Right section"}
            <input ref={(element) => { inputs.current[`${part}-${side}`] = element; }} aria-label={`${part === "header" ? "Header" : "Footer"} ${side} section`} value={values[side] ?? ""} onFocus={() => setTarget({ part, side })} onChange={(event) => set({ ...values, [side]: event.target.value.slice(0, 255) })}
              className={`h-16 rounded-sm border px-1 text-[12px] ${target.part === part && target.side === side ? "border-[#217346] ring-1 ring-[#217346]" : "border-slate-300"}`} />
          </label>
        ))}
      </div>
    </fieldset>
  );
  return (
    <div role="presentation" className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/40 p-4" onMouseDown={onCancel}>
      <div role="dialog" aria-modal="true" aria-label="Header & Footer" onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-2xl rounded-sm border border-slate-400 bg-[#f3f3f3] p-4 text-[12px] shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-[13px] font-semibold">Header &amp; Footer</h2><button type="button" onClick={onCancel} aria-label="Close" className="px-2">✕</button></div>
        <p className="mt-1 text-slate-600">Click in a section, then choose an element to insert.</p>
        <div role="toolbar" aria-label="Header & Footer Elements" className="mt-2 flex flex-wrap gap-1">
          {HEADER_CODES.map(([code, label]) => <button key={code} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insert(code)} className="rounded-sm border border-slate-300 bg-white px-2 py-1 hover:bg-[#d5ead9]">{label}</button>)}
        </div>
        {section("header", h, setH)}
        {section("footer", f, setF)}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onOk(h, f)} className="min-w-20 rounded-sm border border-[#217346] bg-white px-4 py-1 font-semibold">OK</button>
          <button type="button" onClick={onCancel} className="min-w-20 rounded-sm border border-slate-400 bg-white px-4 py-1">Cancel</button>
        </div>
      </div>
    </div>
  );
}
