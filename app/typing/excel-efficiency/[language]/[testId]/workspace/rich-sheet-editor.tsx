"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { columnLetters } from "@/lib/excel-formula";
import { autosaveExcelDocument, submitExcelDocument } from "../../../actions";
import { ConfirmDialog } from "@/components/efficiency/exam-chrome";
import { FormatCellsDialog, type FormatCellsResult, type FormatCellsTab } from "./format-cells-dialog";
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
type Tab = "HOME" | "INSERT" | "PAGE LAYOUT" | "FORMULAS" | "DATA" | "REVIEW" | "VIEW";
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
    if (ctrl && key === "1") { event.preventDefault(); openFormatCells("Number"); return; }
    if (ctrl && key.toLowerCase() === "s") { event.preventDefault(); void saveNow(); return; }
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

  // ---------- Format Cells, orientation, indent, decimals, Fill, Paste Special, Cell Styles, right-click ----------
  const [formatDialog, setFormatDialog] = useState<FormatCellsTab | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const openFormatCells = (tabName: FormatCellsTab) => { if (!submitted) { setMenu(null); setContextMenu(null); setFormatDialog(tabName); } };
  const applyFormatCells = (result: FormatCellsResult) => {
    let next = { ...cells };
    for (const ref of rectRefs(selection)) next[ref] = { ...cellOf(next, ref), ...result.patch };
    if (result.border) next = applyBorder(next, selection, result.border);
    let nextMerges = merges;
    if (result.merge === true && (selection.r1 !== selection.r2 || selection.c1 !== selection.c2)) { const merged = mergeRanges(next, merges, selection, false); next = merged.cells; nextMerges = merged.merges; }
    if (result.merge === false) nextMerges = unmergeRanges(merges, selection);
    change("formatCells", { cells: next, merges: nextMerges });
    setFormatDialog(null);
    focusGrid();
  };
  const rotateSelection = (angle: number) => formatSelection({ rotate: active.rotate === angle ? null : angle }, "rotate");
  const indentBy = (delta: number) => { const level = Math.min(15, Math.max(0, (active.indent ?? 0) + delta)); formatSelection({ indent: level || null, align: level ? (active.align === "right" ? "right" : "left") : active.align }, "indent"); };
  const decimalsOf = (cell: SheetCell) => cell.decimals ?? (typeof cell.value === "number" && !Number.isInteger(cell.value) ? Math.min(10, String(cell.value).split(".")[1]?.length ?? 0) : cell.numberFormat && cell.numberFormat !== "General" ? 2 : 0);
  const changeDecimals = (delta: number) => formatSelection({ decimals: Math.min(10, Math.max(0, decimalsOf(active) + delta)) }, "decimals");
  const fillRange = (direction: "down" | "right") => {
    const next = { ...cells };
    for (let row = selection.r1; row <= selection.r2; row++) for (let col = selection.c1; col <= selection.c2; col++) {
      const source = direction === "down" ? refAt(selection.r1, col) : refAt(row, selection.c1);
      if (source !== refAt(row, col)) next[refAt(row, col)] = { ...cellOf(cells, source) };
    }
    change(direction === "down" ? "fillDown" : "fillRight", { cells: next });
  };
  const pasteSpecial = (mode: "values" | "formatting") => {
    if (!clip) { setNotice("Copy cells first (Ctrl+C), then select where to paste."); return; }
    const next = { ...cells };
    const height = clip.rect.r2 - clip.rect.r1, width = clip.rect.c2 - clip.rect.c1;
    for (let i = 0; i <= height; i++) for (let j = 0; j <= width; j++) {
      const row = focus.row + i, col = focus.col + j;
      if (row > MAX_ROWS || col >= MAX_COLS) continue;
      const source = clip.cells[refAt(clip.rect.r1 + i, clip.rect.c1 + j)] ?? EMPTY_CELL, target = cellOf(next, refAt(row, col));
      next[refAt(row, col)] = mode === "values" ? { ...target, value: source.value, formula: null } : { ...target, ...styleOf(source) };
    }
    change(mode === "values" ? "pasteValues" : "pasteFormatting", { cells: next });
  };
  const CELL_STYLES: [string, Partial<SheetCell>][] = [
    ["Normal", { bold: false, italic: false, fontColor: null, fillColor: null, fontSize: null, border: null }],
    ["Bad", { fillColor: "FFC7CE", fontColor: "9C0006" }], ["Good", { fillColor: "C6EFCE", fontColor: "006100" }], ["Neutral", { fillColor: "FFEB9C", fontColor: "9C5700" }],
    ["Title", { fontSize: 18, fontColor: "44546A", fontFamily: "Calibri Light" }], ["Heading 1", { fontSize: 15, bold: true, fontColor: "44546A", border: "B" }],
    ["Heading 2", { fontSize: 13, bold: true, fontColor: "44546A", border: "B" }], ["Total", { bold: true, border: "tB" }],
    ["Accent1", { fillColor: "4472C4", fontColor: "FFFFFF" }], ["Note", { fillColor: "FFFFCC", border: "trbl" }],
  ];
  const saveNow = async () => { if (submitted) return; if (autosaveTimer.current) clearTimeout(autosaveTimer.current); setStatus("Saving…"); const result = await autosaveExcelDocument(attemptId, buildDocument()); setStatus(result.ok ? "Saved" : result.error); };
  const openContextMenu = (event: React.MouseEvent, row: number, col: number) => {
    event.preventDefault();
    if (!rectContains(selection, row, col)) select(row, col);
    setMenu(null);
    setContextMenu({ x: event.clientX, y: event.clientY });
  };
  useEffect(() => { if (!contextMenu) return; const close = (event: MouseEvent) => { if (!(event.target as HTMLElement).closest?.("[data-xl-context]")) setContextMenu(null); }; window.addEventListener("mousedown", close); return () => window.removeEventListener("mousedown", close); }, [contextMenu]);

  const nameBoxValue = selection.r1 === selection.r2 && selection.c1 === selection.c2 ? activeRef : (activeMerge && activeMerge.r1 === selection.r1 && activeMerge.c1 === selection.c1 && activeMerge.r2 === selection.r2 && activeMerge.c2 === selection.c2) ? refAt(activeMerge.r1, activeMerge.c1) : rangeString(selection);
  const [nameBox, setNameBox] = useState<string | null>(null);
  const goToName = (text: string) => { const rect = parseRange(text.trim()); if (rect) { selectRect(rect); setNotice(null); } else setNotice("Type a cell or range such as A27 or A27:L27."); setNameBox(null); focusGrid(); };
  const formulaBarValue = editing ? editing.value : (active.formula ?? (active.value == null ? "" : String(active.value)));
  const zoom = sheet.zoom || 100;
  const tallRows = useMemo(() => { const rows = new Map<number, number>(); for (const [ref, cell] of Object.entries(cells)) { if (!cell.rotate || cell.value == null) continue; const row = Number(ref.replace(/^[A-Z]+/, "")); rows.set(row, Math.max(rows.get(row) ?? 20, cell.rotate === 255 ? Math.min(160, 16 * String(cell.value).length) : Math.min(120, 8 + Math.abs(Math.sin((cell.rotate * Math.PI) / 180)) * 7 * String(cell.value).length))); } return rows; }, [cells]);
  const rowHeight = (row: number) => tallRows.get(row) ?? 20;

  const off = "Not needed for this test";
  const ribbon = (
    <div className="select-none border-b border-[#d4d4d4] bg-[#f3f3f3] text-[12px] text-[#262626]">
      <div className="flex h-7 items-center gap-1 border-b border-[#e1e1e1] bg-white px-2">
        <span aria-hidden className="grid h-5 w-5 place-items-center rounded-sm bg-[#217346] text-[11px] font-black text-white">X</span>
        <QuickButton label="Save (Ctrl+S)" onClick={() => void saveNow()} disabled={submitted}><Icon name="save" /></QuickButton>
        <QuickButton label="Undo (Ctrl+Z)" onClick={undo} disabled={submitted}>↶</QuickButton>
        <QuickButton label="Redo (Ctrl+Y)" onClick={redo} disabled={submitted}>↷</QuickButton>
        <span className="flex-1 text-center text-[12px] text-slate-600">Book1 - Excel</span>
        <span className="text-[11px] font-bold text-slate-500" aria-live="polite">{status}</span>
      </div>
      <div role="tablist" aria-label="Ribbon tabs" className="flex items-end gap-0.5 bg-white px-1">
        <span className="bg-[#217346] px-4 py-1 text-[12px] text-white">FILE</span>
        {(["HOME", "INSERT", "PAGE LAYOUT", "FORMULAS", "DATA", "REVIEW", "VIEW"] as Tab[]).map((name) => (
          <button key={name} role="tab" type="button" aria-selected={tab === name} onMouseDown={(event) => event.preventDefault()} onClick={() => { setTab(name); setMenu(null); }}
            className={`px-3 py-1 text-[12px] ${tab === name ? "border border-b-0 border-[#d4d4d4] bg-[#f3f3f3] text-[#217346]" : "border border-transparent text-[#444] hover:text-[#217346]"}`}>{name}</button>
        ))}
      </div>
      <div role="toolbar" aria-label="Spreadsheet controls" className="flex min-h-[98px] items-stretch overflow-x-auto overflow-y-hidden px-1 pb-0.5 pt-1 [scrollbar-width:thin]">
        {tab === "HOME" && <>
          <Group label="Clipboard">
            <MenuButton id="paste" menu={menu} setMenu={setMenu} label="Paste" icon={<Icon name="paste" big />} big disabled={submitted} onMain={paste}>
              <MenuItem onClick={() => { paste(); setMenu(null); }}>Paste</MenuItem>
              <MenuItem onClick={() => { pasteSpecial("values"); setMenu(null); }}>Paste Values</MenuItem>
              <MenuItem onClick={() => { pasteSpecial("formatting"); setMenu(null); }}>Paste Formatting</MenuItem>
            </MenuButton>
            <div className="flex flex-col gap-0.5">
              <Small label="Cut" icon={<Icon name="cut" />} showLabel onClick={() => copy(true)} disabled={submitted} />
              <Small label="Copy" icon={<Icon name="copy" />} showLabel onClick={() => copy()} />
              <Small label="Format Painter" icon={<Icon name="painter" />} showLabel active={Boolean(painter)} onClick={() => (painter ? (setPainter(null), setNotice(null)) : startPainter(false))} onDoubleClick={() => startPainter(true)} disabled={submitted} />
            </div>
          </Group>
          <Group label="Font" launcher={() => openFormatCells("Font")} launcherLabel="Format Cells: Font">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <select aria-label="Font" value={active.fontFamily ?? DEFAULT_FONT} disabled={submitted} onChange={(event) => formatSelection({ fontFamily: event.target.value === DEFAULT_FONT ? null : event.target.value }, "fontFamily")} className="h-[22px] w-[118px] border border-[#c6c6c6] bg-white px-1 text-[12px]">
                  {FONTS.map((font) => <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>)}
                </select>
                <FontSizeBox value={active.fontSize ?? DEFAULT_FONT_SIZE} disabled={submitted} onChange={(size) => formatSelection({ fontSize: size === DEFAULT_FONT_SIZE ? null : size }, "fontSize")} />
                <Small label="Increase Font Size" icon={<span className="text-[13px]">A<sup>▴</sup></span>} onClick={() => { const size = active.fontSize ?? DEFAULT_FONT_SIZE; const next = FONT_SIZES.find((s) => s > size) ?? size + 2; formatSelection({ fontSize: next }, "fontSize"); }} disabled={submitted} />
                <Small label="Decrease Font Size" icon={<span className="text-[11px]">A<sup>▾</sup></span>} onClick={() => { const size = active.fontSize ?? DEFAULT_FONT_SIZE; const next = [...FONT_SIZES].reverse().find((s) => s < size) ?? Math.max(1, size - 1); formatSelection({ fontSize: next === DEFAULT_FONT_SIZE ? null : next }, "fontSize"); }} disabled={submitted} />
              </div>
              <div className="flex items-center gap-0.5">
                <Small label="Bold (Ctrl+B)" icon={<b className="font-serif">B</b>} active={active.bold} onClick={() => toggle("bold")} disabled={submitted} />
                <Small label="Italic (Ctrl+I)" icon={<i className="font-serif">I</i>} active={active.italic} onClick={() => toggle("italic")} disabled={submitted} />
                <Small label="Underline (Ctrl+U)" icon={<u className="font-serif">U</u>} active={active.underline} onClick={() => toggle("underline")} disabled={submitted} />
                <span className="mx-0.5 h-4 w-px bg-[#c6c6c6]" />
                <MenuButton id="borders" menu={menu} setMenu={setMenu} label="Borders" icon={<Icon name="border" />} disabled={submitted}>
                  {([["bottom", "Bottom Border"], ["top", "Top Border"], ["left", "Left Border"], ["right", "Right Border"], ["none", "No Border"], ["all", "All Borders"], ["outside", "Outside Borders"], ["thickBox", "Thick Box Border"]] as [BorderStyle, string][]).map(([style, label]) => (
                    <MenuItem key={style} onClick={() => { change("border", { cells: applyBorder(cells, selection, style) }); setMenu(null); }}>{label}</MenuItem>
                  ))}
                  <MenuItem onClick={() => openFormatCells("Border")}>More Borders...</MenuItem>
                </MenuButton>
                <ColorSplit id="fill" label="Fill Color" swatch={lastFill} icon={<Icon name="bucket" />} menu={menu} setMenu={setMenu} disabled={submitted} noneLabel="No Fill" onApply={() => formatSelection({ fillColor: lastFill }, "fillColor")} onPick={(hex) => { if (hex) setLastFill(hex); formatSelection({ fillColor: hex }, "fillColor"); }} />
                <ColorSplit id="font" label="Font Color" swatch={lastFont} icon={<span className="font-serif text-[13px] font-bold">A</span>} menu={menu} setMenu={setMenu} disabled={submitted} noneLabel="Automatic" onApply={() => formatSelection({ fontColor: lastFont }, "fontColor")} onPick={(hex) => { if (hex) setLastFont(hex); formatSelection({ fontColor: hex }, "fontColor"); }} />
              </div>
            </div>
          </Group>
          <Group label="Alignment" launcher={() => openFormatCells("Alignment")} launcherLabel="Format Cells: Alignment">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-0.5">
                <Small label="Top Align" icon={<Icon name="vTop" />} active={active.vAlign === "top"} onClick={() => formatSelection({ vAlign: "top" }, "vAlign")} disabled={submitted} />
                <Small label="Middle Align" icon={<Icon name="vMiddle" />} active={active.vAlign === "middle"} onClick={() => formatSelection({ vAlign: "middle" }, "vAlign")} disabled={submitted} />
                <Small label="Bottom Align" icon={<Icon name="vBottom" />} active={!active.vAlign || active.vAlign === "bottom"} onClick={() => formatSelection({ vAlign: "bottom" }, "vAlign")} disabled={submitted} />
                <MenuButton id="orientation-text" menu={menu} setMenu={setMenu} label="Orientation" icon={<span className="inline-block -rotate-45 text-[11px] font-semibold">ab</span>} disabled={submitted}>
                  <MenuItem checked={active.rotate === 45} onClick={() => { rotateSelection(45); setMenu(null); }}>Angle Counterclockwise</MenuItem>
                  <MenuItem checked={active.rotate === -45} onClick={() => { rotateSelection(-45); setMenu(null); }}>Angle Clockwise</MenuItem>
                  <MenuItem checked={active.rotate === 255} onClick={() => { rotateSelection(255); setMenu(null); }}>Vertical Text</MenuItem>
                  <MenuItem checked={active.rotate === 90} onClick={() => { rotateSelection(90); setMenu(null); }}>Rotate Text Up</MenuItem>
                  <MenuItem checked={active.rotate === -90} onClick={() => { rotateSelection(-90); setMenu(null); }}>Rotate Text Down</MenuItem>
                  <MenuItem onClick={() => openFormatCells("Alignment")}>Format Cell Alignment</MenuItem>
                </MenuButton>
                <Small label="Wrap Text" icon={<Icon name="wrap" />} showLabel active={Boolean(active.wrap)} onClick={() => toggle("wrap")} disabled={submitted} />
              </div>
              <div className="flex items-center gap-0.5">
                <Small label="Align Left" icon={<Icon name="hLeft" />} active={active.align === "left"} onClick={() => formatSelection({ align: "left" }, "align")} disabled={submitted} />
                <Small label="Center" icon={<Icon name="hCenter" />} active={active.align === "center"} onClick={() => formatSelection({ align: "center" }, "align")} disabled={submitted} />
                <Small label="Align Right" icon={<Icon name="hRight" />} active={active.align === "right"} onClick={() => formatSelection({ align: "right" }, "align")} disabled={submitted} />
                <Small label="Decrease Indent" icon={<Icon name="outdent" />} onClick={() => indentBy(-1)} disabled={submitted} />
                <Small label="Increase Indent" icon={<Icon name="indent" />} onClick={() => indentBy(1)} disabled={submitted} />
                <span data-xl-menu className="relative flex">
                  <button type="button" disabled={submitted} onMouseDown={(event) => event.preventDefault()} onClick={mergeCenterToggle} aria-label="Merge & Center" title="Merge & Center" className={`flex h-[22px] items-center gap-1 border px-1 ${activeMerge ? "border-[#2a8dd4] bg-[#cde6f7]" : "border-transparent hover:border-[#c6c6c6] hover:bg-white"} disabled:opacity-40`}><Icon name="merge" /> Merge &amp; Center</button>
                  <button type="button" disabled={submitted} onMouseDown={(event) => event.preventDefault()} onClick={() => setMenu(menu === "merge" ? null : "merge")} aria-label="Merge options" aria-expanded={menu === "merge"} className="flex h-[22px] items-center border border-transparent px-0.5 hover:border-[#c6c6c6] hover:bg-white disabled:opacity-40">▾</button>
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
          <Group label="Number" launcher={() => openFormatCells("Number")} launcherLabel="Format Cells: Number">
            <div className="flex flex-col gap-1">
              <select aria-label="Number Format" value={active.numberFormat ?? "General"} disabled={submitted} onChange={(event) => formatSelection({ numberFormat: event.target.value as SheetCell["numberFormat"] }, "numberFormat")} className="h-[22px] w-[128px] border border-[#c6c6c6] bg-white px-1">
                {(["General", "Number", "Currency", "Percentage"] as const).map((format) => <option key={format} value={format}>{format}</option>)}
              </select>
              <div className="flex items-center gap-0.5">
                <Small label="Accounting Number Format" icon={<span>₹</span>} onClick={() => formatSelection({ numberFormat: "Currency" }, "numberFormat")} disabled={submitted} />
                <Small label="Percent Style" icon={<span>%</span>} onClick={() => formatSelection({ numberFormat: "Percentage", decimals: 0 }, "numberFormat")} disabled={submitted} />
                <Small label="Comma Style" icon={<span className="font-bold">,</span>} onClick={() => formatSelection({ numberFormat: "Number", decimals: 2 }, "numberFormat")} disabled={submitted} />
                <Small label="Increase Decimal" icon={<span className="text-[9px] leading-none">←.0<br />.00</span>} onClick={() => changeDecimals(1)} disabled={submitted} />
                <Small label="Decrease Decimal" icon={<span className="text-[9px] leading-none">.00<br />→.0</span>} onClick={() => changeDecimals(-1)} disabled={submitted} />
              </div>
            </div>
          </Group>
          <Group label="Styles">
            <Big label="Conditional Formatting" icon={<Icon name="conditional" big />} disabled title={off} />
            <Big label="Format as Table" icon={<Icon name="table" big />} disabled title={off} />
            <MenuButton id="cellStyles" menu={menu} setMenu={setMenu} label="Cell Styles" icon={<Icon name="cellStyles" big />} big disabled={submitted}>
              {CELL_STYLES.map(([name, patch]) => <MenuItem key={name} onClick={() => { formatSelection(patch, "cellStyle"); setMenu(null); }}>{name}</MenuItem>)}
            </MenuButton>
          </Group>
          <Group label="Cells">
            <MenuButton id="insert" menu={menu} setMenu={setMenu} label="Insert" icon={<Icon name="insertCells" big />} big disabled={submitted}>
              <MenuItem onClick={() => { insertRow(); setMenu(null); }}>Insert Sheet Rows</MenuItem>
              <MenuItem onClick={() => { insertColumn(); setMenu(null); }}>Insert Sheet Columns</MenuItem>
            </MenuButton>
            <MenuButton id="delete" menu={menu} setMenu={setMenu} label="Delete" icon={<Icon name="deleteCells" big />} big disabled={submitted}>
              <MenuItem onClick={() => { deleteRow(); setMenu(null); }}>Delete Sheet Rows</MenuItem>
              <MenuItem onClick={() => { deleteColumn(); setMenu(null); }}>Delete Sheet Columns</MenuItem>
            </MenuButton>
            <MenuButton id="format" menu={menu} setMenu={setMenu} label="Format" icon={<Icon name="formatCells" big />} big disabled={submitted}>
              <MenuItem onClick={() => openFormatCells("Number")}>Format Cells...</MenuItem>
            </MenuButton>
          </Group>
          <Group label="Editing">
            <div className="flex flex-col gap-0.5">
              <MenuButton id="autosum" menu={menu} setMenu={setMenu} label="AutoSum" icon={<span className="flex items-center gap-1"><span className="text-[14px] font-bold">Σ</span>AutoSum</span>} disabled={submitted} onMain={() => autoSum("SUM")}>
                {["SUM", "AVERAGE", "COUNT", "MAX", "MIN"].map((fn) => <MenuItem key={fn} onClick={() => { autoSum(fn); setMenu(null); }}>{fn === "SUM" ? "Sum" : fn === "AVERAGE" ? "Average" : fn === "COUNT" ? "Count Numbers" : fn === "MAX" ? "Max" : "Min"}</MenuItem>)}
              </MenuButton>
              <MenuButton id="fill-range" menu={menu} setMenu={setMenu} label="Fill" icon={<span className="flex items-center gap-1"><span className="text-[#2a6bd4]">⬇</span>Fill</span>} disabled={submitted}>
                <MenuItem onClick={() => { fillRange("down"); setMenu(null); }}>Down</MenuItem>
                <MenuItem onClick={() => { fillRange("right"); setMenu(null); }}>Right</MenuItem>
              </MenuButton>
              <MenuButton id="clear" menu={menu} setMenu={setMenu} label="Clear" icon={<span className="flex items-center gap-1"><span className="text-[#d24726]">⌫</span>Clear</span>} disabled={submitted}>
                <MenuItem onClick={() => { clearAll(); setMenu(null); }}>Clear All</MenuItem>
                <MenuItem onClick={() => { clearFormats(); setMenu(null); }}>Clear Formats</MenuItem>
                <MenuItem onClick={() => { clearContents(); setMenu(null); }}>Clear Contents</MenuItem>
              </MenuButton>
            </div>
            <MenuButton id="sort" menu={menu} setMenu={setMenu} label="Sort & Filter" icon={<Icon name="sort" big />} big disabled={submitted}>
              <MenuItem onClick={() => { sortSelection("asc"); setMenu(null); }}>Sort A to Z</MenuItem>
              <MenuItem onClick={() => { sortSelection("desc"); setMenu(null); }}>Sort Z to A</MenuItem>
            </MenuButton>
            <MenuButton id="find" menu={menu} setMenu={setMenu} label="Find & Select" icon={<Icon name="find" big />} big>
              <MenuItem onClick={() => { setMenu(null); setNameBox(nameBoxValue); requestAnimationFrame(() => document.querySelector<HTMLInputElement>('input[aria-label="Name Box"]')?.select()); }}>Go To...</MenuItem>
            </MenuButton>
          </Group>
        </>}
        {tab === "INSERT" && <>
          <Group label="Tables"><Big label="PivotTable" icon={<Icon name="table" big />} disabled title={off} /><Big label="Recommended PivotTables" icon={<Icon name="table" big />} disabled title={off} /><Big label="Table" icon={<Icon name="table" big />} disabled title={off} /></Group>
          <Group label="Illustrations"><Big label="Pictures" icon="🖼" disabled title={off} /><Big label="Online Pictures" icon="🌐" disabled title={off} /><div className="flex flex-col gap-0.5"><Small label="Shapes" icon="◇" showLabel onClick={() => undefined} disabled /><Small label="SmartArt" icon="▣" showLabel onClick={() => undefined} disabled /><Small label="Screenshot" icon="📷" showLabel onClick={() => undefined} disabled /></div></Group>
          <Group label="Charts"><Big label="Recommended Charts" icon="📊" disabled title={off} /><Big label="PivotChart" icon="📈" disabled title={off} /></Group>
          <Group label="Sparklines"><Big label="Line" icon="〰" disabled title={off} /><Big label="Column" icon="▮" disabled title={off} /><Big label="Win/ Loss" icon="▚" disabled title={off} /></Group>
          <Group label="Links"><Big label="Hyperlink" icon="🔗" disabled title={off} /></Group>
          <Group label="Text">
            <Big label="Text Box" icon={<Icon name="textBox" big />} disabled title={off} />
            <Big label="Header & Footer" icon={<Icon name="headerFooter" big />} onClick={() => setHeaderDialog(true)} disabled={submitted} />
            <div className="flex flex-col gap-0.5"><Small label="WordArt" icon="A" showLabel onClick={() => undefined} disabled /><Small label="Signature Line" icon="✎" showLabel onClick={() => undefined} disabled /><Small label="Object" icon="▢" showLabel onClick={() => undefined} disabled /></div>
          </Group>
          <Group label="Symbols"><div className="flex flex-col gap-0.5"><Small label="Equation" icon="π" showLabel onClick={() => undefined} disabled /><Small label="Symbol" icon="Ω" showLabel onClick={() => undefined} disabled /></div></Group>
        </>}
        {tab === "PAGE LAYOUT" && <>
          <Group label="Themes"><Big label="Themes" icon="Aa" disabled title={off} /></Group>
          <Group label="Page Setup">
            <MenuButton id="margins" menu={menu} setMenu={setMenu} label="Margins" icon={<Icon name="margins" big />} big disabled={submitted}>
              {(["Normal", "Wide", "Narrow"] as const).map((value) => <MenuItem key={value} checked={sheet.margins === value} onClick={() => { setSheetOption("margins", value, "margins"); setMenu(null); }}>{value}</MenuItem>)}
            </MenuButton>
            <MenuButton id="orientation" menu={menu} setMenu={setMenu} label="Orientation" icon={<Icon name="orientation" big />} big disabled={submitted}>
              <MenuItem checked={sheet.orientation === "portrait"} onClick={() => { setSheetOption("orientation", "portrait", "orientation"); setMenu(null); }}>Portrait</MenuItem>
              <MenuItem checked={sheet.orientation === "landscape"} onClick={() => { setSheetOption("orientation", "landscape", "orientation"); setMenu(null); }}>Landscape</MenuItem>
            </MenuButton>
            <MenuButton id="size" menu={menu} setMenu={setMenu} label="Size" icon={<Icon name="size" big />} big disabled={submitted}>
              {PAPER_SIZES.map((size) => <MenuItem key={size} checked={sheet.paperSize === size} onClick={() => { setSheetOption("paperSize", size, "paperSize"); setMenu(null); }}>{PAPER_LABELS[size]}</MenuItem>)}
            </MenuButton>
            <MenuButton id="printArea" menu={menu} setMenu={setMenu} label="Print Area" icon={<Icon name="printArea" big />} big disabled={submitted}>
              <MenuItem onClick={() => { setSheetOption("printArea", rangeString(selection), "printArea"); setNotice(`Print area set to ${rangeString(selection)}.`); setMenu(null); }}>Set Print Area</MenuItem>
              <MenuItem onClick={() => { setSheetOption("printArea", null, "clearPrintArea"); setMenu(null); }}>Clear Print Area</MenuItem>
            </MenuButton>
            <Big label="Breaks" icon="⤓" disabled title={off} /><Big label="Background" icon="🏞" disabled title={off} /><Big label="Print Titles" icon="🖨" disabled title={off} />
          </Group>
          <Group label="Scale to Fit">
            <div className="grid grid-cols-[52px_84px] items-center gap-x-1 gap-y-0.5 text-slate-500">
              <span>Width:</span><span className="border border-[#c6c6c6] bg-white px-1">Automatic</span>
              <span>Height:</span><span className="border border-[#c6c6c6] bg-white px-1">Automatic</span>
              <span>Scale:</span><span className="border border-[#c6c6c6] bg-white px-1">100%</span>
            </div>
          </Group>
          <Group label="Sheet Options">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-1">
              <span>Gridlines</span><span>Headings</span>
              <Check label="View" ariaLabel="Gridlines: View" checked={sheet.gridlines} disabled={submitted} onChange={(value) => setSheetOption("gridlines", value, "gridlines")} />
              <Check label="View" ariaLabel="Headings: View" checked={sheet.headings} disabled={submitted} onChange={(value) => setSheetOption("headings", value, "headings")} />
              <Check label="Print" ariaLabel="Gridlines: Print" checked={sheet.printGridlines} disabled={submitted} onChange={(value) => setSheetOption("printGridlines", value, "printGridlines")} />
              <Check label="Print" ariaLabel="Headings: Print" checked={sheet.printHeadings} disabled={submitted} onChange={(value) => setSheetOption("printHeadings", value, "printHeadings")} />
            </div>
          </Group>
          <Group label="Arrange"><Big label="Bring Forward" icon="⧉" disabled title={off} /><Big label="Send Backward" icon="⧉" disabled title={off} /><Big label="Selection Pane" icon="☰" disabled title={off} /><Big label="Align" icon="⫶" disabled title={off} /></Group>
        </>}
        {tab === "FORMULAS" && <>
          <Group label="Function Library">
            <Big label="Insert Function" icon={<span className="font-serif italic">fx</span>} disabled title={off} />
            <MenuButton id="fx-autosum" menu={menu} setMenu={setMenu} label="AutoSum" icon={<span className="text-[22px] font-bold leading-none">Σ</span>} big disabled={submitted} onMain={() => autoSum("SUM")}>
              {["SUM", "AVERAGE", "COUNT", "MAX", "MIN"].map((fn) => <MenuItem key={fn} onClick={() => { autoSum(fn); setMenu(null); }}>{fn === "SUM" ? "Sum" : fn === "AVERAGE" ? "Average" : fn === "COUNT" ? "Count Numbers" : fn === "MAX" ? "Max" : "Min"}</MenuItem>)}
            </MenuButton>
            {["Recently Used", "Financial", "Logical", "Text", "Date & Time", "Lookup & Reference", "Math & Trig"].map((label) => <Big key={label} label={label} icon="📒" disabled title={off} />)}
          </Group>
          <Group label="Help"><p className="max-w-[16rem] self-center px-2 text-[11px] text-slate-500">Type a formula in a cell or the formula bar, e.g. <b>=SUM(I3:I4)</b> or <b>=I3+I4</b>. SUM, AVERAGE, COUNT, COUNTA, MAX, MIN and IF work, with + − × ÷ and $ references.</p></Group>
        </>}
        {tab === "DATA" && <>
          <Group label="Get External Data"><Big label="From Access" icon="🗄" disabled title={off} /><Big label="From Web" icon="🌐" disabled title={off} /><Big label="From Text" icon="🗎" disabled title={off} /></Group>
          <Group label="Sort & Filter">
            <div className="flex flex-col gap-0.5"><Small label="Sort A to Z" icon="A↓Z" onClick={() => sortSelection("asc")} disabled={submitted} /><Small label="Sort Z to A" icon="Z↓A" onClick={() => sortSelection("desc")} disabled={submitted} /></div>
            <Big label="Sort" icon={<Icon name="sort" big />} disabled title={off} /><Big label="Filter" icon="⏷" disabled title={off} />
          </Group>
          <Group label="Data Tools"><Big label="Text to Columns" icon="⫼" disabled title={off} /><Big label="Remove Duplicates" icon="⊟" disabled title={off} /></Group>
        </>}
        {tab === "REVIEW" && <>
          <Group label="Proofing"><Big label="Spelling" icon="ABC✓" disabled title={off} /><Big label="Thesaurus" icon="📖" disabled title={off} /></Group>
          <Group label="Comments"><Big label="New Comment" icon="💬" disabled title={off} /></Group>
          <Group label="Changes"><Big label="Protect Sheet" icon="🔒" disabled title={off} /><Big label="Protect Workbook" icon="🔒" disabled title={off} /></Group>
        </>}
        {tab === "VIEW" && <>
          <Group label="Workbook Views"><Big label="Normal" icon={<Icon name="table" big />} active onClick={() => undefined} /><Big label="Page Break Preview" icon="▤" disabled title={off} /><Big label="Page Layout" icon="🗏" disabled title={off} /><Big label="Custom Views" icon="▭" disabled title={off} /></Group>
          <Group label="Show">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-1">
              <Check label="Ruler" checked disabled onChange={() => undefined} />
              <Check label="Formula Bar" checked={sheet.formulaBar} disabled={submitted} onChange={(value) => setSheetOption("formulaBar", value, "formulaBar")} />
              <Check label="Gridlines" checked={sheet.gridlines} disabled={submitted} onChange={(value) => setSheetOption("gridlines", value, "gridlines")} />
              <Check label="Headings" checked={sheet.headings} disabled={submitted} onChange={(value) => setSheetOption("headings", value, "headings")} />
            </div>
          </Group>
          <Group label="Zoom">
            <Big label="Zoom" icon="🔍" onClick={() => setSheet((s) => ({ ...s, zoom: (s.zoom || 100) >= 150 ? 75 : (s.zoom || 100) + 25 }))} />
            <Big label="100%" icon={<span className="text-[13px] font-bold">100</span>} onClick={() => setSheet((s) => ({ ...s, zoom: 100 }))} />
            <Big label="Zoom to Selection" icon="⤢" disabled title={off} />
          </Group>
          <Group label="Window"><Big label="New Window" icon="🗗" disabled title={off} /><Big label="Arrange All" icon="⊞" disabled title={off} /><Big label="Freeze Panes" icon="❄" disabled title={off} /></Group>
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
                        fontWeight: cell.bold ? 700 : undefined, fontStyle: cell.italic ? "italic" : undefined, textDecoration: [cell.underline && "underline", cell.strike && "line-through"].filter(Boolean).join(" ") || undefined, color: cell.fontColor ? `#${cell.fontColor}` : undefined,
                        paddingLeft: cell.indent && align === "left" ? 4 + cell.indent * 9 : undefined, paddingRight: cell.indent && align === "right" ? 4 + cell.indent * 9 : undefined,
                        whiteSpace: cell.wrap ? "normal" : "nowrap", overflow: spill ? "visible" : "hidden", height: rowHeight(row), lineHeight: 1.2, zIndex: spill ? 1 : undefined,
                        outline: isActive ? "2px solid #217346" : undefined, outlineOffset: -2,
                      };
                      return (
                        <td key={ref} {...span} role="gridcell" aria-selected={inSelection} data-ref={ref} style={style}
                          className="relative max-w-0 px-1"
                          onMouseDown={(event) => {
                            // A right-click inside the selection keeps it (the menu then acts on all of it), as in Excel.
                            if (event.button === 2 && rectContains(selection, row, col)) return;
                            if (editing && !isEditing) commitEdit();
                            focusGrid();
                            if (painter) { dragging.current = true; select(row, col); return; }
                            dragging.current = true;
                            select(row, col, event.shiftKey);
                          }}
                          onMouseEnter={() => { if (dragging.current) setFocus({ row, col }); }}
                          onMouseUp={() => { if (painter && dragging.current) { dragging.current = false; applyPainter(expandForMerges(normalizeRect(anchor, { row, col }), merges)); } }}
                          onDoubleClick={() => beginEdit()} onContextMenu={(event) => openContextMenu(event, row, col)}>
                          {isEditing ? (
                            <input ref={editInputRef} aria-label={`Edit ${ref}`} value={editing.value} onChange={(event) => setEditing({ ref, value: event.target.value, fromBar: false })}
                              onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Enter") { event.preventDefault(); commitEdit("down"); } else if (event.key === "Tab") { event.preventDefault(); commitEdit("right"); } else if (event.key === "Escape") { setEditing(null); focusGrid(); } }}
                              onBlur={() => commitEdit()} className="absolute inset-0 z-10 w-full min-w-[120px] border-2 border-[#217346] bg-white px-1 outline-none" style={{ fontSize: style.fontSize, fontFamily: style.fontFamily as string | undefined }} />
                          ) : (
                            <span className={cell.rotate ? "inline-block" : "block"} style={{ overflow: spill ? "visible" : "hidden", textOverflow: "clip", position: spill ? "relative" : undefined, ...(cell.rotate === 255 ? { writingMode: "vertical-rl", textOrientation: "upright" } : cell.rotate ? { transform: `rotate(${-cell.rotate}deg)`, transformOrigin: "center" } : {}) }}>{formatCellValue(cell.value, cell.numberFormat, cell.decimals)}</span>
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
      {formatDialog && <FormatCellsDialog cell={active} merged={Boolean(activeMerge)} initialTab={formatDialog} onCancel={() => { setFormatDialog(null); focusGrid(); }} onOk={applyFormatCells} />}
      {contextMenu && (
        <div data-xl-context role="menu" aria-label="Cell menu" className="fixed z-[85] min-w-[12rem] border border-[#c6c6c6] bg-white py-1 text-[12px] shadow-xl" style={{ left: Math.min(contextMenu.x, (typeof window === "undefined" ? 1200 : window.innerWidth) - 200), top: Math.min(contextMenu.y, (typeof window === "undefined" ? 800 : window.innerHeight) - 300) }}>
          <ContextItem label="Cut" disabled={submitted} onSelect={() => { setContextMenu(null); copy(true); focusGrid(); }} />
          <ContextItem label="Copy" disabled={false} onSelect={() => { setContextMenu(null); copy(); focusGrid(); }} />
          <ContextItem label="Paste" disabled={submitted} onSelect={() => { setContextMenu(null); paste(); focusGrid(); }} />
          <ContextItem label="Paste Values" disabled={submitted} onSelect={() => { setContextMenu(null); pasteSpecial("values"); focusGrid(); }} />
          <ContextItem label="Paste Formatting" disabled={submitted} onSelect={() => { setContextMenu(null); pasteSpecial("formatting"); focusGrid(); }} />
          <div className="my-1 border-t border-[#e1e1e1]" />
          <ContextItem label="Insert Sheet Rows" disabled={submitted} onSelect={() => { setContextMenu(null); insertRow(); focusGrid(); }} />
          <ContextItem label="Delete Sheet Rows" disabled={submitted} onSelect={() => { setContextMenu(null); deleteRow(); focusGrid(); }} />
          <ContextItem label="Insert Sheet Columns" disabled={submitted} onSelect={() => { setContextMenu(null); insertColumn(); focusGrid(); }} />
          <ContextItem label="Delete Sheet Columns" disabled={submitted} onSelect={() => { setContextMenu(null); deleteColumn(); focusGrid(); }} />
          <ContextItem label="Clear Contents" disabled={submitted} onSelect={() => { setContextMenu(null); clearContents(); focusGrid(); }} />
          <div className="my-1 border-t border-[#e1e1e1]" />
          <ContextItem label="Sort A to Z" disabled={submitted} onSelect={() => { setContextMenu(null); sortSelection("asc"); focusGrid(); }} />
          <ContextItem label="Sort Z to A" disabled={submitted} onSelect={() => { setContextMenu(null); sortSelection("desc"); focusGrid(); }} />
          <div className="my-1 border-t border-[#e1e1e1]" />
          <ContextItem label="Format Cells..." disabled={submitted} onSelect={() => { setContextMenu(null); openFormatCells("Number"); focusGrid(); }} />
        </div>
      )}
      {headerDialog && <HeaderFooterDialog header={sheet.header} footer={sheet.footer} onCancel={() => setHeaderDialog(false)} onOk={(header, footer) => { setHeaderDialog(false); const usedPage = [header, footer].some((part) => Object.values(part).some((text) => /&\[Page\]/i.test(text ?? ""))); change(usedPage ? "pageNumber" : "header", { sheet: { ...sheet, header, footer } }); record("header"); }} />}
      <footer className="flex items-center justify-between gap-3 border-t bg-slate-950 px-4 py-2 text-white">
        <p aria-live="polite" className="text-sm font-bold">Autosave: {status}</p>
        <button type="button" disabled={submitted} onClick={() => { if (editing) commitEdit(); if (!submitted) setConfirmSubmitOpen(true); }} className="rounded-xl bg-red-600 px-5 py-2.5 font-black text-white outline-none hover:bg-red-500 disabled:bg-slate-500">Submit</button>
      </footer>
    </div>
  );
}

function ContextItem({ label, onSelect, disabled }: { label: string; onSelect: () => void; disabled?: boolean }) {
  return <button type="button" role="menuitem" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onSelect} className="block w-full px-6 py-1 text-left hover:bg-[#d5e1f2] disabled:text-slate-400">{label}</button>;
}
// ---------- ribbon parts (Excel 2013 look) ----------
function QuickButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className="grid h-5 w-6 place-items-center text-[14px] text-[#217346] hover:bg-[#e1e1e1] disabled:opacity-40">{children}</button>;
}
function Group({ label, children, launcher, launcherLabel }: { label: string; children: React.ReactNode; launcher?: () => void; launcherLabel?: string }) {
  return (
    <div role="group" aria-label={label} className="flex h-[92px] shrink-0 flex-col border-r border-[#d4d4d4] px-1.5">
      <div className="flex flex-1 items-start gap-0.5">{children}</div>
      <div className="relative flex h-4 items-center justify-center text-[11px] text-[#666]">
        {label}
        {launcher && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={launcher} aria-label={launcherLabel ?? `${label} settings`} title={launcherLabel ?? `${label} settings`} className="absolute -right-1 bottom-0 grid h-3.5 w-3.5 place-items-center text-[9px] text-[#666] hover:bg-[#d5e1f2]">↘</button>}
      </div>
    </div>
  );
}
function Big({ label, icon, onClick, disabled, active, title }: { label: string; icon: React.ReactNode; onClick?: () => void; disabled?: boolean; active?: boolean; title?: string }) {
  return <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClick} aria-label={label} aria-pressed={active} title={title ?? label}
    className={`flex h-[70px] min-w-[44px] max-w-[76px] flex-col items-center gap-0.5 border px-1 pt-1 ${active ? "border-[#9fb9a7] bg-[#cfe2d4]" : "border-transparent hover:border-[#c6c6c6] hover:bg-white"} disabled:opacity-40`}><span className="grid h-8 place-items-center text-[22px] leading-none">{icon}</span><span className="text-center text-[11px] leading-[12px]">{label}</span></button>;
}
function Small({ label, icon, onClick, onDoubleClick, active, disabled, showLabel }: { label: string; icon: React.ReactNode; onClick: () => void; onDoubleClick?: () => void; active?: boolean; disabled?: boolean; showLabel?: boolean }) {
  return <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClick} onDoubleClick={onDoubleClick} aria-label={label} aria-pressed={active} title={label}
    className={`flex h-[22px] min-w-[22px] items-center justify-center gap-1 whitespace-nowrap border px-1 ${active ? "border-[#2a8dd4] bg-[#cde6f7]" : "border-transparent hover:border-[#c6c6c6] hover:bg-white"} disabled:opacity-40`}>{icon}{showLabel && <span>{label}</span>}</button>;
}
function Menu({ children }: { children: React.ReactNode }) {
  return <div role="menu" className="absolute left-0 top-full z-50 mt-0.5 min-w-[12rem] border border-[#c6c6c6] bg-white py-1 text-[12px] shadow-lg">{children}</div>;
}
function MenuItem({ children, onClick, checked }: { children: React.ReactNode; onClick: () => void; checked?: boolean }) {
  return <button type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={onClick} className={`flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-[#d5e1f2] ${checked ? "font-semibold text-[#217346]" : ""}`}><span className="w-3">{checked ? "✓" : ""}</span>{children}</button>;
}
function MenuButton({ id, menu, setMenu, label, icon, children, disabled, big, onMain }: { id: string; menu: string | null; setMenu: (value: string | null) => void; label: string; icon: React.ReactNode; children: React.ReactNode; disabled?: boolean; big?: boolean; onMain?: () => void }) {
  const open = menu === id;
  if (big) return (
    <span data-xl-menu className="relative flex">
      <span className="flex flex-col items-stretch">
        <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onMain ?? (() => setMenu(open ? null : id))} aria-label={onMain ? label : label} aria-haspopup={onMain ? undefined : "menu"} aria-expanded={onMain ? undefined : open} title={label}
          className="flex h-[44px] min-w-[44px] flex-col items-center justify-center border border-transparent px-1 hover:border-[#c6c6c6] hover:bg-white disabled:opacity-40"><span className="grid h-8 place-items-center text-[22px] leading-none">{icon}</span></button>
        <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => setMenu(open ? null : id)} aria-label={onMain ? `${label} options` : `${label} menu`} aria-expanded={open}
          className="flex h-[26px] flex-col items-center border border-transparent px-1 text-[11px] leading-[12px] hover:border-[#c6c6c6] hover:bg-white disabled:opacity-40">{label}<span className="text-[9px]">▾</span></button>
      </span>
      {open && <Menu>{children}</Menu>}
    </span>
  );
  return (
    <span data-xl-menu className="relative flex">
      {onMain && <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onMain} aria-label={label} title={label} className="flex h-[22px] items-center border border-transparent px-1 hover:border-[#c6c6c6] hover:bg-white disabled:opacity-40">{icon}</button>}
      <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => setMenu(open ? null : id)} aria-label={onMain ? `${label} options` : label} aria-haspopup="menu" aria-expanded={open} title={label}
        className="flex h-[22px] items-center gap-0.5 whitespace-nowrap border border-transparent px-1 hover:border-[#c6c6c6] hover:bg-white disabled:opacity-40">{!onMain && icon}<span className="text-[9px]">▾</span></button>
      {open && <Menu>{children}</Menu>}
    </span>
  );
}
function ColorSplit({ id, label, swatch, icon, menu, setMenu, onApply, onPick, noneLabel, disabled }: { id: string; label: string; swatch: string; icon: React.ReactNode; menu: string | null; setMenu: (value: string | null) => void; onApply: () => void; onPick: (hex: string | null) => void; noneLabel: string; disabled?: boolean }) {
  const open = menu === id;
  return (
    <span data-xl-menu className="relative flex">
      <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onApply} aria-label={label} title={label} className="flex h-[22px] flex-col items-center justify-center border border-transparent px-1 hover:border-[#c6c6c6] hover:bg-white disabled:opacity-40"><span className="leading-none">{icon}</span><span className="mt-0.5 h-[3px] w-4" style={{ backgroundColor: `#${swatch}` }} /></button>
      <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => setMenu(open ? null : id)} aria-label={`${label} palette`} aria-expanded={open} className="flex h-[22px] items-center border border-transparent px-0.5 text-[9px] hover:border-[#c6c6c6] hover:bg-white disabled:opacity-40">▾</button>
      {open && (
        <div role="menu" aria-label={`${label} palette`} className="absolute left-0 top-full z-50 mt-0.5 w-56 border border-[#c6c6c6] bg-white p-2 shadow-lg">
          <button type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => { onPick(null); setMenu(null); }} className="mb-1 w-full px-1 py-0.5 text-left text-[12px] hover:bg-[#d5e1f2]">{noneLabel}</button>
          <p className="text-[11px] font-semibold text-slate-500">Theme Colors</p>
          <div className="mt-1 grid grid-cols-10 gap-0.5">{THEME_COLORS.flat().map((hex, index) => <button key={`${hex}-${index}`} type="button" role="menuitem" aria-label={`#${hex}`} title={`#${hex}`} onMouseDown={(event) => event.preventDefault()} onClick={() => { onPick(hex); setMenu(null); }} className="h-4 w-4 border border-slate-200" style={{ backgroundColor: `#${hex}` }} />)}</div>
          <p className="mt-2 text-[11px] font-semibold text-slate-500">Standard Colors</p>
          <div className="mt-1 grid grid-cols-10 gap-0.5">{STANDARD_COLORS.map(([hex, name]) => <button key={hex} type="button" role="menuitem" aria-label={`${name} (#${hex})`} title={name} onMouseDown={(event) => event.preventDefault()} onClick={() => { onPick(hex); setMenu(null); }} className="h-4 w-4 border border-slate-200" style={{ backgroundColor: `#${hex}` }} />)}</div>
        </div>
      )}
    </span>
  );
}
// Small line drawings for the ribbon, close to Excel 2013's icons.
function Icon({ name, big }: { name: string; big?: boolean }) {
  const s = big ? 30 : 16;
  const line = (x1: number, y1: number, x2: number, y2: number, color = "#444", w = 1.4) => <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} />;
  const rows = (ys: number[], widths: [number, number][]) => ys.map((y, i) => line(widths[i][0], y, widths[i][1], y));
  const content: Record<string, React.ReactNode> = {
    vTop: <>{line(2, 2, 14, 2, "#217346", 2)}{rows([5, 8, 11], [[4, 12], [4, 12], [4, 12]])}</>,
    vMiddle: <>{rows([3, 13], [[4, 12], [4, 12]])}{line(2, 8, 14, 8, "#217346", 2)}{rows([5.5, 10.5], [[4, 12], [4, 12]])}</>,
    vBottom: <>{rows([5, 8, 11], [[4, 12], [4, 12], [4, 12]])}{line(2, 14, 14, 14, "#217346", 2)}</>,
    hLeft: rows([3, 6, 9, 12], [[2, 14], [2, 10], [2, 14], [2, 10]]),
    hCenter: rows([3, 6, 9, 12], [[2, 14], [4, 12], [2, 14], [4, 12]]),
    hRight: rows([3, 6, 9, 12], [[2, 14], [6, 14], [2, 14], [6, 14]]),
    indent: <>{rows([3, 6, 9, 12], [[2, 14], [7, 14], [7, 14], [2, 14]])}<path d="M2 5.5 L5 7.5 L2 9.5 Z" fill="#2a6bd4" /></>,
    outdent: <>{rows([3, 6, 9, 12], [[2, 14], [7, 14], [7, 14], [2, 14]])}<path d="M5 5.5 L2 7.5 L5 9.5 Z" fill="#2a6bd4" /></>,
    wrap: <>{line(2, 4, 14, 4)}<path d="M2 9 H12 a2 2 0 0 1 0 4 H8" fill="none" stroke="#2a6bd4" strokeWidth={1.4} /><path d="M9 11 L7 13 L9 15" fill="none" stroke="#2a6bd4" strokeWidth={1.4} /></>,
    merge: <><rect x={1.5} y={3.5} width={13} height={9} fill="none" stroke="#444" /><path d="M4 8 H12 M4 8 L6 6 M4 8 L6 10 M12 8 L10 6 M12 8 L10 10" stroke="#2a6bd4" strokeWidth={1.2} fill="none" /></>,
    border: <><rect x={2} y={2} width={12} height={12} fill="none" stroke="#999" strokeDasharray="1.5 1.5" />{line(2, 14, 14, 14, "#222", 1.8)}</>,
    bucket: <><path d="M4 7 L8 3 L13 8 L9 12 Z" fill="none" stroke="#444" strokeWidth={1.2} /><path d="M13 10 q1 2 0 3 q-1-1 0-3" fill="#2a6bd4" /></>,
    save: <><rect x={2} y={2} width={12} height={12} rx={1} fill="#7b4fa0" /><rect x={4.5} y={2.5} width={7} height={4} fill="#fff" /><rect x={4.5} y={9} width={7} height={4.5} fill="#e6dcef" /></>,
    paste: <><rect x={6} y={6} width={18} height={22} rx={1.5} fill="#c79a5a" /><rect x={10} y={3} width={10} height={6} rx={1} fill="#777" /><rect x={13} y={12} width={14} height={16} fill="#fff" stroke="#888" /></>,
    cut: <><circle cx={5} cy={12} r={2.2} fill="none" stroke="#444" /><circle cx={11} cy={12} r={2.2} fill="none" stroke="#444" />{line(6, 10, 11, 2)}{line(10, 10, 5, 2)}</>,
    copy: <><rect x={2} y={2} width={8} height={10} fill="#fff" stroke="#555" /><rect x={6} y={5} width={8} height={10} fill="#fff" stroke="#555" /></>,
    painter: <><rect x={2} y={2} width={10} height={5} rx={1} fill="#e6b84a" stroke="#8a6d1f" /><path d="M7 7 V10 M7 10 V15" stroke="#8a6d1f" strokeWidth={2} /></>,
    conditional: <><rect x={3} y={4} width={24} height={22} fill="#fff" stroke="#999" /><rect x={6} y={8} width={8} height={4} fill="#e06666" /><rect x={6} y={14} width={12} height={4} fill="#f6b26b" /><rect x={6} y={20} width={16} height={4} fill="#93c47d" /></>,
    table: <><rect x={3} y={5} width={24} height={20} fill="#fff" stroke="#6a8ec7" />{[10, 15, 20].map((y) => <line key={y} x1={3} y1={y} x2={27} y2={y} stroke="#6a8ec7" />)}<line x1={11} y1={5} x2={11} y2={25} stroke="#6a8ec7" /><line x1={19} y1={5} x2={19} y2={25} stroke="#6a8ec7" /><rect x={3} y={5} width={24} height={5} fill="#6a8ec7" /></>,
    cellStyles: <><rect x={3} y={5} width={11} height={9} fill="#c6efce" stroke="#999" /><rect x={16} y={5} width={11} height={9} fill="#ffc7ce" stroke="#999" /><rect x={3} y={16} width={11} height={9} fill="#ffeb9c" stroke="#999" /><rect x={16} y={16} width={11} height={9} fill="#4472c4" stroke="#999" /></>,
    insertCells: <><rect x={3} y={6} width={18} height={18} fill="#fff" stroke="#888" /><line x1={3} y1={15} x2={21} y2={15} stroke="#888" /><path d="M22 9 h6 M25 6 v6" stroke="#2a6bd4" strokeWidth={2} /></>,
    deleteCells: <><rect x={3} y={6} width={18} height={18} fill="#fff" stroke="#888" /><line x1={3} y1={15} x2={21} y2={15} stroke="#888" /><path d="M20 4 l8 8 M28 4 l-8 8" stroke="#d24726" strokeWidth={2} /></>,
    formatCells: <><rect x={3} y={6} width={18} height={18} fill="#fff" stroke="#888" /><line x1={3} y1={15} x2={21} y2={15} stroke="#888" /><rect x={18} y={3} width={10} height={10} fill="#4472c4" /></>,
    sort: <><text x={2} y={13} fontSize={11} fill="#2a6bd4" fontWeight={700}>A</text><text x={2} y={26} fontSize={11} fill="#2a6bd4" fontWeight={700}>Z</text><path d="M20 5 V25 M16 21 L20 26 L24 21" stroke="#444" strokeWidth={1.6} fill="none" /></>,
    find: <><circle cx={13} cy={12} r={7} fill="none" stroke="#444" strokeWidth={2} /><path d="M18 17 L26 25" stroke="#444" strokeWidth={3} /></>,
    textBox: <><rect x={4} y={5} width={22} height={20} fill="#fff" stroke="#666" /><text x={8} y={19} fontSize={11} fill="#333">A</text>{line(15, 12, 23, 12)}{line(15, 17, 23, 17)}</>,
    headerFooter: <><rect x={6} y={2} width={18} height={26} fill="#fff" stroke="#888" /><rect x={8} y={4} width={14} height={4} fill="#e6b84a" /><rect x={8} y={22} width={14} height={4} fill="#e6b84a" /></>,
    margins: <><rect x={6} y={2} width={18} height={26} fill="#fff" stroke="#888" /><rect x={9} y={6} width={12} height={18} fill="none" stroke="#2a6bd4" strokeDasharray="2 1.5" /></>,
    orientation: <><rect x={3} y={8} width={14} height={20} fill="#fff" stroke="#888" /><rect x={10} y={3} width={18} height={13} fill="#fff" stroke="#2a6bd4" /></>,
    size: <><rect x={8} y={3} width={16} height={24} fill="#fff" stroke="#888" /><path d="M4 8 V27 M2 10 L4 8 L6 10 M2 25 L4 27 L6 25" stroke="#2a6bd4" strokeWidth={1.2} fill="none" /></>,
    printArea: <><rect x={4} y={10} width={22} height={12} fill="#fff" stroke="#888" /><rect x={8} y={3} width={14} height={8} fill="#fff" stroke="#888" /><rect x={8} y={20} width={14} height={8} fill="#2a6bd4" opacity={0.25} stroke="#2a6bd4" /></>,
  };
  return <svg aria-hidden width={s} height={s} viewBox={big ? "0 0 30 30" : "0 0 16 16"} className="shrink-0">{content[name] ?? null}</svg>;
}
function FontSizeBox({ value, onChange, disabled }: { value: number; onChange: (size: number) => void; disabled?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const apply = (raw: string) => { const size = Number(raw); if (Number.isFinite(size) && size >= 1 && size <= 409) onChange(Math.round(size * 2) / 2); setText(null); };
  return (
    <span className="flex">
      <input aria-label="Font Size" list="xl-font-sizes" disabled={disabled} value={text ?? String(value)} onChange={(event) => { setText(event.target.value); if (FONT_SIZES.includes(Number(event.target.value))) apply(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); apply(text ?? String(value)); } }} onBlur={() => { if (text !== null) apply(text); }} className="h-[22px] w-12 border border-[#c6c6c6] bg-white px-1 text-[12px]" />
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
