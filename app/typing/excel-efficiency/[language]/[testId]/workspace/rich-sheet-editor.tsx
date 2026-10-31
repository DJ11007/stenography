"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { columnIndex, columnLetters, FUNCTION_LIBRARY, type FunctionCategory } from "@/lib/excel-formula";
import { autosaveExcelDocument, submitExcelDocument } from "../../../actions";
import { ConfirmDialog } from "@/components/efficiency/exam-chrome";
import { isStaleServerActionError } from "@/lib/pending-attempts";
import { FormatCellsDialog, type FormatCellsResult, type FormatCellsTab } from "./format-cells-dialog";
import { NUMBER_FORMAT_LABELS, PAPER_SIZES, toExcelDocumentV3, type ChartType, type ConditionalType, type ExcelDocument, type ExcelDocumentV2, type HeaderFooter, type SheetCell, type SheetSettings } from "@/lib/excel-document";
import {
  CONDITIONAL_STYLES, EMPTY_CELL, DEFAULT_FONT, DEFAULT_FONT_SIZE, MAX_COLS, MAX_ROWS, STYLE_KEYS, applyBorder, autoSumRange, borderCss, conditionalStyleAt, currentRegion, expandForMerges, formatCellValue, isBlankCell,
  mergeAt, mergeRanges, normalizeRect, parseEntry, parseRange, parseRef, previewHeaderText, rangeString, recomputeFormulas, rectContains, rectRefs, refAt,
  shiftColumns, shiftFormula, shiftRows, unmergeRanges, usedExtent, type BorderStyle, type Rect,
} from "@/lib/excel-sheet-model";
import { ConditionalDialog, FilterMenu, FindReplaceDialog, HIGHLIGHT_RULES, InputDialog, InsertFunctionDialog, PageSetupDialog, SortDialog, SymbolDialog, ZoomDialog, type FindOptions } from "./excel-dialogs";
import { ChartView } from "./excel-chart";
import { DataValidationDialog, DefineNameDialog, GoToSpecialDialog, HyperlinkDialog, InsertDeleteCellsDialog, ManageRulesDialog, MoreColorsDialog, NameManagerDialog, PasteSpecialDialog, SeriesDialog, TextToColumnsDialog, type GoToSpecialChoice, type PasteSpecialChoice, type SeriesChoice, type ShiftChoice } from "./excel-dialogs-more";
import { CURRENCIES, type CurrencySymbol, type DataValidation } from "@/lib/excel-document";
import { autoFill, autoFillDownLastRow, fillDirectionFor, fillExtension, type FillDirection } from "@/lib/excel-autofill";

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
type InputPurpose = "rowHeight" | "columnWidth" | "comment" | "protect" | "unprotect" | "chartTitle" | "defaultWidth";
type DialogState =
  | { kind: "insertFunction"; category?: "Most Recently Used" | "All" | FunctionCategory }
  | { kind: "sort"; rect: Rect; headers: boolean } | { kind: "symbol" } | { kind: "zoom" }
  | { kind: "conditional"; type: ConditionalType }
  | { kind: "find"; tab: "Find" | "Replace" }
  | { kind: "pageSetup"; tab: "Page" | "Margins" | "Header/Footer" | "Sheet" }
  | { kind: "input"; purpose: InputPurpose; chartId?: string }
  | { kind: "pasteSpecial" } | { kind: "insertCells" } | { kind: "deleteCells" } | { kind: "series" } | { kind: "goToSpecial" }
  | { kind: "hyperlink" } | { kind: "defineName" } | { kind: "nameManager" } | { kind: "validation" } | { kind: "textToColumns" }
  | { kind: "manageRules" } | { kind: "moreColors"; target: "font" | "fill" | "tab" };
const PROTECTED_MESSAGE = "The cell or chart you're trying to change is on a protected sheet. To make a change, unprotect the sheet (REVIEW > Unprotect Sheet).";
// Format as Table styles: header fill and font, banded row fill.
const TABLE_STYLES: [string, string, string, string][] = [["Table Style Light 9", "4472C4", "FFFFFF", "FFFFFF"], ["Table Style Medium 2", "4472C4", "FFFFFF", "D9E1F2"], ["Table Style Medium 3", "ED7D31", "FFFFFF", "FCE4D6"], ["Table Style Medium 4", "A5A5A5", "FFFFFF", "EDEDED"], ["Table Style Medium 7", "70AD47", "FFFFFF", "E2EFDA"]];
const FUNCTION_MENUS: [string, FunctionCategory][] = [["Financial", "Financial"], ["Logical", "Logical"], ["Text", "Text"], ["Date & Time", "Date & Time"], ["Lookup & Reference", "Lookup & Reference"], ["Math & Trig", "Math & Trig"]];
const DEFAULT_ROW_PX = 20;
// Excel column width (characters of the default font) to screen pixels, and row height (points) to pixels.
const widthToPx = (width: number) => (width <= 0 ? 0 : Math.round(width * 7 + 5));
const pointsToPx = (points: number) => Math.round((points * 4) / 3);

const cellOf = (cells: Record<string, SheetCell>, ref: string): SheetCell => cells[ref] ?? EMPTY_CELL;
const styleOf = (cell: SheetCell) => Object.fromEntries(STYLE_KEYS.map((key) => [key, cell[key] ?? null])) as Partial<SheetCell>;

type SaveAction = (id: string, document: unknown) => Promise<{ ok: boolean; error: string }>;

// mode "authoring": the admin solves the paper on the Model Answer page. The same sheet, but its autosave and its
// button save the model answer (autosaveAction / submitAction), the button can be pressed again and again
// (oneTimeSubmit false) and nothing is locked or sent to a results page.
export function RichSheetEditor({ attemptId, original, initialDocument, locked, autoSubmit = false, questionBar, mode = "attempt", autosaveAction, submitAction, submitLabel = "Submit", submitConfirmMessage = "Submit your final sheet? You cannot edit it afterward.", oneTimeSubmit = true, onReady }: { attemptId: string; original: ExcelDocument | ExcelDocumentV2; initialDocument?: ExcelDocument | ExcelDocumentV2 | null; locked: boolean; autoSubmit?: boolean; questionBar?: ReactNode; mode?: "attempt" | "authoring"; autosaveAction?: SaveAction; submitAction?: SaveAction; submitLabel?: string; submitConfirmMessage?: string | null; oneTimeSubmit?: boolean; onReady?: (document: ExcelDocument) => void }) {
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
  // Which cell is being edited, and whether from the formula bar. The typed text itself lives in editText (below),
  // not in this state: a keystroke then redraws only the cell editor and the formula bar, not the whole grid.
  const [editing, setEditing] = useState<{ ref: string; fromBar: boolean } | null>(null);
  const [editText] = useState(createTextStore);
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
  // The fill handle (the small square at the corner of the selection) being dragged: what was selected, and where the mouse is.
  const [fillDrag, setFillDrag] = useState<{ source: Rect; target: { row: number; col: number } } | null>(null);
  // Where a Format Painter drag began: read on mouse-up, so a quick click paints only the clicked cell even
  // before the new selection has rendered.
  const paintStart = useRef<{ row: number; col: number } | null>(null);
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

  // ---------- the fill handle (AutoFill) ----------
  // How far a fill reaches: the direction (the longer way out of the selection) and how many rows or columns it adds.
  const fillPlan = (source: Rect, target: { row: number; col: number }): { direction: FillDirection; count: number } | null => {
    const direction = fillDirectionFor(source, target);
    if (!direction) return null;
    const count = direction === "down" ? target.row - source.r2 : direction === "up" ? source.r1 - target.row : direction === "right" ? target.col - source.c2 : source.c1 - target.col;
    return count > 0 ? { direction, count } : null;
  };
  const fillPreview = useMemo(() => {
    if (!fillDrag) return null;
    const plan = fillPlan(fillDrag.source, fillDrag.target);
    return plan ? fillExtension(fillDrag.source, plan.direction, plan.count) : null;
  }, [fillDrag]); // eslint-disable-line react-hooks/exhaustive-deps -- fillPlan only reads its arguments
  const finishFill = (source: Rect, direction: FillDirection, count: number) => {
    const extension = fillExtension(source, direction, count);
    if (!extension) return;
    change("autoFill", { cells: autoFill(cells, source, direction, count) });
    selectRect({ r1: Math.min(source.r1, extension.r1), c1: Math.min(source.c1, extension.c1), r2: Math.max(source.r2, extension.r2), c2: Math.max(source.c2, extension.c2) });
  };
  // Mouse released after dragging the handle. Registered again after every render so it sees the latest sheet.
  useEffect(() => {
    if (!fillDrag) return;
    const release = () => {
      const plan = fillPlan(fillDrag.source, fillDrag.target);
      setFillDrag(null);
      if (plan) finishFill(fillDrag.source, plan.direction, plan.count);
    };
    window.addEventListener("mouseup", release);
    return () => window.removeEventListener("mouseup", release);
  });

  // ---------- saving ----------
  const buildDocument = useCallback((c = cells, m = merges, s = sheet, ops = operations): ExcelDocument => {
    const values = recomputeFormulas(c, s.definedNames);
    const kept = Object.fromEntries(Object.entries(values).filter(([, cell]) => !isBlankCell(cell)));
    const extent = usedExtent(kept, m, s, baseRows, baseCols);
    return { schemaVersion: "3", rows: extent.rows, cols: extent.cols, cells: kept, merges: m, sheet: s, operations: ops.slice(0, 256), savedAt: new Date().toISOString() };
  }, [cells, merges, sheet, operations, baseRows, baseCols]);
  // Each deploy gives the save actions new ids, so a page opened before a deploy gets a 404 ("Server Action ... was
  // not found") on its next save. The sheet is then kept in this tab (sessionStorage) and the page reloads itself;
  // after the reload the kept sheet is put back and saved again, so nothing is lost. A network failure keeps the
  // sheet the same way and the next change (or Save) tries again.
  const [staleDeploy, setStaleDeploy] = useState(false);
  const keptKey = `excel-unsaved:${mode}:${attemptId}`;
  const keepUnsaved = (document: ExcelDocument) => { try { sessionStorage.setItem(keptKey, JSON.stringify(document)); } catch { /* storage unavailable */ } };
  const clearUnsaved = () => { try { sessionStorage.removeItem(keptKey); } catch { /* storage unavailable */ } };
  const recoverFromDeploy = (document: ExcelDocument) => {
    keepUnsaved(document);
    setStaleDeploy(true);
    // One automatic reload; if the page is still stale right after it, the Refresh page button stays instead of looping.
    let recent = false;
    try { recent = Date.now() - Number(sessionStorage.getItem("excel-deploy-reload") ?? 0) < 60_000; sessionStorage.setItem("excel-deploy-reload", String(Date.now())); } catch { recent = true; }
    if (!recent) window.location.reload();
  };
  const saveDocument = async () => {
    const document = buildDocument() as ExcelDocument;
    setStatus("Saving…");
    try {
      const result = await (autosaveAction ?? autosaveExcelDocument)(attemptId, document);
      if (result.ok) clearUnsaved(); else keepUnsaved(document);
      setStatus(result.ok ? "Saved" : result.error);
    } catch (error) {
      if (isStaleServerActionError(error)) { setStatus("This page was updated. Reloading to save your work…"); recoverFromDeploy(document); return; }
      keepUnsaved(document);
      setStatus("Could not save. Check your internet connection; your work is kept and will be saved again.");
    }
  };
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (revision === 0 || submitted) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { void saveDocument(); }, 800);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [revision]); // eslint-disable-line react-hooks/exhaustive-deps -- saves after each change

  // The Model Answer page needs the sheet as it first looks (before anything is changed) as its checkpoint.
  useEffect(() => { onReady?.(buildDocument()); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, on first render
  // A sheet kept in this tab when a save failed (see saveDocument) comes back after the reload and is saved again,
  // unless the saved one is newer (saved from another tab meanwhile).
  useEffect(() => {
    let kept: ExcelDocument | null = null;
    try { const raw = sessionStorage.getItem(keptKey); kept = raw ? toExcelDocumentV3(JSON.parse(raw)) : null; } catch { kept = null; }
    if (!kept || locked || (start.savedAt && kept.savedAt <= start.savedAt)) { clearUnsaved(); return; }
    const sheetToRestore = kept;
    const timer = setTimeout(() => {
      setCells(sheetToRestore.cells); setMerges(sheetToRestore.merges); setSheet(sheetToRestore.sheet); setOperations(sheetToRestore.operations ?? []);
      setRevision((current) => current + 1);
      setStatus("Your unsaved work was put back. Saving…");
    }, 0);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, on first render

  // Development only: lets the local test page read the sheet as it would be saved.
  useEffect(() => { if (process.env.NODE_ENV !== "production") (window as unknown as { __excelDocument?: () => ExcelDocument }).__excelDocument = () => buildDocument(); });

  // ---------- changing the sheet (one undo step each) ----------
  const record = (op: string) => setOperations((current) => (current.includes(op) ? current : [...current, op]));
  const change = (op: string, next: Partial<Snapshot>, unlockedEdit = false) => {
    if (submitted) return;
    // A protected sheet refuses every change but unprotecting it and typing into unlocked cells, as Excel does.
    if (sheet.protected && op !== "unprotectSheet" && !unlockedEdit) { setNotice(PROTECTED_MESSAGE); return; }
    undoStack.current.push({ cells, merges, sheet }); if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
    const names = (next.sheet ?? sheet).definedNames;
    if (next.cells) setCells(recomputeFormulas(next.cells, names));
    else if (next.sheet && next.sheet.definedNames !== sheet.definedNames) setCells(recomputeFormulas(cells, names));
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
    // A plain arrow moves from the active cell (Excel: after A27:L27, Down goes to A28); Shift+arrow moves the far end.
    const from = extend ? focus : anchor;
    let row = from.row + dRow, col = from.col + dCol;
    const merged = mergeAt(merges, from.row, from.col);
    if (merged && !extend) { if (dRow > 0) row = merged.r2 + 1; if (dCol > 0) col = merged.c2 + 1; if (dRow < 0) row = merged.r1 - 1; if (dCol < 0) col = merged.c1 - 1; }
    const target = mergeAt(merges, row, col);
    if (target && !extend) { row = target.r1; col = target.c1; }
    select(row, col, extend);
  };

  // ---------- typing into cells ----------
  const beginEdit = (initial?: string, fromBar = false) => { if (submitted) return; if (sheet.protected && active.locked !== false) { setNotice(PROTECTED_MESSAGE); return; } editText.set(initial ?? (active.formula ?? (active.value == null ? "" : String(active.value)))); setEditing({ ref: activeCellRef, fromBar }); };
  useEffect(() => { if (editing && !editing.fromBar) editInputRef.current?.focus(); }, [editing?.ref]); // eslint-disable-line react-hooks/exhaustive-deps
  // Escape drops the typed text, as in Excel. Moving focus back to the grid blurs the editor, whose blur would
  // otherwise save it; the flag stops that one commit.
  const cancelled = useRef(false);
  const cancelEdit = () => { cancelled.current = true; setEditing(null); focusGrid(); cancelled.current = false; };
  const commitEdit = (move: "down" | "right" | "none" = "none") => {
    if (!editing || cancelled.current) return;
    const text = editText.get();
    const current = cellOf(cells, editing.ref);
    // A typed date (25-10-2026, 25/10/2026, 2026-10-25) is stored as Excel's date number with a date format.
    const typedDate = current.numberFormat === "Text" ? null : parseDate(text);
    const entry = typedDate !== null ? { value: typedDate, formula: null } : current.numberFormat === "Text" && !text.startsWith("=") ? { value: text === "" ? null : text, formula: null } : parseEntry(text);
    if (entry.value !== current.value || entry.formula !== current.formula) {
      // Data Validation: an entry the rule does not allow is refused with Excel's error alert.
      const rule = validationFor(editing.ref);
      if (rule && !passesValidation(rule, entry.value)) { setValidationAlert({ title: rule.title || "Microsoft Excel", message: rule.message || "This value doesn't match the data validation restrictions defined for this cell." }); return; }
      const fn = entry.formula?.match(/^=\s*([A-Z]+)\s*\(/i)?.[1]?.toUpperCase();
      // As in Excel, a cell given a date function shows a date (if it still has the General format).
      const dated = (typedDate !== null || (fn && ["TODAY", "DATE", "NOW"].includes(fn))) && (current.numberFormat ?? "General") === "General" ? { numberFormat: "ShortDate" as const } : {};
      change(fn ? `formula:${fn}` : entry.formula ? "formula" : "edit", { cells: { ...cells, [editing.ref]: { ...current, ...entry, ...dated } } }, Boolean(sheet.protected && current.locked === false));
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
      const source = clip.cells[refAt(clip.rect.r1 + i, clip.rect.c1 + j)] ?? EMPTY_CELL;
      // Relative references move with the paste, as in Excel (a cut keeps them).
      next[refAt(row, col)] = { ...source, formula: clip.cut ? source.formula : shiftFormula(source.formula, focus.row - clip.rect.r1, focus.col - clip.rect.c1) };
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
  /** Sort the rows of a range by one column; a header row stays where it is. Blanks go last, as in Excel. */
  const sortRows = (rect: Rect, column: number, descending: boolean, headers: boolean, op: string) => {
    const first = headers ? rect.r1 + 1 : rect.r1;
    if (first >= rect.r2) { setNotice("There is nothing to sort: select two or more rows of data."); return; }
    const rows = Array.from({ length: rect.r2 - first + 1 }, (_, i) => first + i);
    const key = (row: number) => cellOf(cells, refAt(row, column)).value;
    const ordered = [...rows].sort((a, b) => {
      const x = key(a), y = key(b);
      if (x === null || x === "") return y === null || y === "" ? 0 : 1;
      if (y === null || y === "") return -1;
      const result = typeof x === "number" && typeof y === "number" ? x - y : typeof x === "number" ? -1 : typeof y === "number" ? 1 : String(x).localeCompare(String(y), undefined, { sensitivity: "base" });
      return descending ? -result : result;
    });
    const next = { ...cells };
    ordered.forEach((fromRow, index) => { for (let col = rect.c1; col <= rect.c2; col++) { const cell = cells[refAt(fromRow, col)]; if (cell) next[refAt(rows[index], col)] = cell; else delete next[refAt(rows[index], col)]; } });
    change(op, { cells: next });
  };
  /** The range a Sort or Filter works on: the selection, or the data around the active cell. */
  const dataRange = () => (selection.r1 === selection.r2 && selection.c1 === selection.c2 ? currentRegion(cells, focus.row, focus.col) : selection);
  // Excel guesses a header row when the first row is text and the next row holds numbers or the filter is on.
  const looksLikeHeaders = (rect: Rect) => {
    if (sheet.filter) { const filter = parseRange(sheet.filter); if (filter && filter.r1 === rect.r1) return true; }
    const firstRow = Array.from({ length: rect.c2 - rect.c1 + 1 }, (_, i) => cellOf(cells, refAt(rect.r1, rect.c1 + i)).value);
    const secondRow = Array.from({ length: rect.c2 - rect.c1 + 1 }, (_, i) => cellOf(cells, refAt(rect.r1 + 1, rect.c1 + i)).value);
    return rect.r2 > rect.r1 && firstRow.every((value) => value === null || typeof value === "string") && firstRow.some((value) => value !== null) && secondRow.some((value) => typeof value === "number");
  };
  const sortSelection = (direction: "asc" | "desc") => {
    const rect = dataRange();
    const column = selection.r1 === selection.r2 && selection.c1 === selection.c2 ? focus.col : rect.c1;
    sortRows(rect, column, direction === "desc", looksLikeHeaders(rect), direction === "asc" ? "sortAscending" : "sortDescending");
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
    if (ctrl && key.toLowerCase() === "f") { event.preventDefault(); openDialog({ kind: "find", tab: "Find" }); return; }
    if (ctrl && key.toLowerCase() === "h") { event.preventDefault(); if (!submitted) openDialog({ kind: "find", tab: "Replace" }); return; }
    if (ctrl && event.shiftKey && key.toLowerCase() === "l") { event.preventDefault(); if (!submitted) toggleFilter(); return; }
    if (ctrl && (key === "`" || key === "~")) { event.preventDefault(); setShowFormulas((value) => !value); return; }
    if (event.shiftKey && key === "F2") { event.preventDefault(); if (!submitted) openDialog({ kind: "input", purpose: "comment" }); return; }
    if (event.shiftKey && key === "F3") { event.preventDefault(); if (!submitted) openDialog({ kind: "insertFunction" }); return; }
    if (selectedChart && (key === "Delete" || key === "Backspace")) { event.preventDefault(); if (!submitted) deleteChart(selectedChart); return; }
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
      const result = await (submitAction ?? submitExcelDocument)(attemptId, finalDocument);
      clearUnsaved();
      if (!result.ok) {
        if (/already submitted/i.test(result.error)) { submittedRef.current = true; setSubmitted(true); router.push(`/typing/excel-efficiency/results/${attemptId}`); return true; }
        return fail(result.error);
      }
      if (!oneTimeSubmit) { setStatus("Saved"); setFinalSubmitting(false); submitting.current = false; return true; }
      submittedRef.current = true; setSubmitted(true); setStatus("Test submitted successfully");
      router.push(`/typing/excel-efficiency/results/${attemptId}`);
      return true;
    } catch (error) {
      keepUnsaved(finalDocument as ExcelDocument);
      if (isStaleServerActionError(error)) { setStaleDeploy(true); return fail("This page was updated on the server. Press Refresh page, then press the button again. Your sheet is kept, nothing is lost."); }
      return fail("Submission failed. Check your internet connection and try again.");
    }
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
  const fillRange = (direction: "down" | "right" | "up" | "left") => {
    const next = { ...cells };
    for (let row = selection.r1; row <= selection.r2; row++) for (let col = selection.c1; col <= selection.c2; col++) {
      const sourceRow = direction === "down" ? selection.r1 : direction === "up" ? selection.r2 : row;
      const sourceCol = direction === "right" ? selection.c1 : direction === "left" ? selection.c2 : col;
      if (sourceRow === row && sourceCol === col) continue;
      const source = cellOf(cells, refAt(sourceRow, sourceCol));
      next[refAt(row, col)] = { ...source, formula: shiftFormula(source.formula, row - sourceRow, col - sourceCol) };
    }
    change(direction === "down" ? "fillDown" : direction === "right" ? "fillRight" : direction === "up" ? "fillUp" : "fillLeft", { cells: next });
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
    ["Heading 3", { fontSize: 11, bold: true, fontColor: "44546A", border: "b" }], ["Heading 4", { bold: true, fontColor: "44546A" }],
    ["Calculation", { bold: true, fontColor: "FA7D00", fillColor: "F2F2F2", border: "trbl" }], ["Check Cell", { bold: true, fontColor: "FFFFFF", fillColor: "A5A5A5", border: "trbl" }],
    ["Explanatory Text", { italic: true, fontColor: "7F7F7F" }], ["Input", { fontColor: "3F3F76", fillColor: "FFCC99", border: "trbl" }],
    ["Linked Cell", { fontColor: "FA7D00", border: "b=" }], ["Output", { bold: true, fontColor: "3F3F3F", fillColor: "F2F2F2", border: "trbl" }], ["Warning Text", { fontColor: "FF0000" }],
    ["20% - Accent1", { fillColor: "D9E1F2" }], ["40% - Accent1", { fillColor: "B4C6E7" }], ["60% - Accent1", { fillColor: "8EA9DB", fontColor: "FFFFFF" }],
    ["Accent2", { fillColor: "ED7D31", fontColor: "FFFFFF" }], ["Accent6", { fillColor: "70AD47", fontColor: "FFFFFF" }],
    ["Comma", { numberFormat: "Number", decimals: 2 }], ["Currency", { numberFormat: "Currency", decimals: 2 }], ["Percent", { numberFormat: "Percentage", decimals: 0 }],
  ];
  const saveNow = async () => { if (submitted) return; if (autosaveTimer.current) clearTimeout(autosaveTimer.current); void saveDocument(); };
  const openContextMenu = (event: React.MouseEvent, row: number, col: number) => {
    event.preventDefault();
    if (!rectContains(selection, row, col)) select(row, col);
    setMenu(null);
    setContextMenu({ x: event.clientX, y: event.clientY });
  };
  useEffect(() => { if (!contextMenu) return; const close = (event: MouseEvent) => { if (!(event.target as HTMLElement).closest?.("[data-xl-context]")) setContextMenu(null); }; window.addEventListener("mousedown", close); return () => window.removeEventListener("mousedown", close); }, [contextMenu]);

  // ---------- dialogs, filter, charts, comments, protection, freeze panes, hiding, sizes ----------
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [filterMenu, setFilterMenu] = useState<{ col: number; x: number; y: number } | null>(null);
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [showFormulas, setShowFormulas] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [renamingSheet, setRenamingSheet] = useState<string | null>(null);
  const openDialog = (next: DialogState) => { setMenu(null); setContextMenu(null); setDialog(next); };
  const closeDialog = () => { setDialog(null); focusGrid(); };
  const openSort = () => { const rect = dataRange(); openDialog({ kind: "sort", rect, headers: looksLikeHeaders(rect) }); };
  const sheetName = sheet.name || "Sheet1";
  const wholeRows = selection.c1 === 0 && selection.c2 === displayCols - 1, wholeCols = selection.r1 === 1 && selection.r2 >= displayRows;

  const toggleFilter = () => {
    if (sheet.filter) { change("filter", { sheet: { ...sheet, filter: null, filterHidden: {} } }); setNotice(null); return; }
    const rect = dataRange();
    if (rect.r1 === rect.r2) { setNotice("Select a cell in your data (a header row with data below it), then press Filter."); return; }
    change("filter", { sheet: { ...sheet, filter: rangeString({ ...rect, r1: rect.r1, r2: rect.r2 }), filterHidden: {} } });
  };
  const filterRect = sheet.filter ? parseRange(sheet.filter) : null;
  const filterValues = (col: number) => {
    if (!filterRect) return [];
    const values = new Set<string>();
    for (let row = filterRect.r1 + 1; row <= filterRect.r2; row++) { const value = cellOf(cells, refAt(row, col)).value; values.add(value == null ? "" : formatCellValue(value, cellOf(cells, refAt(row, col)).numberFormat, cellOf(cells, refAt(row, col)).decimals)); }
    return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  };
  const applyFilterValues = (col: number, hidden: string[]) => {
    const letter = columnLetters(col);
    const next = { ...(sheet.filterHidden ?? {}) };
    if (hidden.length) next[letter] = hidden; else delete next[letter];
    change("filterValues", { sheet: { ...sheet, filterHidden: next } });
    setFilterMenu(null);
  };
  const filteredOut = useMemo(() => {
    const hiddenRows = new Set<number>();
    if (!filterRect || !sheet.filterHidden) return hiddenRows;
    for (const [letter, values] of Object.entries(sheet.filterHidden)) {
      const col = columnIndex(letter), hide = new Set(values.map(String));
      for (let row = filterRect.r1 + 1; row <= filterRect.r2; row++) { const cell = cellOf(cells, refAt(row, col)); const text = cell.value == null ? "" : formatCellValue(cell.value, cell.numberFormat, cell.decimals); if (hide.has(text)) hiddenRows.add(row); }
    }
    return hiddenRows;
  }, [cells, sheet.filter, sheet.filterHidden]); // eslint-disable-line react-hooks/exhaustive-deps -- filterRect comes from sheet.filter

  const removeDuplicates = () => {
    const rect = dataRange();
    const headers = looksLikeHeaders(rect), first = headers ? rect.r1 + 1 : rect.r1;
    const seen = new Set<string>(), keep: number[] = [];
    for (let row = first; row <= rect.r2; row++) { const key = Array.from({ length: rect.c2 - rect.c1 + 1 }, (_, i) => String(cellOf(cells, refAt(row, rect.c1 + i)).value ?? "").toLowerCase()).join("\u0001"); if (!seen.has(key)) { seen.add(key); keep.push(row); } }
    const removed = rect.r2 - first + 1 - keep.length;
    if (!removed) { setNotice("No duplicate values found."); return; }
    const next = { ...cells };
    for (let row = first; row <= rect.r2; row++) for (let col = rect.c1; col <= rect.c2; col++) delete next[refAt(row, col)];
    keep.forEach((fromRow, index) => { for (let col = rect.c1; col <= rect.c2; col++) { const cell = cells[refAt(fromRow, col)]; if (cell) next[refAt(first + index, col)] = cell; } });
    // A filter over the same rows shrinks with them, as an Excel table does.
    const filter = sheet.filter ? parseRange(sheet.filter) : null;
    const nextSheet = filter && filter.r1 <= rect.r1 && filter.r2 === rect.r2 ? { ...sheet, filter: rangeString({ ...filter, r2: Math.max(filter.r1 + 1, first + keep.length - 1) }) } : sheet;
    change("removeDuplicates", { cells: next, sheet: nextSheet });
    setNotice(`${removed} duplicate value${removed === 1 ? "" : "s"} found and removed; ${keep.length} unique value${keep.length === 1 ? "" : "s"} remain.`);
  };

  const addConditional = (rule: { type: ConditionalType; value?: string | number; value2?: string | number; style: NonNullable<SheetSettings["conditionalFormats"]>[number]["style"] }) => {
    change("conditionalFormat", { sheet: { ...sheet, conditionalFormats: [...(sheet.conditionalFormats ?? []), { range: rangeString(selection), ...rule }].slice(-50) } });
    closeDialog();
  };
  const clearConditional = (entireSheet: boolean) => {
    const rules = (sheet.conditionalFormats ?? []).filter((rule) => { if (entireSheet) return false; const rect = parseRange(rule.range); return !rect || !(rect.r1 <= selection.r2 && selection.r1 <= rect.r2 && rect.c1 <= selection.c2 && selection.c1 <= rect.c2); });
    change("clearConditionalFormat", { sheet: { ...sheet, conditionalFormats: rules } });
  };
  const formatAsTable = (style: (typeof TABLE_STYLES)[number]) => {
    const rect = dataRange();
    if (rect.r1 === rect.r2) { setNotice("Select the data (with its header row) to format as a table."); return; }
    const [, header, headerFont, band] = style;
    let next = { ...cells };
    for (let row = rect.r1; row <= rect.r2; row++) for (let col = rect.c1; col <= rect.c2; col++) {
      const ref = refAt(row, col), cell = cellOf(next, ref);
      next[ref] = row === rect.r1 ? { ...cell, bold: true, fillColor: header, fontColor: headerFont } : { ...cell, fillColor: (row - rect.r1) % 2 === 0 ? band : "FFFFFF" };
    }
    next = applyBorder(next, rect, "all");
    change("formatAsTable", { cells: next, sheet: { ...sheet, filter: rangeString(rect), filterHidden: {} } });
  };

  const insertChart = (type: ChartType) => {
    const rect = dataRange();
    if (rect.r1 === rect.r2 && rect.c1 === rect.c2) { setNotice("Select the data for the chart (for example the names and their values), then insert the chart."); return; }
    const id = `chart${(sheet.charts ?? []).reduce((most, chart) => Math.max(most, Number(chart.id.replace(/D/g, "")) || 0), 0) + 1}`;
    const anchor = refAt(Math.max(1, rect.r1), Math.min(MAX_COLS - 1, rect.c2 + 2));
    const title = rect.c2 > rect.c1 && typeof cellOf(cells, refAt(rect.r1, rect.c2)).value === "string" && rect.c2 - rect.c1 === 1 ? String(cellOf(cells, refAt(rect.r1, rect.c2)).value) : "Chart Title";
    change("chart", { sheet: { ...sheet, charts: [...(sheet.charts ?? []), { id, type, range: rangeString(rect), title, anchor }].slice(-10) } });
    setSelectedChart(id);
  };
  const updateChart = (id: string, patch: Partial<NonNullable<SheetSettings["charts"]>[number]>, op: string) => change(op, { sheet: { ...sheet, charts: (sheet.charts ?? []).map((chart) => (chart.id === id ? { ...chart, ...patch } : chart)) } });
  const deleteChart = (id: string) => { change("deleteChart", { sheet: { ...sheet, charts: (sheet.charts ?? []).filter((chart) => chart.id !== id) } }); setSelectedChart(null); };

  const setComment = (text: string) => { const trimmed = text.trim(); formatSelection({ comment: trimmed ? trimmed.slice(0, 500) : null }, trimmed ? "comment" : "deleteComment", { r1: focus.row, c1: focus.col, r2: focus.row, c2: focus.col }); closeDialog(); };
  const deleteComment = () => formatSelection({ comment: null }, "deleteComment");
  const gotoComment = (step: 1 | -1) => {
    const list = Object.entries(cells).filter(([, cell]) => cell.comment).map(([ref]) => parseRef(ref)!).sort((a, b) => a.row - b.row || a.col - b.col);
    if (!list.length) { setNotice("There are no comments on this sheet."); return; }
    const index = list.findIndex((at) => at.row > focus.row || (at.row === focus.row && at.col > focus.col));
    const after = step === 1 ? (index < 0 ? list[0] : list[index]) : [...list].reverse().find((at) => at.row < focus.row || (at.row === focus.row && at.col < focus.col)) ?? list[list.length - 1];
    select(after.row, after.col); setShowCommentAt(refAt(after.row, after.col));
  };
  const [showCommentAt, setShowCommentAt] = useState<string | null>(null);
  const protectSheet = () => { change("protectSheet", { sheet: { ...sheet, protected: true } }); closeDialog(); setNotice("The sheet is protected. REVIEW > Unprotect Sheet allows changes again."); };
  const unprotectSheet = () => { change("unprotectSheet", { sheet: { ...sheet, protected: false } }); closeDialog(); setNotice(null); };

  const freezeAt = (ref: string | null, op: "freezePanes" | "unfreezePanes") => { change(op, { sheet: { ...sheet, freeze: ref } }); setMenu(null); };
  const freeze = sheet.freeze ? parseRef(sheet.freeze) : null;

  const hideRows = (hide: boolean) => {
    const rows = new Set(sheet.hiddenRows ?? []);
    for (let row = selection.r1; row <= Math.min(selection.r2, MAX_ROWS); row++) { if (hide) rows.add(row); else rows.delete(row); }
    if (!hide && selection.r1 === selection.r2) { rows.delete(selection.r1 - 1); rows.delete(selection.r1 + 1); }
    change(hide ? "hideRows" : "unhideRows", { sheet: { ...sheet, hiddenRows: [...rows].sort((a, b) => a - b) } });
  };
  const hideColumns = (hide: boolean) => {
    const cols = new Set(sheet.hiddenCols ?? []);
    for (let col = selection.c1; col <= selection.c2; col++) { if (hide) cols.add(col); else cols.delete(col); }
    if (!hide && selection.c1 === selection.c2) { cols.delete(selection.c1 - 1); cols.delete(selection.c1 + 1); }
    change(hide ? "hideColumns" : "unhideColumns", { sheet: { ...sheet, hiddenCols: [...cols].sort((a, b) => a - b) } });
  };
  const setRowHeight = (points: number | null) => {
    const heights = { ...(sheet.rowHeights ?? {}) };
    for (let row = selection.r1; row <= Math.min(selection.r2, MAX_ROWS); row++) { if (points === null) delete heights[String(row)]; else heights[String(row)] = Math.round(points * 100) / 100; }
    change("rowHeight", { sheet: { ...sheet, rowHeights: heights } });
  };
  const setColumnWidth = (width: number | null) => {
    const widths = { ...(sheet.colWidths ?? {}) };
    for (let col = selection.c1; col <= selection.c2; col++) { if (width === null) delete widths[columnLetters(col)]; else widths[columnLetters(col)] = Math.round(width * 100) / 100; }
    change("columnWidth", { sheet: { ...sheet, colWidths: widths } });
  };
  // AutoFit: the widest entry in each selected column, in characters of the default font.
  const autoFitColumns = () => {
    const widths = { ...(sheet.colWidths ?? {}) };
    for (let col = selection.c1; col <= selection.c2; col++) {
      let longest = 0;
      for (const [ref, cell] of Object.entries(cells)) { const at = parseRef(ref); if (at?.col === col && cell.value != null && !mergeAt(merges, at.row, col)) longest = Math.max(longest, formatCellValue(cell.value, cell.numberFormat, cell.decimals).length * ((cell.fontSize ?? DEFAULT_FONT_SIZE) / DEFAULT_FONT_SIZE) * (cell.bold ? 1.1 : 1)); }
      widths[columnLetters(col)] = Math.min(255, Math.max(2, Math.ceil(longest + 1)));
    }
    change("columnWidth", { sheet: { ...sheet, colWidths: widths } });
  };
  const applyInput = (purpose: InputPurpose, value: string, chartId?: string) => {
    if (purpose === "rowHeight") setRowHeight(Number(value));
    else if (purpose === "columnWidth") setColumnWidth(Number(value));
    else if (purpose === "comment") { setComment(value); return; }
    else if (purpose === "protect") { protectSheet(); return; }
    else if (purpose === "unprotect") { unprotectSheet(); return; }
    else if (purpose === "chartTitle" && chartId) updateChart(chartId, { title: value.slice(0, 255) }, "chartTitle");
    closeDialog();
  };
  const renameSheet = (name: string) => {
    const trimmed = name.trim();
    setRenamingSheet(null);
    if (!trimmed || trimmed === sheetName) return;
    if (trimmed.length > 31 || /[[\]:*?/\\]/.test(trimmed)) { setNotice("A sheet name can have up to 31 characters and cannot contain : \\ / ? * [ or ]."); return; }
    change("renameSheet", { sheet: { ...sheet, name: trimmed } });
  };

  // Find and Replace work on the shown text of cells (and the formula of formula cells, as Excel's default "Look in: Formulas").
  const findMatch = (text: string, find: string, options: FindOptions) => {
    const a = options.matchCase ? text : text.toLowerCase(), b = options.matchCase ? find : find.toLowerCase();
    return options.entireCell ? a === b : a.includes(b);
  };
  const cellText = (cell: SheetCell) => cell.formula ?? (cell.value == null ? "" : String(cell.value));
  const findNext = (find: string, options: FindOptions) => {
    const refs = Object.keys(cells).map((ref) => ({ ref, at: parseRef(ref)! })).filter(({ at }) => at).sort((x, y) => x.at.row - y.at.row || x.at.col - y.at.col);
    const after = refs.filter(({ at }) => at.row > focus.row || (at.row === focus.row && at.col > focus.col));
    const hit = [...after, ...refs].find(({ ref }) => findMatch(cellText(cells[ref]), find, options));
    if (!hit) return `We couldn't find what you were looking for.`;
    select(hit.at.row, hit.at.col);
    return "";
  };
  const replaceIn = (text: string, find: string, replacement: string, options: FindOptions) => {
    if (options.entireCell) return findMatch(text, find, options) ? replacement : text;
    return text.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), options.matchCase ? "g" : "gi"), replacement);
  };
  const replaceAll = (find: string, replacement: string, options: FindOptions) => {
    const next = { ...cells }; let count = 0;
    for (const [ref, cell] of Object.entries(cells)) {
      const text = cellText(cell);
      if (!text || !findMatch(text, find, options)) continue;
      next[ref] = { ...cell, ...parseEntry(replaceIn(text, find, replacement, options)) }; count++;
    }
    if (!count) return "We couldn't find anything to replace.";
    change("replace", { cells: next });
    return `All done. We made ${count} replacement${count === 1 ? "" : "s"}.`;
  };
  const replaceOne = (find: string, replacement: string, options: FindOptions) => {
    const cell = cellOf(cells, activeCellRef), text = cellText(cell);
    if (text && findMatch(text, find, options)) { change("replace", { cells: { ...cells, [activeCellRef]: { ...cell, ...parseEntry(replaceIn(text, find, replacement, options)) } } }); }
    return findNext(find, options);
  };
  const insertSymbol = (symbol: string) => { const cell = cellOf(cells, activeCellRef); if (cell.formula) { setNotice("Insert a symbol into a cell with text, not a formula."); return; } change("symbol", { cells: { ...cells, [activeCellRef]: { ...cell, value: `${cell.value ?? ""}${symbol}` } } }); closeDialog(); };
  const insertFunction = (name: string) => {
    closeDialog();
    const info = FUNCTION_LIBRARY.find((fn) => fn.name === name);
    record("insertFunction");
    beginEdit(`=${name}(`);
    if (info) setNotice(`${info.syntax} — ${info.description} Type the arguments, then press Enter.`);
  };
  const zoomToSelection = () => {
    const box = gridRef.current?.getBoundingClientRect();
    if (!box) return;
    const width = Array.from({ length: selection.c2 - selection.c1 + 1 }, (_, i) => colPx(selection.c1 + i)).reduce((a, b) => a + b, 0) + ROW_HEADER_WIDTH;
    const height = Array.from({ length: selection.r2 - selection.r1 + 1 }, (_, i) => rowHeight(selection.r1 + i)).reduce((a, b) => a + b, 0) + 24;
    const zoomed = Math.max(10, Math.min(400, Math.floor(Math.min(box.width / width, box.height / height) * 100)));
    change("zoom", { sheet: { ...sheet, zoom: zoomed } });
    closeDialog();
  };
  useEffect(() => { if (!filterMenu) return; const close = (event: MouseEvent) => { if (!(event.target as HTMLElement).closest?.("[data-xl-filter]")) setFilterMenu(null); }; window.addEventListener("mousedown", close); return () => window.removeEventListener("mousedown", close); }, [filterMenu]);

  // ---------- the rest of Excel 2013's commands ----------
  const [validationAlert, setValidationAlert] = useState<{ title: string; message: string } | null>(null);
  const parseDate = (text: string) => {
    const dmy = text.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/), ymd = text.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    const [d, m, y] = dmy ? [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])] : ymd ? [Number(ymd[3]), Number(ymd[2]), Number(ymd[1])] : [0, 0, 0];
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
  };
  const validationFor = (ref: string) => { const at = parseRef(ref); if (!at) return null; return (sheet.validations ?? []).find((rule) => { const rect = parseRange(rule.range); return rect && rectContains(rect, at.row, at.col); }) ?? null; };
  const passesValidation = (rule: DataValidation, value: string | number | null) => {
    if (value === null || value === "") return true;
    if (rule.type === "list") return (rule.list ?? "").split(",").map((item) => item.trim().toLowerCase()).includes(String(value).trim().toLowerCase());
    const x = rule.type === "textLength" ? String(value).length : rule.type === "date" ? (typeof value === "number" ? value : parseDate(String(value))) : typeof value === "number" ? value : null;
    if (x === null || (rule.type === "whole" && !Number.isInteger(x))) return false;
    const toNumber = (text?: string) => (text === undefined || text.trim() === "" ? null : rule.type === "date" ? parseDate(text) : Number.isFinite(Number(text)) ? Number(text) : null);
    const a = toNumber(rule.value1), b = toNumber(rule.value2);
    if (a === null) return true;
    switch (rule.operator ?? "between") {
      case "between": return b !== null && x >= Math.min(a, b) && x <= Math.max(a, b);
      case "notBetween": return b !== null && (x < Math.min(a, b) || x > Math.max(a, b));
      case "equal": return x === a; case "notEqual": return x !== a;
      case "greater": return x > a; case "less": return x < a; case "greaterOrEqual": return x >= a; case "lessOrEqual": return x <= a;
    }
    return true;
  };
  const setValidation = (rule: Omit<DataValidation, "range">) => {
    const kept = (sheet.validations ?? []).filter((existing) => { const rect = parseRange(existing.range); return !rect || !(rect.r1 <= selection.r2 && selection.r1 <= rect.r2 && rect.c1 <= selection.c2 && selection.c1 <= rect.c2); });
    change("dataValidation", { sheet: { ...sheet, validations: [...kept, { range: rangeString(selection), ...rule }].slice(-50) } });
    closeDialog();
  };
  const clearValidation = () => { change("dataValidation", { sheet: { ...sheet, validations: (sheet.validations ?? []).filter((existing) => { const rect = parseRange(existing.range); return !rect || !(rect.r1 <= selection.r2 && selection.r1 <= rect.r2 && rect.c1 <= selection.c2 && selection.c1 <= rect.c2); }) } }); closeDialog(); };
  const pickFromList = (value: string) => { const current = cellOf(cells, activeCellRef); change("edit", { cells: { ...cells, [activeCellRef]: { ...current, ...parseEntry(value) } } }, Boolean(sheet.protected && current.locked === false)); setListMenu(false); focusGrid(); };
  const [listMenu, setListMenu] = useState(false);

  const toggleUnderline = (style: "single" | "double") => {
    const on = Boolean(active.underline) && (active.underlineStyle ?? "single") === style;
    formatSelection({ underline: !on, underlineStyle: !on && style === "double" ? "double" : null }, style === "double" ? "underlineDouble" : "underline");
  };
  const applyCurrency = (symbol: CurrencySymbol) => formatSelection({ numberFormat: "Accounting", currency: symbol === "₹" ? null : symbol, decimals: active.decimals ?? 2 }, "currency");

  const pasteSpecialApply = (choice: PasteSpecialChoice, keepNumberFormat = false) => {
    if (!clip) { setNotice("Copy cells first (Ctrl+C), then select where to paste."); return; }
    const next = { ...cells };
    let widths = sheet.colWidths;
    const height = clip.rect.r2 - clip.rect.r1, width = clip.rect.c2 - clip.rect.c1;
    for (let i = 0; i <= height; i++) for (let j = 0; j <= width; j++) {
      const [di, dj] = choice.transpose ? [j, i] : [i, j];
      const row = focus.row + di, col = focus.col + dj;
      if (row > MAX_ROWS || col >= MAX_COLS) continue;
      const source = clip.cells[refAt(clip.rect.r1 + i, clip.rect.c1 + j)] ?? EMPTY_CELL;
      if (choice.skipBlanks && source.value == null && !source.formula) continue;
      const target = cellOf(next, refAt(row, col));
      const formula = shiftFormula(source.formula, row - (clip.rect.r1 + i), col - (clip.rect.c1 + j));
      const number = keepNumberFormat ? { numberFormat: source.numberFormat, decimals: source.decimals ?? null, currency: source.currency ?? null } : {};
      let made: SheetCell;
      switch (choice.what) {
        case "all": made = { ...source, formula }; break;
        case "allExceptBorders": made = { ...source, formula, border: target.border }; break;
        case "formulas": made = { ...target, value: source.value, formula, ...number }; break;
        case "values": made = { ...target, value: source.value, formula: null, ...number }; break;
        case "formats": made = { ...target, ...styleOf(source) }; break;
        case "comments": made = { ...target, comment: source.comment ?? null }; break;
        default: made = target;
      }
      if (choice.operation !== "none" && ["all", "values", "formulas", "allExceptBorders"].includes(choice.what) && typeof source.value === "number" && typeof target.value === "number") {
        const a = target.value, b = source.value;
        made = { ...made, formula: null, value: choice.operation === "add" ? a + b : choice.operation === "subtract" ? a - b : choice.operation === "multiply" ? a * b : b === 0 ? a : a / b };
      }
      next[refAt(row, col)] = made;
    }
    if (choice.what === "columnWidths") { widths = { ...(sheet.colWidths ?? {}) }; for (let j = 0; j <= width; j++) { const from = sheet.colWidths?.[columnLetters(clip.rect.c1 + j)]; const to = columnLetters(Math.min(MAX_COLS - 1, focus.col + j)); if (from === undefined) delete widths[to]; else widths[to] = from; } }
    const op = choice.transpose ? "pasteTranspose" : choice.what === "formulas" ? "pasteFormulas" : choice.what === "values" ? "pasteValues" : choice.what === "formats" ? "pasteFormatting" : choice.what === "allExceptBorders" ? "pasteNoBorders" : "pasteSpecial";
    change(op, { cells: next, ...(widths !== sheet.colWidths ? { sheet: { ...sheet, colWidths: widths } } : {}) });
    closeDialog();
  };
  const pasteAs = (what: PasteSpecialChoice["what"], options: { transpose?: boolean; keepNumberFormat?: boolean } = {}) => { setMenu(null); pasteSpecialApply({ what, operation: "none", skipBlanks: false, transpose: Boolean(options.transpose) }, Boolean(options.keepNumberFormat)); };

  const shiftCells = (choice: ShiftChoice, insert: boolean) => {
    closeDialog();
    if (choice === "entireRow" || choice === "entireColumn") {
      let state = { cells, merges };
      const count = choice === "entireRow" ? selection.r2 - selection.r1 + 1 : selection.c2 - selection.c1 + 1;
      for (let k = 0; k < count; k++) state = choice === "entireRow" ? shiftRows(state.cells, state.merges, selection.r1, insert ? 1 : -1) : shiftColumns(state.cells, state.merges, selection.c1, insert ? 1 : -1);
      change(choice === "entireRow" ? (insert ? "insertRow" : "deleteRow") : (insert ? "insertColumn" : "deleteColumn"), state);
      return;
    }
    const h = selection.r2 - selection.r1 + 1, w = selection.c2 - selection.c1 + 1, next = { ...cells };
    const move = (fromRow: number, fromCol: number, toRow: number, toCol: number) => { const cell = cells[refAt(fromRow, fromCol)]; if (cell && fromRow >= 1 && fromCol >= 0 && fromRow <= MAX_ROWS && fromCol < MAX_COLS) next[refAt(toRow, toCol)] = cell; else delete next[refAt(toRow, toCol)]; };
    if (choice === "shiftRight") for (let row = selection.r1; row <= selection.r2; row++) for (let col = MAX_COLS - 1; col >= selection.c1; col--) { if (col - w >= selection.c1) move(row, col - w, row, col); else delete next[refAt(row, col)]; }
    if (choice === "shiftDown") for (let col = selection.c1; col <= selection.c2; col++) for (let row = MAX_ROWS; row >= selection.r1; row--) { if (row - h >= selection.r1) move(row - h, col, row, col); else delete next[refAt(row, col)]; }
    if (choice === "shiftLeft") for (let row = selection.r1; row <= selection.r2; row++) for (let col = selection.c1; col < MAX_COLS; col++) move(row, col + w, row, col);
    if (choice === "shiftUp") for (let col = selection.c1; col <= selection.c2; col++) for (let row = selection.r1; row <= MAX_ROWS; row++) move(row + h, col, row, col);
    change(insert ? "insertCells" : "deleteCells", { cells: next, merges: unmergeRanges(merges, selection) });
  };

  const fillSeries = (choice: SeriesChoice) => {
    closeDialog();
    const next = { ...cells };
    const lines = choice.direction === "columns" ? Array.from({ length: selection.c2 - selection.c1 + 1 }, (_, i) => selection.c1 + i) : Array.from({ length: selection.r2 - selection.r1 + 1 }, (_, i) => selection.r1 + i);
    for (const line of lines) {
      const startRef = choice.direction === "columns" ? refAt(selection.r1, line) : refAt(line, selection.c1);
      const start = cellOf(cells, startRef).value;
      if (typeof start !== "number") continue;
      const length = choice.direction === "columns" ? selection.r2 - selection.r1 + 1 : selection.c2 - selection.c1 + 1;
      for (let k = 1; k < length; k++) {
        const value = choice.type === "linear" ? start + choice.step * k : start * choice.step ** k;
        if (choice.stop !== null && (choice.step >= 0 ? value > choice.stop : value < choice.stop)) break;
        const ref = choice.direction === "columns" ? refAt(selection.r1 + k, line) : refAt(line, selection.c1 + k);
        next[ref] = { ...cellOf(next, ref), value: Math.round(value * 1e10) / 1e10, formula: null };
      }
    }
    change("fillSeries", { cells: next });
  };
  const clearComments = () => formatSelection({ comment: null }, "clearComments");
  const clearHyperlinks = () => formatSelection({ link: null }, "clearHyperlinks");

  const goToSpecial = (choice: GoToSpecialChoice) => {
    closeDialog();
    const extent = usedExtent(cells, merges, sheet, baseRows, baseCols);
    const area = selection.r1 === selection.r2 && selection.c1 === selection.c2 ? { r1: 1, c1: 0, r2: extent.rows, c2: extent.cols - 1 } : selection;
    const found = rectRefs(area).filter((ref) => {
      const cell = cells[ref]; const at = parseRef(ref)!;
      if (choice === "comments") return Boolean(cell?.comment);
      if (choice === "constants") return Boolean(cell && cell.value !== null && !cell.formula);
      if (choice === "formulas") return Boolean(cell?.formula);
      if (choice === "blanks") return !cell || (cell.value === null && !cell.formula);
      if (choice === "conditional") return (sheet.conditionalFormats ?? []).some((rule) => { const rect = parseRange(rule.range); return rect && rectContains(rect, at.row, at.col); });
      return Boolean(validationFor(ref));
    });
    if (!found.length) { setNotice("No cells were found."); return; }
    const points = found.map((ref) => parseRef(ref)!);
    selectRect({ r1: Math.min(...points.map((p) => p.row)), c1: Math.min(...points.map((p) => p.col)), r2: Math.max(...points.map((p) => p.row)), c2: Math.max(...points.map((p) => p.col)) });
    setNotice(`${found.length} cell${found.length === 1 ? "" : "s"} found: ${found.slice(0, 12).join(", ")}${found.length > 12 ? "…" : ""}`);
  };

  const setHyperlink = (text: string, address: string) => {
    const current = cellOf(cells, activeCellRef);
    change("hyperlink", { cells: { ...cells, [activeCellRef]: { ...current, value: current.formula ? current.value : text.trim() || address, link: address.slice(0, 500), fontColor: current.fontColor ?? "0563C1", underline: true } } });
    closeDialog();
  };
  const removeHyperlink = () => { const current = cellOf(cells, activeCellRef); change("clearHyperlinks", { cells: { ...cells, [activeCellRef]: { ...current, link: null, fontColor: current.fontColor === "0563C1" ? null : current.fontColor, underline: current.fontColor === "0563C1" ? false : current.underline } } }); closeDialog(); };

  const defineName = (name: string, range: string) => { change("defineName", { sheet: { ...sheet, definedNames: { ...(sheet.definedNames ?? {}), [name]: range } } }); closeDialog(); setNotice(`The name ${name} now refers to ${range}. Use it in formulas, e.g. =SUM(${name}).`); };
  const deleteName = (name: string) => { const names = { ...(sheet.definedNames ?? {}) }; delete names[name]; change("defineName", { sheet: { ...sheet, definedNames: names } }); };

  const textToColumns = (delimiters: string[]) => {
    closeDialog();
    if (selection.c1 !== selection.c2) { setNotice("Text to Columns works on one column at a time: select the cells of one column."); return; }
    const pattern = new RegExp(`[${delimiters.map((d) => d.replace(/[\]\\^-]/g, (char) => `\\${char}`)).join("")}]+`);
    const next = { ...cells };
    for (let row = selection.r1; row <= selection.r2; row++) {
      const cell = cellOf(cells, refAt(row, selection.c1));
      if (typeof cell.value !== "string" || cell.formula) continue;
      cell.value.split(pattern).slice(0, MAX_COLS - selection.c1).forEach((part, i) => { const ref = refAt(row, selection.c1 + i); next[ref] = { ...cellOf(next, ref), ...parseEntry(part) }; });
    }
    change("textToColumns", { cells: next });
  };

  const setTabColor = (hex: string | null) => { change("tabColor", { sheet: { ...sheet, tabColor: hex } }); setMenu(null); };
  const toggleLockCell = () => { formatSelection({ locked: active.locked === false ? null : false }, "lockCell"); setMenu(null); };
  const insertPageBreak = () => { if (focus.row < 2) { setNotice("Select a cell below row 1: the page break goes above it."); return; } change("pageBreak", { sheet: { ...sheet, rowBreaks: [...new Set([...(sheet.rowBreaks ?? []), focus.row])].sort((a, b) => a - b) } }); setMenu(null); };
  const removePageBreak = () => { change("pageBreak", { sheet: { ...sheet, rowBreaks: (sheet.rowBreaks ?? []).filter((row) => row !== focus.row) } }); setMenu(null); };
  const resetPageBreaks = () => { change("pageBreak", { sheet: { ...sheet, rowBreaks: [] } }); setMenu(null); };
  const setScaleToFit = (patch: Partial<Pick<SheetSettings, "fitWidth" | "fitHeight" | "scale">>) => change("scaleToFit", { sheet: { ...sheet, ...patch } });
  const setDefaultWidth = (width: number) => { const widths = { ...(sheet.colWidths ?? {}) }; for (let col = 0; col < MAX_COLS; col++) { const letter = columnLetters(col); if (widths[letter] === undefined || widths[letter] === sheet.colWidths?.[letter]) widths[letter] = widths[letter] ?? width; } change("columnWidth", { sheet: { ...sheet, colWidths: widths } }); };

  const nameBoxValue = selection.r1 === selection.r2 && selection.c1 === selection.c2 ? activeRef : (activeMerge && activeMerge.r1 === selection.r1 && activeMerge.c1 === selection.c1 && activeMerge.r2 === selection.r2 && activeMerge.c2 === selection.c2) ? refAt(activeMerge.r1, activeMerge.c1) : rangeString(selection);
  const [nameBox, setNameBox] = useState<string | null>(null);
  const goToName = (text: string) => {
    const named = Object.entries(sheet.definedNames ?? {}).find(([name]) => name.toUpperCase() === text.trim().toUpperCase())?.[1];
    const rect = parseRange(named ?? text.trim());
    if (rect) { selectRect(rect); setNotice(null); } else setNotice("Type a cell, a range such as A27:L27, or a defined name.");
    setNameBox(null); focusGrid();
  };
  const formulaBarValue = sheet.protected && active.hiddenFormula ? "" : (active.formula ?? (active.value == null ? "" : String(active.value)));
  const zoom = sheet.zoom || 100;
  const tallRows = useMemo(() => { const rows = new Map<number, number>(); for (const [ref, cell] of Object.entries(cells)) { if (!cell.rotate || cell.value == null) continue; const row = Number(ref.replace(/^[A-Z]+/, "")); rows.set(row, Math.max(rows.get(row) ?? 20, cell.rotate === 255 ? Math.min(160, 16 * String(cell.value).length) : Math.min(120, 8 + Math.abs(Math.sin((cell.rotate * Math.PI) / 180)) * 7 * String(cell.value).length))); } return rows; }, [cells]);
  const hiddenRowSet = useMemo(() => new Set(sheet.hiddenRows ?? []), [sheet.hiddenRows]);
  const hiddenColSet = useMemo(() => new Set(sheet.hiddenCols ?? []), [sheet.hiddenCols]);
  const rowHidden = (row: number) => hiddenRowSet.has(row) || filteredOut.has(row);
  const rowHeight = (row: number) => { if (rowHidden(row)) return 0; const set = sheet.rowHeights?.[String(row)]; return set !== undefined ? pointsToPx(set) : tallRows.get(row) ?? DEFAULT_ROW_PX; };
  const colPx = (col: number) => { if (hiddenColSet.has(col)) return 0; const set = sheet.colWidths?.[columnLetters(col)]; return set !== undefined ? widthToPx(set) : COL_WIDTH; };
  const headerRowPx = sheet.headings ? 20 : 0, headerColPx = sheet.headings ? ROW_HEADER_WIDTH : 0;
  // Freeze Panes: rows above and columns left of sheet.freeze stay put while the rest scrolls.
  const frozenTop = (row: number) => { let top = headerRowPx; for (let r = 1; r < row; r++) top += rowHeight(r); return top; };
  const frozenLeft = (col: number) => { let left = headerColPx; for (let c = 0; c < col; c++) left += colPx(c); return left; };
  // Keep the active cell in view, as Excel does: after the Name Box (A27:L27 shows A27), Go To, or arrow keys.
  // A new anchor scrolls to the anchor; extending with Shift scrolls to the moving end. Frozen and header areas
  // stay on screen, so they are not counted as visible room.
  const lastScrolled = useRef({ anchor: "", focus: "" });
  useEffect(() => {
    const grid = gridRef.current;
    const anchorKey = `${anchor.row}:${anchor.col}`, focusKey = `${focus.row}:${focus.col}`;
    const target = anchorKey !== lastScrolled.current.anchor ? anchor : focusKey !== lastScrolled.current.focus ? focus : null;
    lastScrolled.current = { anchor: anchorKey, focus: focusKey };
    if (!grid || !target) return;
    const cell = grid.querySelector<HTMLElement>(`[data-ref="${columnLetters(target.col)}${target.row}"]`);
    if (!cell) return;
    const scale = zoom / 100, view = grid.getBoundingClientRect(), box = cell.getBoundingClientRect();
    const frozenRows = freeze && target.row >= freeze.row, frozenCols = freeze && target.col >= freeze.col;
    const top = view.top + (freeze && freeze.row > 1 && frozenRows ? frozenTop(freeze.row) : headerRowPx) * scale;
    const left = view.left + (freeze && freeze.col > 0 && frozenCols ? frozenLeft(freeze.col) : headerColPx) * scale;
    const inFrozenRows = freeze && target.row < freeze.row, inFrozenCols = freeze && target.col < freeze.col;
    if (!inFrozenRows) { if (box.top < top) grid.scrollTop -= top - box.top; else if (box.bottom > view.top + grid.clientHeight) grid.scrollTop += Math.min(box.bottom - (view.top + grid.clientHeight), box.top - top); }
    if (!inFrozenCols) { if (box.left < left) grid.scrollLeft -= left - box.left; else if (box.right > view.left + grid.clientWidth) grid.scrollLeft += Math.min(box.right - (view.left + grid.clientWidth), box.left - left); }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new selection scrolls, not every re-render
  }, [anchor, focus]);
  const cellOrigin = (ref: string) => { const at = parseRef(ref); return at ? { left: frozenLeft(at.col), top: frozenTop(at.row) } : { left: 0, top: 0 }; };

  const off = "Not needed for this test";
  // Fit the ribbon to the screen width, as Excel does on smaller screens (re-measured on resize and tab change).
  const ribbonOuter = useRef<HTMLDivElement>(null);
  const ribbonInner = useRef<HTMLDivElement>(null);
  const [ribbonZoom, setRibbonZoom] = useState(1);
  useLayoutEffect(() => {
    const outer = ribbonOuter.current, inner = ribbonInner.current;
    if (!outer || !inner) return;
    const fit = () => {
      const previous = inner.style.zoom; inner.style.zoom = "1";
      const natural = inner.scrollWidth, room = outer.clientWidth - 8;
      inner.style.zoom = previous;
      const next = natural > room ? Math.max(0.7, Math.floor((room / natural) * 100) / 100) : 1;
      setRibbonZoom((old) => (old === next ? old : next));
    };
    fit();
    const observer = new ResizeObserver(fit); observer.observe(outer);
    return () => observer.disconnect();
  }, [tab]);
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
      <div ref={ribbonOuter} role="toolbar" aria-label="Spreadsheet controls" className="min-h-[98px] overflow-x-auto overflow-y-hidden px-1 pb-0.5 pt-1 [scrollbar-width:thin]">
      <div ref={ribbonInner} className="flex w-max items-stretch" style={{ zoom: ribbonZoom }}>
        {tab === "HOME" && <>
          <Group label="Clipboard">
            <MenuButton id="paste" menu={menu} setMenu={setMenu} label="Paste" icon={<Icon name="paste" big />} big disabled={submitted} onMain={paste}>
              <MenuHeading>Paste</MenuHeading>
              <MenuItem onClick={() => { paste(); setMenu(null); }}>Paste</MenuItem>
              <MenuItem onClick={() => pasteAs("formulas")}>Formulas</MenuItem>
              <MenuItem onClick={() => pasteAs("formulas", { keepNumberFormat: true })}>Formulas &amp; Number Formatting</MenuItem>
              <MenuItem onClick={() => pasteAs("all")}>Keep Source Formatting</MenuItem>
              <MenuItem onClick={() => pasteAs("allExceptBorders")}>No Borders</MenuItem>
              <MenuItem onClick={() => pasteAs("columnWidths")}>Keep Source Column Widths</MenuItem>
              <MenuItem onClick={() => pasteAs("all", { transpose: true })}>Transpose</MenuItem>
              <MenuHeading>Paste Values</MenuHeading>
              <MenuItem onClick={() => pasteAs("values")}>Values</MenuItem>
              <MenuItem onClick={() => pasteAs("values", { keepNumberFormat: true })}>Values &amp; Number Formatting</MenuItem>
              <MenuHeading>Other Paste Options</MenuHeading>
              <MenuItem onClick={() => pasteAs("formats")}>Formatting</MenuItem>
              <MenuSeparator />
              <MenuItem onClick={() => { if (!clip) { setMenu(null); setNotice("Copy cells first (Ctrl+C), then select where to paste."); } else openDialog({ kind: "pasteSpecial" }); }}>Paste Special...</MenuItem>
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
                <span data-xl-menu className="relative flex">
                  <button type="button" disabled={submitted} onMouseDown={(event) => event.preventDefault()} onClick={() => toggleUnderline(active.underlineStyle === "double" ? "double" : "single")} aria-label="Underline (Ctrl+U)" aria-pressed={active.underline} title="Underline (Ctrl+U)"
                    className={`flex h-[22px] min-w-[20px] items-center justify-center border px-1 ${active.underline ? "border-[#2a8dd4] bg-[#cde6f7]" : "border-transparent hover:border-[#c6c6c6] hover:bg-white"} disabled:opacity-40`}><span className="font-serif underline" style={{ textDecorationStyle: active.underlineStyle === "double" ? "double" : "solid" }}>U</span></button>
                  <button type="button" disabled={submitted} onMouseDown={(event) => event.preventDefault()} onClick={() => setMenu(menu === "underline" ? null : "underline")} aria-label="Underline options" aria-expanded={menu === "underline"} className="flex h-[22px] items-center border border-transparent px-0.5 text-[9px] hover:border-[#c6c6c6] hover:bg-white disabled:opacity-40">▾</button>
                  {menu === "underline" && <Menu>
                    <MenuItem checked={active.underline && (active.underlineStyle ?? "single") === "single"} onClick={() => { toggleUnderline("single"); setMenu(null); }}><span className="font-serif underline">U</span>&nbsp; Underline</MenuItem>
                    <MenuItem checked={active.underline && active.underlineStyle === "double"} onClick={() => { toggleUnderline("double"); setMenu(null); }}><span className="font-serif underline" style={{ textDecorationStyle: "double" }}>D</span>&nbsp; Double Underline</MenuItem>
                  </Menu>}
                </span>
                <span className="mx-0.5 h-4 w-px bg-[#c6c6c6]" />
                <MenuButton id="borders" menu={menu} setMenu={setMenu} label="Borders" icon={<Icon name="border" />} disabled={submitted}>
                  <MenuHeading>Borders</MenuHeading>
                  {([["bottom", "Bottom Border"], ["top", "Top Border"], ["left", "Left Border"], ["right", "Right Border"], ["none", "No Border"], ["all", "All Borders"], ["outside", "Outside Borders"], ["thickBox", "Thick Box Border"], ["bottomDouble", "Bottom Double Border"], ["thickBottom", "Thick Bottom Border"], ["topBottom", "Top and Bottom Border"], ["topThickBottom", "Top and Thick Bottom Border"], ["topDoubleBottom", "Top and Double Bottom Border"]] as [BorderStyle, string][]).map(([style, label]) => (
                    <MenuItem key={style} onClick={() => { change("border", { cells: applyBorder(cells, selection, style) }); setMenu(null); }}>{label}</MenuItem>
                  ))}
                  <MenuItem onClick={() => openFormatCells("Border")}>More Borders...</MenuItem>
                </MenuButton>
                <ColorSplit id="fill" label="Fill Color" swatch={lastFill} icon={<Icon name="bucket" />} menu={menu} setMenu={setMenu} disabled={submitted} noneLabel="No Fill" onMore={() => openDialog({ kind: "moreColors", target: "fill" })} onApply={() => formatSelection({ fillColor: lastFill }, "fillColor")} onPick={(hex) => { if (hex) setLastFill(hex); formatSelection({ fillColor: hex }, "fillColor"); }} />
                <ColorSplit id="font" label="Font Color" swatch={lastFont} icon={<span className="font-serif text-[13px] font-bold">A</span>} menu={menu} setMenu={setMenu} disabled={submitted} noneLabel="Automatic" onMore={() => openDialog({ kind: "moreColors", target: "font" })} onApply={() => formatSelection({ fontColor: lastFont }, "fontColor")} onPick={(hex) => { if (hex) setLastFont(hex); formatSelection({ fontColor: hex }, "fontColor"); }} />
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
              <select aria-label="Number Format" value={active.numberFormat ?? "General"} disabled={submitted} onChange={(event) => { if (event.target.value === "more") { openFormatCells("Number"); return; } formatSelection({ numberFormat: event.target.value as SheetCell["numberFormat"] }, "numberFormat"); }} className="h-[22px] w-[128px] border border-[#c6c6c6] bg-white px-1">
                {NUMBER_FORMAT_LABELS.map(([format, label]) => <option key={format} value={format}>{label}</option>)}
                <option value="more">More Number Formats...</option>
              </select>
              <div className="flex items-center gap-0.5">
                <MenuButton id="accounting" menu={menu} setMenu={setMenu} label="Accounting Number Format" icon={<span>₹</span>} disabled={submitted} onMain={() => applyCurrency(active.currency ?? "₹")}>
                  {CURRENCIES.map(([symbol, label]) => <MenuItem key={symbol} checked={active.numberFormat === "Accounting" && (active.currency ?? "₹") === symbol} onClick={() => { applyCurrency(symbol); setMenu(null); }}>{label}</MenuItem>)}
                  <MenuSeparator /><MenuItem onClick={() => openFormatCells("Number")}>More Accounting Formats...</MenuItem>
                </MenuButton>
                <Small label="Percent Style" icon={<span>%</span>} onClick={() => formatSelection({ numberFormat: "Percentage", decimals: 0 }, "numberFormat")} disabled={submitted} />
                <Small label="Comma Style" icon={<span className="font-bold">,</span>} onClick={() => formatSelection({ numberFormat: "Number", decimals: 2 }, "numberFormat")} disabled={submitted} />
                <Small label="Increase Decimal" icon={<span className="text-[9px] leading-none">←.0<br />.00</span>} onClick={() => changeDecimals(1)} disabled={submitted} />
                <Small label="Decrease Decimal" icon={<span className="text-[9px] leading-none">.00<br />→.0</span>} onClick={() => changeDecimals(-1)} disabled={submitted} />
              </div>
            </div>
          </Group>
          <Group label="Styles">
            <MenuButton id="conditional" menu={menu} setMenu={setMenu} label="Conditional Formatting" icon={<Icon name="conditional" big />} big disabled={submitted}>
              <MenuHeading>Highlight Cells Rules</MenuHeading>
              {HIGHLIGHT_RULES.map(([type, label]) => <MenuItem key={type} onClick={() => openDialog({ kind: "conditional", type })}>{label}</MenuItem>)}
              <MenuHeading>Top/Bottom Rules</MenuHeading>
              {([["top", "Top 10 Items..."], ["topPercent", "Top 10%..."], ["bottom", "Bottom 10 Items..."], ["bottomPercent", "Bottom 10%..."], ["aboveAverage", "Above Average..."], ["belowAverage", "Below Average..."]] as [ConditionalType, string][]).map(([type, label]) => <MenuItem key={type} onClick={() => openDialog({ kind: "conditional", type })}>{label}</MenuItem>)}
              <MenuHeading>Data Bars</MenuHeading>
              <div className="flex gap-1 px-3 py-1">{(["blueBar", "greenBar", "redBar", "orangeBar"] as const).map((style) => <button key={style} type="button" role="menuitem" aria-label={CONDITIONAL_STYLES[style].label} title={CONDITIONAL_STYLES[style].label} onMouseDown={(event) => event.preventDefault()} onClick={() => { addConditional({ type: "dataBar", style }); setMenu(null); }} className="grid h-7 w-7 content-center gap-0.5 border border-[#c6c6c6] p-0.5 hover:border-[#2a8dd4]">{[90, 60, 30].map((w) => <span key={w} className="block h-1.5" style={{ width: `${w}%`, background: `#${CONDITIONAL_STYLES[style].bar}` }} />)}</button>)}</div>
              <MenuHeading>Color Scales</MenuHeading>
              <div className="flex gap-1 px-3 py-1">{(["greenYellowRed", "redYellowGreen", "greenWhite", "redWhite"] as const).map((style) => <button key={style} type="button" role="menuitem" aria-label={CONDITIONAL_STYLES[style].label} title={CONDITIONAL_STYLES[style].label} onMouseDown={(event) => event.preventDefault()} onClick={() => { addConditional({ type: "colorScale", style }); setMenu(null); }} className="h-7 w-7 border border-[#c6c6c6] hover:border-[#2a8dd4]" style={{ background: `linear-gradient(${[...(CONDITIONAL_STYLES[style].scale ?? [])].reverse().map((c) => `#${c}`).join(",")})` }} />)}</div>
              <MenuHeading>Icon Sets</MenuHeading>
              {(["arrows3", "trafficLights3"] as const).map((style) => <MenuItem key={style} onClick={() => { addConditional({ type: "iconSet", style }); setMenu(null); }}>{CONDITIONAL_STYLES[style].label}</MenuItem>)}
              <MenuSeparator />
              <MenuItem onClick={() => openDialog({ kind: "conditional", type: "greaterThan" })}>New Rule...</MenuItem>
              <MenuItem onClick={() => { clearConditional(false); setMenu(null); }}>Clear Rules from Selected Cells</MenuItem>
              <MenuItem onClick={() => { clearConditional(true); setMenu(null); }}>Clear Rules from Entire Sheet</MenuItem>
              <MenuItem onClick={() => openDialog({ kind: "manageRules" })}>Manage Rules...</MenuItem>
            </MenuButton>
            <MenuButton id="formatTable" menu={menu} setMenu={setMenu} label="Format as Table" icon={<Icon name="table" big />} big disabled={submitted}>
              {TABLE_STYLES.map((style) => <MenuItem key={style[0]} onClick={() => { formatAsTable(style); setMenu(null); }}><span className="mr-2 inline-flex h-3 w-6 border border-slate-300" style={{ background: `linear-gradient(#${style[1]} 40%, #${style[3]} 40%)` }} />{style[0]}</MenuItem>)}
            </MenuButton>
            <MenuButton id="cellStyles" menu={menu} setMenu={setMenu} label="Cell Styles" icon={<Icon name="cellStyles" big />} big disabled={submitted}>
              {CELL_STYLES.map(([name, patch]) => <MenuItem key={name} onClick={() => { formatSelection(patch, "cellStyle"); setMenu(null); }}>{name}</MenuItem>)}
            </MenuButton>
          </Group>
          <Group label="Cells">
            <MenuButton id="insert" menu={menu} setMenu={setMenu} label="Insert" icon={<Icon name="insertCells" big />} big disabled={submitted}>
              <MenuItem onClick={() => openDialog({ kind: "insertCells" })}>Insert Cells...</MenuItem>
              <MenuItem onClick={() => { insertRow(); setMenu(null); }}>Insert Sheet Rows</MenuItem>
              <MenuItem onClick={() => { insertColumn(); setMenu(null); }}>Insert Sheet Columns</MenuItem>
              <MenuItem onClick={() => { setMenu(null); setNotice("This test uses one worksheet: inserting another sheet is not needed."); }}>Insert Sheet</MenuItem>
            </MenuButton>
            <MenuButton id="delete" menu={menu} setMenu={setMenu} label="Delete" icon={<Icon name="deleteCells" big />} big disabled={submitted}>
              <MenuItem onClick={() => openDialog({ kind: "deleteCells" })}>Delete Cells...</MenuItem>
              <MenuItem onClick={() => { deleteRow(); setMenu(null); }}>Delete Sheet Rows</MenuItem>
              <MenuItem onClick={() => { deleteColumn(); setMenu(null); }}>Delete Sheet Columns</MenuItem>
              <MenuItem onClick={() => { setMenu(null); setNotice("This test uses one worksheet, which cannot be deleted."); }}>Delete Sheet</MenuItem>
            </MenuButton>
            <MenuButton id="format" menu={menu} setMenu={setMenu} label="Format" icon={<Icon name="formatCells" big />} big disabled={submitted}>
              <MenuHeading>Cell Size</MenuHeading>
              <MenuItem onClick={() => openDialog({ kind: "input", purpose: "rowHeight" })}>Row Height...</MenuItem>
              <MenuItem onClick={() => { setRowHeight(null); setMenu(null); }}>AutoFit Row Height</MenuItem>
              <MenuItem onClick={() => openDialog({ kind: "input", purpose: "columnWidth" })}>Column Width...</MenuItem>
              <MenuItem onClick={() => { autoFitColumns(); setMenu(null); }}>AutoFit Column Width</MenuItem>
              <MenuItem onClick={() => openDialog({ kind: "input", purpose: "defaultWidth" })}>Default Width...</MenuItem>
              <MenuHeading>Visibility</MenuHeading>
              <MenuItem onClick={() => { hideRows(true); setMenu(null); }}>Hide Rows</MenuItem>
              <MenuItem onClick={() => { hideColumns(true); setMenu(null); }}>Hide Columns</MenuItem>
              <MenuItem onClick={() => { hideRows(false); setMenu(null); }}>Unhide Rows</MenuItem>
              <MenuItem onClick={() => { hideColumns(false); setMenu(null); }}>Unhide Columns</MenuItem>
              <MenuHeading>Organize Sheets</MenuHeading>
              <MenuItem onClick={() => { setMenu(null); setRenamingSheet(sheetName); }}>Rename Sheet</MenuItem>
              <MenuItem onClick={() => { setMenu(null); setNotice("This test uses one worksheet: Move or Copy Sheet is not needed."); }}>Move or Copy Sheet...</MenuItem>
              <div className="px-3 py-1"><p className="mb-1 text-[11px] text-[#444]">Tab Color</p><div className="grid grid-cols-10 gap-0.5">{STANDARD_COLORS.map(([hex, name]) => <button key={hex} type="button" role="menuitem" aria-label={`Tab Color ${name}`} title={name} onMouseDown={(event) => event.preventDefault()} onClick={() => setTabColor(hex)} className="h-4 w-4 border border-slate-200" style={{ backgroundColor: `#${hex}` }} />)}</div>
                <button type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => setTabColor(null)} className="mt-1 w-full text-left text-[12px] hover:bg-[#d5e1f2]">No Color</button>
                <button type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => openDialog({ kind: "moreColors", target: "tab" })} className="w-full text-left text-[12px] hover:bg-[#d5e1f2]">More Colors...</button></div>
              <MenuHeading>Protection</MenuHeading>
              <MenuItem onClick={() => openDialog({ kind: "input", purpose: sheet.protected ? "unprotect" : "protect" })}>{sheet.protected ? "Unprotect Sheet..." : "Protect Sheet..."}</MenuItem>
              <MenuItem checked={active.locked !== false} onClick={toggleLockCell}>Lock Cell</MenuItem>
              <MenuSeparator />
              <MenuItem onClick={() => openFormatCells("Number")}>Format Cells...</MenuItem>
            </MenuButton>
          </Group>
          <Group label="Editing">
            <div className="flex flex-col gap-0.5">
              <MenuButton id="autosum" menu={menu} setMenu={setMenu} label="AutoSum" icon={<span className="flex items-center gap-1"><span className="text-[14px] font-bold">Σ</span>AutoSum</span>} disabled={submitted} onMain={() => autoSum("SUM")}>
                {["SUM", "AVERAGE", "COUNT", "MAX", "MIN"].map((fn) => <MenuItem key={fn} onClick={() => { autoSum(fn); setMenu(null); }}>{fn === "SUM" ? "Sum" : fn === "AVERAGE" ? "Average" : fn === "COUNT" ? "Count Numbers" : fn === "MAX" ? "Max" : "Min"}</MenuItem>)}
                <MenuItem onClick={() => openDialog({ kind: "insertFunction" })}>More Functions...</MenuItem>
              </MenuButton>
              <MenuButton id="fill-range" menu={menu} setMenu={setMenu} label="Fill" icon={<span className="flex items-center gap-1"><span className="text-[#2a6bd4]">⬇</span>Fill</span>} disabled={submitted}>
                <MenuItem onClick={() => { fillRange("down"); setMenu(null); }}>Down</MenuItem>
                <MenuItem onClick={() => { fillRange("right"); setMenu(null); }}>Right</MenuItem>
                <MenuItem onClick={() => { fillRange("up"); setMenu(null); }}>Up</MenuItem>
                <MenuItem onClick={() => { fillRange("left"); setMenu(null); }}>Left</MenuItem>
                <MenuItem onClick={() => openDialog({ kind: "series" })}>Series...</MenuItem>
              </MenuButton>
              <MenuButton id="clear" menu={menu} setMenu={setMenu} label="Clear" icon={<span className="flex items-center gap-1"><span className="text-[#d24726]">⌫</span>Clear</span>} disabled={submitted}>
                <MenuItem onClick={() => { clearAll(); setMenu(null); }}>Clear All</MenuItem>
                <MenuItem onClick={() => { clearFormats(); setMenu(null); }}>Clear Formats</MenuItem>
                <MenuItem onClick={() => { clearContents(); setMenu(null); }}>Clear Contents</MenuItem>
                <MenuItem onClick={() => { clearComments(); setMenu(null); }}>Clear Comments</MenuItem>
                <MenuItem onClick={() => { clearHyperlinks(); setMenu(null); }}>Clear Hyperlinks</MenuItem>
              </MenuButton>
            </div>
            <MenuButton id="sort" menu={menu} setMenu={setMenu} label="Sort & Filter" icon={<Icon name="sort" big />} big disabled={submitted}>
              <MenuItem onClick={() => { sortSelection("asc"); setMenu(null); }}>Sort A to Z</MenuItem>
              <MenuItem onClick={() => { sortSelection("desc"); setMenu(null); }}>Sort Z to A</MenuItem>
              <MenuItem onClick={() => openSort()}>Custom Sort...</MenuItem>
              <MenuSeparator />
              <MenuItem checked={Boolean(sheet.filter)} onClick={() => { toggleFilter(); setMenu(null); }}>Filter</MenuItem>
              <MenuItem onClick={() => { if (sheet.filter) change("filterValues", { sheet: { ...sheet, filterHidden: {} } }); setMenu(null); }}>Clear</MenuItem>
              <MenuItem onClick={() => { if (sheet.filter) change("filterValues", { sheet: { ...sheet, filterHidden: { ...(sheet.filterHidden ?? {}) } } }); setMenu(null); }}>Reapply</MenuItem>
            </MenuButton>
            <MenuButton id="find" menu={menu} setMenu={setMenu} label="Find & Select" icon={<Icon name="find" big />} big>
              <MenuItem onClick={() => openDialog({ kind: "find", tab: "Find" })}>Find...</MenuItem>
              <MenuItem onClick={() => openDialog({ kind: "find", tab: "Replace" })}>Replace...</MenuItem>
              <MenuItem onClick={() => { setMenu(null); setNameBox(nameBoxValue); requestAnimationFrame(() => document.querySelector<HTMLInputElement>('input[aria-label="Name Box"]')?.select()); }}>Go To...</MenuItem>
              <MenuItem onClick={() => openDialog({ kind: "goToSpecial" })}>Go To Special...</MenuItem>
              <MenuSeparator />
              <MenuItem onClick={() => { setMenu(null); goToSpecial("formulas"); }}>Formulas</MenuItem>
              <MenuItem onClick={() => { setMenu(null); goToSpecial("comments"); }}>Comments</MenuItem>
              <MenuItem onClick={() => { setMenu(null); goToSpecial("conditional"); }}>Conditional Formatting</MenuItem>
              <MenuItem onClick={() => { setMenu(null); goToSpecial("constants"); }}>Constants</MenuItem>
              <MenuItem onClick={() => { setMenu(null); goToSpecial("validation"); }}>Data Validation</MenuItem>
            </MenuButton>
          </Group>
        </>}
        {tab === "INSERT" && <>
          <Group label="Tables"><Big label="PivotTable" icon={<Icon name="table" big />} disabled title={off} /><Big label="Recommended PivotTables" icon={<Icon name="table" big />} disabled title={off} /><Big label="Table" icon={<Icon name="table" big />} disabled title={off} /></Group>
          <Group label="Illustrations"><Big label="Pictures" icon="🖼" disabled title={off} /><Big label="Online Pictures" icon="🌐" disabled title={off} /><div className="flex flex-col gap-0.5"><Small label="Shapes" icon="◇" showLabel onClick={() => undefined} disabled /><Small label="SmartArt" icon="▣" showLabel onClick={() => undefined} disabled /><Small label="Screenshot" icon="📷" showLabel onClick={() => undefined} disabled /></div></Group>
          <Group label="Charts">
            <Big label="Recommended Charts" icon={<ChartIcon type="column" />} onClick={() => insertChart("column")} disabled={submitted} />
            <div className="grid grid-cols-2 gap-0.5">
              <MenuButton id="chart-column" menu={menu} setMenu={setMenu} label="Insert Column Chart" icon={<ChartIcon type="column" small />} disabled={submitted}>
                <MenuHeading>2-D Column</MenuHeading><MenuItem onClick={() => { insertChart("column"); setMenu(null); }}>Clustered Column</MenuItem>
              </MenuButton>
              <MenuButton id="chart-bar" menu={menu} setMenu={setMenu} label="Insert Bar Chart" icon={<ChartIcon type="bar" small />} disabled={submitted}>
                <MenuHeading>2-D Bar</MenuHeading><MenuItem onClick={() => { insertChart("bar"); setMenu(null); }}>Clustered Bar</MenuItem>
              </MenuButton>
              <MenuButton id="chart-line" menu={menu} setMenu={setMenu} label="Insert Line Chart" icon={<ChartIcon type="line" small />} disabled={submitted}>
                <MenuHeading>2-D Line</MenuHeading><MenuItem onClick={() => { insertChart("line"); setMenu(null); }}>Line with Markers</MenuItem>
              </MenuButton>
              <MenuButton id="chart-pie" menu={menu} setMenu={setMenu} label="Insert Pie or Doughnut Chart" icon={<ChartIcon type="pie" small />} disabled={submitted}>
                <MenuHeading>2-D Pie</MenuHeading><MenuItem onClick={() => { insertChart("pie"); setMenu(null); }}>Pie</MenuItem>
              </MenuButton>
            </div>
            <Big label="PivotChart" icon="📈" disabled title={off} />
          </Group>
          <Group label="Sparklines"><Big label="Line" icon="〰" disabled title={off} /><Big label="Column" icon="▮" disabled title={off} /><Big label="Win/ Loss" icon="▚" disabled title={off} /></Group>
          <Group label="Links"><Big label="Hyperlink" icon="🔗" onClick={() => openDialog({ kind: "hyperlink" })} disabled={submitted} /></Group>
          <Group label="Text">
            <Big label="Text Box" icon={<Icon name="textBox" big />} disabled title={off} />
            <Big label="Header & Footer" icon={<Icon name="headerFooter" big />} onClick={() => setHeaderDialog(true)} disabled={submitted} />
            <div className="flex flex-col gap-0.5"><Small label="WordArt" icon="A" showLabel onClick={() => undefined} disabled /><Small label="Signature Line" icon="✎" showLabel onClick={() => undefined} disabled /><Small label="Object" icon="▢" showLabel onClick={() => undefined} disabled /></div>
          </Group>
          <Group label="Symbols"><div className="flex flex-col gap-0.5"><Small label="Equation" icon="π" showLabel onClick={() => undefined} disabled /><Small label="Symbol" icon="Ω" showLabel onClick={() => openDialog({ kind: "symbol" })} disabled={submitted} /></div></Group>
        </>}
        {tab === "PAGE LAYOUT" && <>
          <Group label="Themes"><Big label="Themes" icon="Aa" disabled title={off} /></Group>
          <Group label="Page Setup" launcher={() => openDialog({ kind: "pageSetup", tab: "Page" })} launcherLabel="Page Setup">
            <MenuButton id="margins" menu={menu} setMenu={setMenu} label="Margins" icon={<Icon name="margins" big />} big disabled={submitted}>
              {(["Normal", "Wide", "Narrow"] as const).map((value) => <MenuItem key={value} checked={sheet.margins === value} onClick={() => { setSheetOption("margins", value, "margins"); setMenu(null); }}>{value}</MenuItem>)}
              <MenuSeparator /><MenuItem onClick={() => openDialog({ kind: "pageSetup", tab: "Margins" })}>Custom Margins...</MenuItem>
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
            <MenuButton id="breaks" menu={menu} setMenu={setMenu} label="Breaks" icon={<span className="text-[20px]">⤓</span>} big disabled={submitted}>
              <MenuItem onClick={insertPageBreak}>Insert Page Break</MenuItem>
              <MenuItem onClick={removePageBreak}>Remove Page Break</MenuItem>
              <MenuItem onClick={resetPageBreaks}>Reset All Page Breaks</MenuItem>
            </MenuButton><Big label="Background" icon="🏞" disabled title={off} /><Big label="Print Titles" icon="🖨" onClick={() => openDialog({ kind: "pageSetup", tab: "Sheet" })} disabled={submitted} />
          </Group>
          <Group label="Scale to Fit" launcher={() => openDialog({ kind: "pageSetup", tab: "Page" })} launcherLabel="Page Setup: Scale to Fit">
            <div className="grid grid-cols-[52px_92px] items-center gap-x-1 gap-y-0.5">
              <label htmlFor="xl-fit-width">Width:</label>
              <select id="xl-fit-width" aria-label="Scale to Fit Width" disabled={submitted} value={sheet.fitWidth ?? 0} onChange={(event) => { const pages = Number(event.target.value) || null; setScaleToFit({ fitWidth: pages, scale: pages || sheet.fitHeight ? null : sheet.scale ?? null }); }} className="h-[20px] border border-[#c6c6c6] bg-white">{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((pages) => <option key={pages} value={pages}>{pages ? `${pages} page${pages > 1 ? "s" : ""}` : "Automatic"}</option>)}</select>
              <label htmlFor="xl-fit-height">Height:</label>
              <select id="xl-fit-height" aria-label="Scale to Fit Height" disabled={submitted} value={sheet.fitHeight ?? 0} onChange={(event) => { const pages = Number(event.target.value) || null; setScaleToFit({ fitHeight: pages, scale: pages || sheet.fitWidth ? null : sheet.scale ?? null }); }} className="h-[20px] border border-[#c6c6c6] bg-white">{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((pages) => <option key={pages} value={pages}>{pages ? `${pages} page${pages > 1 ? "s" : ""}` : "Automatic"}</option>)}</select>
              <label htmlFor="xl-scale">Scale:</label>
              <input id="xl-scale" aria-label="Scale" type="number" min={10} max={400} step={5} disabled={submitted || Boolean(sheet.fitWidth || sheet.fitHeight)} value={sheet.scale ?? 100} onChange={(event) => { const value = Number(event.target.value); if (value >= 10 && value <= 400) setScaleToFit({ scale: value === 100 ? null : value }); }} className="h-[20px] w-16 border border-[#c6c6c6] bg-white px-1 disabled:text-slate-400" />
            </div>
          </Group>
          <Group label="Sheet Options" launcher={() => openDialog({ kind: "pageSetup", tab: "Sheet" })} launcherLabel="Page Setup: Sheet">
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
            <Big label="Insert Function" icon={<span className="font-serif italic">fx</span>} onClick={() => openDialog({ kind: "insertFunction" })} disabled={submitted} />
            <MenuButton id="fx-autosum" menu={menu} setMenu={setMenu} label="AutoSum" icon={<span className="text-[22px] font-bold leading-none">Σ</span>} big disabled={submitted} onMain={() => autoSum("SUM")}>
              {["SUM", "AVERAGE", "COUNT", "MAX", "MIN"].map((fn) => <MenuItem key={fn} onClick={() => { autoSum(fn); setMenu(null); }}>{fn === "SUM" ? "Sum" : fn === "AVERAGE" ? "Average" : fn === "COUNT" ? "Count Numbers" : fn === "MAX" ? "Max" : "Min"}</MenuItem>)}
            </MenuButton>
            <MenuButton id="fx-recent" menu={menu} setMenu={setMenu} label="Recently Used" icon={<Icon name="fnBook" big />} big disabled={submitted}>
              {["SUM", "AVERAGE", "IF", "COUNT", "MAX", "MIN", "COUNTIF", "VLOOKUP", "ROUND", "SUMIF"].map((name) => <MenuItem key={name} onClick={() => insertFunction(name)}>{name}</MenuItem>)}
              <MenuSeparator /><MenuItem onClick={() => openDialog({ kind: "insertFunction" })}>Insert Function...</MenuItem>
            </MenuButton>
            {FUNCTION_MENUS.map(([label, category]) => (
              <MenuButton key={label} id={`fx-${category}`} menu={menu} setMenu={setMenu} label={label} icon={<Icon name="fnBook" big />} big disabled={submitted}>
                {FUNCTION_LIBRARY.filter((fn) => fn.category === category).map((fn) => <MenuItem key={fn.name} onClick={() => insertFunction(fn.name)}>{fn.name}</MenuItem>)}
                <MenuSeparator /><MenuItem onClick={() => openDialog({ kind: "insertFunction", category })}>Insert Function...</MenuItem>
              </MenuButton>
            ))}
            <MenuButton id="fx-more" menu={menu} setMenu={setMenu} label="More Functions" icon={<Icon name="fnBook" big />} big disabled={submitted}>
              <MenuHeading>Statistical</MenuHeading>
              {FUNCTION_LIBRARY.filter((fn) => fn.category === "Statistical").map((fn) => <MenuItem key={fn.name} onClick={() => insertFunction(fn.name)}>{fn.name}</MenuItem>)}
            </MenuButton>
          </Group>
          <Group label="Defined Names">
            <Big label="Name Manager" icon="🏷" onClick={() => openDialog({ kind: "nameManager" })} disabled={submitted} />
            <div className="flex flex-col gap-0.5">
              <Small label="Define Name" icon="🏷" showLabel onClick={() => openDialog({ kind: "defineName" })} disabled={submitted} />
              <MenuButton id="useInFormula" menu={menu} setMenu={setMenu} label="Use in Formula" icon={<span className="flex items-center gap-1">ƒ Use in Formula</span>} disabled={submitted}>
                {Object.keys(sheet.definedNames ?? {}).map((name) => <MenuItem key={name} onClick={() => { setMenu(null); if (editing) editText.set(`${editText.get()}${name}`); else beginEdit(`=${name}`); }}>{name}</MenuItem>)}
                {!Object.keys(sheet.definedNames ?? {}).length && <p className="px-3 py-1 text-[#777]">No names defined yet</p>}
              </MenuButton>
            </div>
          </Group>
          <Group label="Formula Auditing">
            <div className="flex flex-col gap-0.5">
              <Small label="Show Formulas" icon={<Icon name="showFormulas" />} showLabel active={showFormulas} onClick={() => setShowFormulas((value) => !value)} />
              <Small label="Error Checking" icon="⚠" showLabel onClick={() => undefined} disabled />
            </div>
          </Group>
        </>}
        {tab === "DATA" && <>
          <Group label="Get External Data"><Big label="From Access" icon="🗄" disabled title={off} /><Big label="From Web" icon="🌐" disabled title={off} /><Big label="From Text" icon="🗎" disabled title={off} /></Group>
          <Group label="Sort & Filter">
            <div className="flex flex-col gap-0.5"><Small label="Sort A to Z" icon="A↓Z" onClick={() => sortSelection("asc")} disabled={submitted} /><Small label="Sort Z to A" icon="Z↓A" onClick={() => sortSelection("desc")} disabled={submitted} /></div>
            <Big label="Sort" icon={<Icon name="sort" big />} onClick={() => openSort()} disabled={submitted} />
            <Big label="Filter" icon={<Icon name="filter" big />} active={Boolean(sheet.filter)} onClick={toggleFilter} disabled={submitted} />
            <div className="flex flex-col gap-0.5"><Small label="Clear" icon="✕" showLabel onClick={() => change("filterValues", { sheet: { ...sheet, filterHidden: {} } })} disabled={submitted || !sheet.filter || !Object.keys(sheet.filterHidden ?? {}).length} /></div>
          </Group>
          <Group label="Data Tools"><Big label="Text to Columns" icon="⫼" onClick={() => openDialog({ kind: "textToColumns" })} disabled={submitted} /><Big label="Data Validation" icon="☑" onClick={() => openDialog({ kind: "validation" })} disabled={submitted} /><Big label="Remove Duplicates" icon={<Icon name="dedupe" big />} onClick={removeDuplicates} disabled={submitted} /></Group>
        </>}
        {tab === "REVIEW" && <>
          <Group label="Proofing"><Big label="Spelling" icon="ABC✓" disabled title={off} /><Big label="Thesaurus" icon="📖" disabled title={off} /></Group>
          <Group label="Comments">
            <Big label={active.comment ? "Edit Comment" : "New Comment"} icon={<Icon name="comment" big />} onClick={() => openDialog({ kind: "input", purpose: "comment" })} disabled={submitted} />
            <Big label="Delete" icon={<Icon name="commentDelete" big />} onClick={deleteComment} disabled={submitted || !active.comment} />
            <Big label="Previous" icon="◀💬" onClick={() => gotoComment(-1)} />
            <Big label="Next" icon="💬▶" onClick={() => gotoComment(1)} />
            <div className="flex flex-col gap-0.5"><Small label="Show All Comments" icon="💬" showLabel active={showComments} onClick={() => setShowComments((value) => !value)} /></div>
          </Group>
          <Group label="Changes">
            <Big label={sheet.protected ? "Unprotect Sheet" : "Protect Sheet"} icon={<Icon name="lock" big />} active={Boolean(sheet.protected)} onClick={() => openDialog({ kind: "input", purpose: sheet.protected ? "unprotect" : "protect" })} disabled={submitted} />
            <Big label="Protect Workbook" icon={<Icon name="lock" big />} disabled title={off} />
          </Group>
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
            <Big label="Zoom" icon="🔍" onClick={() => openDialog({ kind: "zoom" })} />
            <Big label="100%" icon={<span className="text-[13px] font-bold">100</span>} onClick={() => setSheet((s) => ({ ...s, zoom: 100 }))} />
            <Big label="Zoom to Selection" icon="⤢" onClick={zoomToSelection} />
          </Group>
          <Group label="Window">
            <Big label="New Window" icon="🗗" disabled title={off} /><Big label="Arrange All" icon="⊞" disabled title={off} />
            <MenuButton id="freeze" menu={menu} setMenu={setMenu} label="Freeze Panes" icon={<Icon name="freeze" big />} big disabled={submitted}>
              {freeze ? <MenuItem onClick={() => freezeAt(null, "unfreezePanes")}>Unfreeze Panes</MenuItem> : <MenuItem onClick={() => freezeAt(refAt(Math.max(1, focus.row), focus.col) === "A1" ? "A2" : refAt(focus.row, focus.col), "freezePanes")}>Freeze Panes</MenuItem>}
              <MenuItem checked={sheet.freeze === "A2"} onClick={() => freezeAt("A2", "freezePanes")}>Freeze Top Row</MenuItem>
              <MenuItem checked={sheet.freeze === "B1"} onClick={() => freezeAt("B1", "freezePanes")}>Freeze First Column</MenuItem>
            </MenuButton>
          </Group>
        </>}
      </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {finalSubmitting && <div role="status" aria-live="assertive" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
          <span className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-cyan-100 text-3xl" aria-hidden>⏳</span>
          <h2 className="mt-5 text-2xl font-black text-slate-900">{mode === "authoring" ? "Saving your answer…" : "Submitting your sheet…"}</h2>
          <p className="mt-3 leading-7 text-slate-600">Please don&apos;t close this page or click Submit again. This can take a few moments -- your sheet is safe.</p>
        </div>
      </div>}
      {ribbon}
      {questionBar}
      {sheet.formulaBar && <div className="flex items-center gap-2 border-b border-slate-300 bg-white px-2 py-1">
        <input aria-label="Name Box" value={nameBox ?? nameBoxValue} onFocus={(event) => { setNameBox(nameBoxValue); selectAllOnFocus.onFocus(event); }} onMouseUp={selectAllOnFocus.onMouseUp} onChange={(event) => setNameBox(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === "Enter") goToName(nameBox ?? ""); if (event.key === "Escape") { setNameBox(null); focusGrid(); } }} onBlur={() => setNameBox(null)} className="h-6 w-24 shrink-0 rounded-sm border border-slate-300 px-1 text-[12px]" />
        <button type="button" aria-label="Insert Function" title="Insert Function" disabled={submitted} onMouseDown={(event) => event.preventDefault()} onClick={() => openDialog({ kind: "insertFunction" })} className="px-1 font-serif text-[13px] italic text-slate-500 hover:bg-slate-100 disabled:opacity-50">fx</button>
        <StoreInput store={editText} live={Boolean(editing)} fallback={formulaBarValue} aria-label="Formula bar" disabled={submitted}
          onFocus={() => { if (!editing) beginEdit(undefined, true); }}
          onText={(value) => { editText.set(value); if (!editing?.fromBar) setEditing((current) => ({ ref: current?.ref ?? activeCellRef, fromBar: true })); }}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitEdit("down"); } else if (event.key === "Escape") cancelEdit(); }}
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
        <div className="relative" style={{ zoom: zoom / 100 } as CSSProperties}>
          <table className="border-separate border-spacing-0 text-[13px]" style={{ tableLayout: "fixed", fontFamily: DEFAULT_FONT, width: headerColPx + Array.from({ length: displayCols }, (_, col) => colPx(col)).reduce((a, b) => a + b, 0) }}>
            <colgroup>{sheet.headings && <col style={{ width: ROW_HEADER_WIDTH }} />}{Array.from({ length: displayCols }, (_, col) => <col key={col} style={{ width: colPx(col) }} />)}</colgroup>
            {sheet.headings && <thead>
              <tr>
                <th onMouseDown={(event) => { event.preventDefault(); selectRect({ r1: 1, c1: 0, r2: displayRows, c2: displayCols - 1 }); focusGrid(); }} className="sticky left-0 top-0 z-30 h-5 border-b border-r border-slate-300 bg-[#e6e6e6]" aria-label="Select all" />
                {Array.from({ length: displayCols }, (_, col) => (
                  <th key={col} scope="col" onMouseDown={(event) => { event.preventDefault(); if (event.button === 2 && col >= selection.c1 && col <= selection.c2 && wholeCols) return; if (event.shiftKey) setFocus({ row: displayRows, col }); else { setAnchor({ row: 1, col }); setFocus({ row: displayRows, col }); } focusGrid(); }}
                    onContextMenu={(event) => { event.preventDefault(); if (!(col >= selection.c1 && col <= selection.c2 && wholeCols)) { setAnchor({ row: 1, col }); setFocus({ row: displayRows, col }); } setMenu(null); setContextMenu({ x: event.clientX, y: event.clientY }); }}
                    style={{ left: freeze && col < freeze.col ? frozenLeft(col) : undefined, padding: hiddenColSet.has(col) ? 0 : undefined }}
                    className={`sticky top-0 h-5 overflow-hidden border-b border-r border-slate-300 text-[11px] font-normal ${freeze && col < freeze.col ? "z-[25]" : "z-20"} ${col >= selection.c1 && col <= selection.c2 ? "bg-[#d3d3d3] text-[#217346]" : "bg-[#f3f3f3] text-slate-600"}`}>{hiddenColSet.has(col) ? "" : columnLetters(col)}</th>
                ))}
              </tr>
            </thead>}
            <tbody>
              {Array.from({ length: displayRows }, (_, index) => {
                const row = index + 1;
                const hidden = rowHidden(row);
                const frozenRow = Boolean(freeze && row < freeze.row);
                return (
                  <tr key={row} style={hidden ? { display: "none" } : undefined}>
                    {sheet.headings && <th scope="row" onMouseDown={(event) => { event.preventDefault(); if (event.button === 2 && row >= selection.r1 && row <= selection.r2 && wholeRows) return; if (event.shiftKey) setFocus({ row, col: displayCols - 1 }); else { setAnchor({ row, col: 0 }); setFocus({ row, col: displayCols - 1 }); } focusGrid(); }}
                      onContextMenu={(event) => { event.preventDefault(); if (!(row >= selection.r1 && row <= selection.r2 && wholeRows)) { setAnchor({ row, col: 0 }); setFocus({ row, col: displayCols - 1 }); } setMenu(null); setContextMenu({ x: event.clientX, y: event.clientY }); }}
                      style={{ top: frozenRow ? frozenTop(row) : undefined, height: rowHeight(row) }}
                      className={`sticky left-0 border-b border-r border-slate-300 px-1 text-right text-[11px] font-normal ${frozenRow ? "z-[25]" : "z-10"} ${row >= selection.r1 && row <= selection.r2 ? "bg-[#d3d3d3] text-[#217346]" : "bg-[#f3f3f3] text-slate-600"} ${filteredOut.size && filterRect && row > filterRect.r1 && row <= filterRect.r2 ? "!text-[#0070c0]" : ""}`}>{row}</th>}
                    {Array.from({ length: displayCols }, (_, col) => {
                      const merged = mergeAt(merges, row, col);
                      if (merged && (merged.r1 !== row || merged.c1 !== col)) return null;
                      const ref = refAt(row, col), cell = cellOf(cells, ref);
                      const span = merged ? { rowSpan: merged.r2 - merged.r1 + 1, colSpan: merged.c2 - merged.c1 + 1 } : {};
                      const inSelection = rectContains(selection, row, col);
                      const isActive = merged ? rectContains(merged, focus.row, focus.col) : ref === activeRef;
                      const isEditing = editing?.ref === ref && !editing.fromBar;
                      const numeric = typeof cell.value === "number" && cell.numberFormat !== "Text";
                      const align = cell.align ?? (numeric ? "right" : "left");
                      const colHidden = hiddenColSet.has(col);
                      const frozenCol = Boolean(freeze && col < freeze.col);
                      const conditional = conditionalStyleAt(cells, sheet.conditionalFormats, row, col);
                      const filterButton = filterRect && row === filterRect.r1 && col >= filterRect.c1 && col <= filterRect.c2;
                      const filtering = filterButton && Boolean(sheet.filterHidden?.[columnLetters(col)]?.length);
                      const shown = showFormulas && cell.formula && !(sheet.protected && cell.hiddenFormula) ? cell.formula : formatCellValue(cell.value, cell.numberFormat, cell.decimals, cell.currency);
                      const listRule = isActive && !submitted ? validationFor(ref) : null;
                      // Shrink to fit: the text gets smaller until it fits the column, as in Excel.
                      const basePx = ((cell.fontSize ?? DEFAULT_FONT_SIZE) * 4) / 3 * (cell.vertAlign ? 0.75 : 1);
                      const cellWidth = merged ? Array.from({ length: merged.c2 - merged.c1 + 1 }, (_, i) => colPx(merged.c1 + i)).reduce((a, b) => a + b, 0) : colPx(col);
                      const fontPx = cell.shrink && !cell.wrap && shown ? Math.max(5, Math.min(basePx, (cellWidth - 8) / Math.max(1, shown.length * 0.55))) : basePx;
                      // As in Excel, text runs on into the next cells only while they are empty.
                      const neighbour = cells[refAt(row, col + 1)];
                      const spill = !cell.wrap && !merged && !numeric && cell.value != null && align === "left" && !filterButton && (!neighbour || (neighbour.value == null && !neighbour.formula)) && !mergeAt(merges, row, col + 1);
                      const fill = conditional?.fill ?? cell.fillColor;
                      const style: CSSProperties = {
                        backgroundColor: fill ? `#${fill}` : fillPreview && rectContains(fillPreview, row, col) ? "#e2efda" : inSelection && !isActive ? "#dbe8f7" : frozenRow || frozenCol ? "#ffffff" : undefined,
                        borderRight: sheet.gridlines ? "1px solid #d4d4d4" : "1px solid transparent", borderBottom: sheet.gridlines ? "1px solid #d4d4d4" : "1px solid transparent",
                        ...borderCss(cell.border),
                        ...(conditional?.border ? { border: conditional.border } : {}),
                        ...(freeze && row === freeze.row - 1 ? { borderBottom: "1px solid #9b9b9b" } : {}), ...(sheet.rowBreaks?.includes(row + 1) ? { borderBottom: "1px dashed #3c3c3c" } : {}), ...(freeze && col === freeze.col - 1 ? { borderRight: "1px solid #9b9b9b" } : {}),
                        textAlign: showFormulas && cell.formula ? "left" : align, verticalAlign: cell.vAlign === "middle" ? "middle" : cell.vAlign === "top" ? "top" : "bottom",
                        fontFamily: cell.fontFamily ? `"${cell.fontFamily}", ${DEFAULT_FONT}, sans-serif` : undefined, fontSize: `${fontPx}px`,
                        fontWeight: cell.bold ? 700 : undefined, fontStyle: cell.italic ? "italic" : undefined, textDecoration: [cell.underline && "underline", cell.strike && "line-through"].filter(Boolean).join(" ") || undefined,
                        textDecorationStyle: cell.underlineStyle === "double" || cell.underlineStyle === "doubleAccounting" ? "double" : undefined, textUnderlineOffset: cell.underlineStyle?.includes("Accounting") ? 3 : undefined,
                        backgroundImage: conditional?.bar ? `linear-gradient(to right, #${conditional.bar.color} 0%, #${conditional.bar.color}66 ${conditional.bar.percent}%, transparent ${conditional.bar.percent}%)` : undefined, color: conditional?.font ? `#${conditional.font}` : cell.fontColor ? `#${cell.fontColor}` : undefined,
                        paddingLeft: colHidden ? 0 : cell.indent && align === "left" ? 4 + cell.indent * 9 : undefined, paddingRight: colHidden ? 0 : filterButton ? 18 : cell.indent && align === "right" ? 4 + cell.indent * 9 : undefined,
                        whiteSpace: cell.wrap ? "normal" : "nowrap", overflow: spill ? "visible" : "hidden", height: rowHeight(row), lineHeight: 1.2, zIndex: frozenRow && frozenCol ? 16 : frozenRow || frozenCol ? 15 : spill ? 1 : undefined,
                        position: frozenRow || frozenCol ? "sticky" : "relative", top: frozenRow ? frozenTop(row) : undefined, left: frozenCol ? frozenLeft(col) : undefined,
                        outline: isActive ? "2px solid #217346" : undefined, outlineOffset: -2,
                      };
                      return (
                        <td key={ref} {...span} role="gridcell" aria-selected={inSelection} data-ref={ref} style={style}
                          className={`group max-w-0 ${colHidden ? "" : "px-1"}`}
                          onMouseDown={(event) => {
                            setSelectedChart(null);
                            // A right-click inside the selection keeps it (the menu then acts on all of it), as in Excel.
                            if (event.button === 2 && rectContains(selection, row, col)) return;
                            if (editing && !isEditing) commitEdit();
                            focusGrid();
                            if (painter) { dragging.current = true; paintStart.current = { row, col }; select(row, col); return; }
                            dragging.current = true;
                            select(row, col, event.shiftKey);
                          }}
                          onMouseEnter={() => { if (dragging.current) setFocus({ row, col }); else if (fillDrag) setFillDrag({ ...fillDrag, target: { row, col } }); }}
                          onMouseUp={() => { if (painter && dragging.current) { dragging.current = false; applyPainter(expandForMerges(normalizeRect(paintStart.current ?? anchor, { row, col }), merges)); paintStart.current = null; } }}
                          onDoubleClick={() => beginEdit()} onContextMenu={(event) => openContextMenu(event, row, col)}>
                          {isEditing ? (
                            <StoreInput inputRef={editInputRef} store={editText} live fallback="" aria-label={`Edit ${ref}`} onText={(value) => editText.set(value)}
                              onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Enter") { event.preventDefault(); commitEdit("down"); } else if (event.key === "Tab") { event.preventDefault(); commitEdit("right"); } else if (event.key === "Escape") cancelEdit(); }}
                              onBlur={() => commitEdit()} className="absolute inset-0 z-10 w-full min-w-[120px] border-2 border-[#217346] bg-white px-1 outline-none" style={{ fontSize: style.fontSize, fontFamily: style.fontFamily as string | undefined }} />
                          ) : (
                            <span className={cell.rotate ? "inline-block" : "block"} title={cell.link ? `${cell.link} - Click once to follow.` : undefined} style={{ overflow: spill ? "visible" : "hidden", textOverflow: "clip", position: spill ? "relative" : undefined, ...(cell.vertAlign ? { position: "relative", top: cell.vertAlign === "superscript" ? "-0.4em" : "0.3em" } : {}), ...(cell.rotate === 255 ? { writingMode: "vertical-rl", textOrientation: "upright" } : cell.rotate ? { transform: `rotate(${-cell.rotate}deg)`, transformOrigin: "center" } : {}) }}>{conditional?.icon && <ConditionalIcon icon={conditional.icon} />}{shown}</span>
                          )}
                          {!submitted && !isEditing && !colHidden && !painter && (merged ? merged.r2 === selection.r2 && merged.c2 === selection.c2 : row === selection.r2 && col === selection.c2) && (
                            <span data-fill-handle title="Fill handle: drag to fill, double-click to fill down" aria-hidden
                              onMouseDown={(event) => { event.stopPropagation(); event.preventDefault(); focusGrid(); setFillDrag({ source: selection, target: { row, col } }); }}
                              onDoubleClick={(event) => {
                                event.stopPropagation();
                                const last = autoFillDownLastRow(cells, selection);
                                if (last !== null) finishFill(selection, "down", last - selection.r2);
                              }}
                              className="absolute bottom-0 right-0 z-[6] h-[7px] w-[7px] cursor-crosshair border border-white bg-[#217346]" />
                          )}
                          {listRule?.type === "list" && <button type="button" aria-label={`Pick from list for ${ref}`} onMouseDown={(event) => { event.stopPropagation(); event.preventDefault(); }} onClick={() => setListMenu((open) => !open)} className="absolute -right-[18px] bottom-0 z-[3] grid h-[18px] w-4 place-items-center border border-[#adadad] bg-[#f0f0f0] text-[9px]">▾</button>}
                          {listRule?.type === "list" && listMenu && <div data-xl-list role="listbox" aria-label="Validation list" className="absolute left-0 top-full z-[45] min-w-full border border-[#7a7a7a] bg-white text-left text-[12px] shadow">{(listRule.list ?? "").split(",").map((item) => item.trim()).filter(Boolean).map((item) => <button key={item} type="button" role="option" aria-selected={String(cell.value ?? "") === item} onMouseDown={(event) => { event.stopPropagation(); event.preventDefault(); }} onClick={() => pickFromList(item)} className="block w-full px-1.5 py-0.5 text-left hover:bg-[#0078d7] hover:text-white">{item}</button>)}</div>}
                          {filterButton && !colHidden && <button type="button" aria-label={`Filter ${columnLetters(col)}`} title={filtering ? "Filtered" : "Filter"} onMouseDown={(event) => { event.stopPropagation(); event.preventDefault(); }}
                            onClick={(event) => { const box = (event.currentTarget as HTMLElement).getBoundingClientRect(); setFilterMenu({ col, x: box.left, y: box.bottom + 2 }); }}
                            className="absolute bottom-0.5 right-0.5 top-0.5 z-[2] grid w-4 place-items-center border border-[#adadad] bg-[#f0f0f0] text-[9px] leading-none text-[#444] hover:bg-white">{filtering ? "▼⏷" : "▾"}</button>}
                          {cell.comment && !colHidden && <>
                            <span aria-hidden className="absolute right-0 top-0 h-0 w-0 border-l-[6px] border-t-[6px] border-l-transparent border-t-[#c00000]" />
                            <span role="note" className={`absolute left-full top-0 z-[40] ml-2 w-44 whitespace-pre-wrap border border-[#7a7a7a] bg-[#ffffe1] p-1.5 text-left text-[11px] font-normal not-italic text-black no-underline shadow ${showComments || showCommentAt === ref ? "block" : "hidden group-hover:block"}`}><b>Student:</b><br />{cell.comment}</span>
                          </>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(sheet.charts ?? []).map((chart) => {
            const origin = cellOrigin(chart.anchor);
            const isSelected = selectedChart === chart.id;
            return (
              <div key={chart.id} data-xl-chart className="absolute z-[18]" style={{ left: origin.left, top: origin.top }} onMouseDown={(event) => { event.stopPropagation(); setSelectedChart(chart.id); setMenu(null); }}>
                <ChartView chart={chart} cells={cells} selected={isSelected} />
                {isSelected && !submitted && (
                  <div data-xl-menu className="absolute right-1 top-1 flex gap-1 border border-[#c6c6c6] bg-white/95 p-0.5 text-[11px] shadow">
                    <button type="button" onClick={() => openDialog({ kind: "input", purpose: "chartTitle", chartId: chart.id })} className="px-2 py-0.5 hover:bg-[#d5e1f2]">Chart Title</button>
                    <select aria-label="Change Chart Type" value={chart.type} onChange={(event) => updateChart(chart.id, { type: event.target.value as ChartType }, "chart")} className="border border-[#c6c6c6] px-1">
                      <option value="column">Clustered Column</option><option value="bar">Clustered Bar</option><option value="line">Line with Markers</option><option value="pie">Pie</option>
                    </select>
                    <button type="button" onClick={() => deleteChart(chart.id)} className="px-2 py-0.5 text-[#c00000] hover:bg-[#d5e1f2]">Delete Chart</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-stretch border-t border-slate-300 bg-[#f3f3f3] text-[11px] text-slate-600">
        <div className="flex items-center gap-0.5 px-1 text-[#999]" aria-hidden><span className="px-1">◀</span><span className="px-1">▶</span></div>
        {renamingSheet !== null ? (
          <input autoFocus aria-label="Sheet name" value={renamingSheet} maxLength={31} onChange={(event) => setRenamingSheet(event.target.value)} onBlur={() => renameSheet(renamingSheet)} onKeyDown={(event) => { if (event.key === "Enter") renameSheet(renamingSheet); if (event.key === "Escape") setRenamingSheet(null); }} className="w-28 border border-[#217346] bg-white px-2 text-[12px] outline-none" />
        ) : (
          <button type="button" aria-label={`Sheet tab ${sheetName}`} title="Double-click to rename" onDoubleClick={() => { if (!submitted) setRenamingSheet(sheetName); }} style={sheet.tabColor ? { borderBottomColor: `#${sheet.tabColor}`, boxShadow: `inset 0 -3px 0 #${sheet.tabColor}` } : undefined} className="border-x border-b-2 border-x-slate-300 border-b-[#217346] bg-white px-4 py-0.5 text-[12px] font-semibold text-[#217346]">{sheetName}</button>
        )}
        <span aria-hidden title="New sheet" className="grid w-6 place-items-center text-[14px] text-[#999]">⊕</span>
        <span className="flex items-center gap-3 px-3">
          <span>{editing ? "Edit" : painter ? "Format Painter" : clip ? "Select destination and press ENTER or choose Paste" : filteredOut.size && filterRect ? `${filterRect.r2 - filterRect.r1 - filteredOut.size} of ${filterRect.r2 - filterRect.r1} records found` : "Ready"}</span>
          {sheet.protected && <span title="Protected sheet">🔒 Protected</span>}
          {sheet.printArea && <span>Print area: {sheet.printArea}</span>}
          <span>{sheet.orientation === "landscape" ? "Landscape" : "Portrait"} · {sheet.paperSize}</span>
          {(sheet.header.left || sheet.header.center || sheet.header.right) && <span>Header: {[sheet.header.left, sheet.header.center, sheet.header.right].map((part) => previewHeaderText(part, 1, 1).replace(/Sheet1/g, sheetName)).filter(Boolean).join(" | ")}</span>}
        </span>
        <span className="ml-auto flex items-center px-3">{stats && <>{stats.average !== null && <>Average: {formatCellValue(stats.average, "General")}&nbsp;&nbsp;&nbsp;</>}Count: {stats.count}{stats.average !== null && <>&nbsp;&nbsp;&nbsp;Sum: {formatCellValue(stats.sum, "General")}</>}</>}</span>
        <span className="flex items-center gap-1 px-2" aria-label="Views"><span title="Normal" className="border border-[#9fb9a7] bg-[#cfe2d4] px-1">▦</span><span title="Page Layout" className="px-1 text-[#999]">▤</span><span title="Page Break Preview" className="px-1 text-[#999]">▥</span></span>
        <span className="flex items-center gap-1 px-2">
          <button type="button" aria-label="Zoom Out" onClick={() => setSheet((s) => ({ ...s, zoom: Math.max(10, (s.zoom || 100) - 10) }))} className="px-1 hover:text-black">−</button>
          <input type="range" aria-label="Zoom" min={10} max={400} step={10} value={zoom} onChange={(event) => setSheet((s) => ({ ...s, zoom: Number(event.target.value) }))} className="h-1 w-24 accent-[#217346]" />
          <button type="button" aria-label="Zoom In" onClick={() => setSheet((s) => ({ ...s, zoom: Math.min(400, (s.zoom || 100) + 10) }))} className="px-1 hover:text-black">+</button>
          <button type="button" onClick={() => openDialog({ kind: "zoom" })} className="w-10 text-right hover:text-black">{zoom}%</button>
        </span>
        {/* Submit / Save answer: a small button at the end of the status bar, as in the Word workspace. */}
        <span className="flex items-center gap-1.5 py-0.5 pl-1 pr-2">
          {staleDeploy && <button type="button" onClick={() => window.location.reload()} className="word-statusbar-button word-statusbar-refresh">Refresh page</button>}
          <button type="button" disabled={submitted} title={`Autosave: ${status}`} onClick={() => { if (editing) commitEdit(); if (submitted) return; if (submitConfirmMessage === null) void submitNow(false); else setConfirmSubmitOpen(true); }} className="word-statusbar-button">{submitLabel}</button>
        </span>
      </div>
      <ConfirmDialog open={confirmSubmitOpen} title="Submit your test?" message={submitConfirmMessage ?? ""} confirmLabel="Yes, submit" cancelLabel="Not yet" onCancel={() => setConfirmSubmitOpen(false)} onConfirm={() => { setConfirmSubmitOpen(false); void submitNow(false); }} />
      <ConfirmDialog open={submitProblem !== null} title="Could not submit" message={submitProblem} confirmLabel="OK" cancelLabel={null} tone="primary" onCancel={() => setSubmitProblem(null)} onConfirm={() => setSubmitProblem(null)} />
      {formatDialog && <FormatCellsDialog cell={active} merged={Boolean(activeMerge)} initialTab={formatDialog} onCancel={() => { setFormatDialog(null); focusGrid(); }} onOk={applyFormatCells} />}
      {contextMenu && (
        <div data-xl-context role="menu" aria-label="Cell menu" className="fixed z-[85] min-w-[12rem] border border-[#c6c6c6] bg-white py-1 text-[12px] shadow-xl" style={{ left: Math.min(contextMenu.x, (typeof window === "undefined" ? 1200 : window.innerWidth) - 200), top: Math.min(contextMenu.y, (typeof window === "undefined" ? 800 : window.innerHeight) - 420) }}>
          <ContextItem label="Cut" disabled={submitted} onSelect={() => { setContextMenu(null); copy(true); focusGrid(); }} />
          <ContextItem label="Copy" disabled={false} onSelect={() => { setContextMenu(null); copy(); focusGrid(); }} />
          <ContextItem label="Paste" disabled={submitted} onSelect={() => { setContextMenu(null); paste(); focusGrid(); }} />
          <ContextItem label="Paste Values" disabled={submitted} onSelect={() => { setContextMenu(null); pasteSpecial("values"); focusGrid(); }} />
          <ContextItem label="Paste Formatting" disabled={submitted} onSelect={() => { setContextMenu(null); pasteSpecial("formatting"); focusGrid(); }} />
          <div className="my-1 border-t border-[#e1e1e1]" />
          {wholeCols ? <>
            <ContextItem label="Insert" disabled={submitted} onSelect={() => { setContextMenu(null); insertColumn(); focusGrid(); }} />
            <ContextItem label="Delete" disabled={submitted} onSelect={() => { setContextMenu(null); deleteColumn(); focusGrid(); }} />
            <ContextItem label="Clear Contents" disabled={submitted} onSelect={() => { setContextMenu(null); clearContents(); focusGrid(); }} />
            <div className="my-1 border-t border-[#e1e1e1]" />
            <ContextItem label="Format Cells..." disabled={submitted} onSelect={() => { setContextMenu(null); openFormatCells("Number"); }} />
            <ContextItem label="Column Width..." disabled={submitted} onSelect={() => openDialog({ kind: "input", purpose: "columnWidth" })} />
            <ContextItem label="Hide" disabled={submitted} onSelect={() => { setContextMenu(null); hideColumns(true); focusGrid(); }} />
            <ContextItem label="Unhide" disabled={submitted} onSelect={() => { setContextMenu(null); hideColumns(false); focusGrid(); }} />
          </> : wholeRows ? <>
            <ContextItem label="Insert" disabled={submitted} onSelect={() => { setContextMenu(null); insertRow(); focusGrid(); }} />
            <ContextItem label="Delete" disabled={submitted} onSelect={() => { setContextMenu(null); deleteRow(); focusGrid(); }} />
            <ContextItem label="Clear Contents" disabled={submitted} onSelect={() => { setContextMenu(null); clearContents(); focusGrid(); }} />
            <div className="my-1 border-t border-[#e1e1e1]" />
            <ContextItem label="Format Cells..." disabled={submitted} onSelect={() => { setContextMenu(null); openFormatCells("Number"); }} />
            <ContextItem label="Row Height..." disabled={submitted} onSelect={() => openDialog({ kind: "input", purpose: "rowHeight" })} />
            <ContextItem label="Hide" disabled={submitted} onSelect={() => { setContextMenu(null); hideRows(true); focusGrid(); }} />
            <ContextItem label="Unhide" disabled={submitted} onSelect={() => { setContextMenu(null); hideRows(false); focusGrid(); }} />
          </> : <>
            <ContextItem label="Insert Sheet Rows" disabled={submitted} onSelect={() => { setContextMenu(null); insertRow(); focusGrid(); }} />
            <ContextItem label="Delete Sheet Rows" disabled={submitted} onSelect={() => { setContextMenu(null); deleteRow(); focusGrid(); }} />
            <ContextItem label="Insert Sheet Columns" disabled={submitted} onSelect={() => { setContextMenu(null); insertColumn(); focusGrid(); }} />
            <ContextItem label="Delete Sheet Columns" disabled={submitted} onSelect={() => { setContextMenu(null); deleteColumn(); focusGrid(); }} />
            <ContextItem label="Clear Contents" disabled={submitted} onSelect={() => { setContextMenu(null); clearContents(); focusGrid(); }} />
            <div className="my-1 border-t border-[#e1e1e1]" />
            <ContextItem label="Filter" disabled={submitted} onSelect={() => { setContextMenu(null); toggleFilter(); focusGrid(); }} />
            <ContextItem label="Sort A to Z" disabled={submitted} onSelect={() => { setContextMenu(null); sortSelection("asc"); focusGrid(); }} />
            <ContextItem label="Sort Z to A" disabled={submitted} onSelect={() => { setContextMenu(null); sortSelection("desc"); focusGrid(); }} />
            <div className="my-1 border-t border-[#e1e1e1]" />
            <ContextItem label="Pick From Drop-down List..." disabled={submitted || validationFor(activeCellRef)?.type !== "list"} onSelect={() => { setContextMenu(null); setListMenu(true); }} />
            <ContextItem label={active.link ? "Edit Hyperlink..." : "Hyperlink..."} disabled={submitted} onSelect={() => openDialog({ kind: "hyperlink" })} />
            <ContextItem label={active.comment ? "Edit Comment" : "Insert Comment"} disabled={submitted} onSelect={() => openDialog({ kind: "input", purpose: "comment" })} />
            {active.comment && <ContextItem label="Delete Comment" disabled={submitted} onSelect={() => { setContextMenu(null); deleteComment(); focusGrid(); }} />}
            <ContextItem label="Format Cells..." disabled={submitted} onSelect={() => { setContextMenu(null); openFormatCells("Number"); focusGrid(); }} />
          </>}
        </div>
      )}
      {filterMenu && <FilterMenu x={filterMenu.x} y={filterMenu.y} values={filterValues(filterMenu.col)} hidden={(sheet.filterHidden?.[columnLetters(filterMenu.col)] ?? []).map(String)}
        onSort={(descending) => { const rect = filterRect; setFilterMenu(null); if (rect) sortRows(rect, filterMenu.col, descending, true, descending ? "sortDescending" : "sortAscending"); }}
        onOk={(hidden) => applyFilterValues(filterMenu.col, hidden)} onCancel={() => setFilterMenu(null)} />}
      {dialog?.kind === "insertFunction" && <InsertFunctionDialog initialCategory={dialog.category} onOk={insertFunction} onCancel={closeDialog} />}
      {dialog?.kind === "sort" && <SortDialog defaultHeaders={dialog.headers} columns={Array.from({ length: dialog.rect.c2 - dialog.rect.c1 + 1 }, (_, i) => ({ index: dialog.rect.c1 + i, letter: columnLetters(dialog.rect.c1 + i), header: String(cellOf(cells, refAt(dialog.rect.r1, dialog.rect.c1 + i)).value ?? "") }))} onOk={(choice) => { closeDialog(); sortRows(dialog.rect, choice.column, choice.descending, choice.headers, "sort"); }} onCancel={closeDialog} />}
      {dialog?.kind === "conditional" && <ConditionalDialog type={dialog.type} onOk={addConditional} onCancel={closeDialog} />}
      {dialog?.kind === "find" && <FindReplaceDialog initialTab={dialog.tab} onFindNext={findNext} onReplace={replaceOne} onReplaceAll={replaceAll} onCancel={closeDialog} />}
      {dialog?.kind === "pageSetup" && <PageSetupDialog sheet={sheet} initialTab={dialog.tab} onCustomHeader={() => { setDialog(null); setHeaderDialog(true); }} onCancel={closeDialog}
        onOk={(result) => { const op = result.printTitleRows !== (sheet.printTitleRows ?? null) || result.printTitleCols !== (sheet.printTitleCols ?? null) ? "printTitles" : "pageSetup"; change(op, { sheet: { ...sheet, ...result } }); if (result.orientation !== sheet.orientation) record("orientation"); if (result.paperSize !== sheet.paperSize) record("paperSize"); if (result.printArea !== sheet.printArea) record(result.printArea ? "printArea" : "clearPrintArea"); closeDialog(); }} />}
      {dialog?.kind === "pasteSpecial" && <PasteSpecialDialog onOk={(choice) => pasteSpecialApply(choice)} onCancel={closeDialog} />}
      {dialog?.kind === "insertCells" && <InsertDeleteCellsDialog mode="insert" onOk={(choice) => shiftCells(choice, true)} onCancel={closeDialog} />}
      {dialog?.kind === "deleteCells" && <InsertDeleteCellsDialog mode="delete" onOk={(choice) => shiftCells(choice, false)} onCancel={closeDialog} />}
      {dialog?.kind === "series" && <SeriesDialog defaultDirection={selection.r2 - selection.r1 >= selection.c2 - selection.c1 ? "columns" : "rows"} onOk={fillSeries} onCancel={closeDialog} />}
      {dialog?.kind === "goToSpecial" && <GoToSpecialDialog onOk={goToSpecial} onCancel={closeDialog} />}
      {dialog?.kind === "hyperlink" && <HyperlinkDialog initialText={active.value == null ? "" : String(active.value)} initialAddress={active.link ?? ""} onOk={setHyperlink} onRemove={active.link ? removeHyperlink : undefined} onCancel={closeDialog} />}
      {dialog?.kind === "defineName" && <DefineNameDialog refersTo={rangeString(selection).split(":").map((part) => part.replace(/^([A-Z]+)(\d+)$/, (_, letters: string, digits: string) => `$${letters}$${digits}`)).join(":")} onOk={defineName} onCancel={closeDialog} />}
      {dialog?.kind === "nameManager" && <NameManagerDialog names={sheet.definedNames ?? {}} onDelete={deleteName} onNew={() => openDialog({ kind: "defineName" })} onCancel={closeDialog} />}
      {dialog?.kind === "validation" && <DataValidationDialog current={validationFor(activeCellRef)} onOk={setValidation} onClear={clearValidation} onCancel={closeDialog} />}
      {dialog?.kind === "textToColumns" && <TextToColumnsDialog onOk={textToColumns} onCancel={closeDialog} />}
      {dialog?.kind === "manageRules" && <ManageRulesDialog rules={sheet.conditionalFormats ?? []} onDelete={(index) => change("clearConditionalFormat", { sheet: { ...sheet, conditionalFormats: (sheet.conditionalFormats ?? []).filter((_, i) => i !== index) } })} onCancel={closeDialog} />}
      {dialog?.kind === "moreColors" && <MoreColorsDialog title={dialog.target === "font" ? "Font Color" : dialog.target === "fill" ? "Fill Color" : "Tab Color"} initial={dialog.target === "font" ? active.fontColor : dialog.target === "fill" ? active.fillColor : sheet.tabColor ?? null} onCancel={closeDialog}
        onOk={(hex) => { closeDialog(); if (dialog.target === "font") { setLastFont(hex); formatSelection({ fontColor: hex }, "fontColor"); } else if (dialog.target === "fill") { setLastFill(hex); formatSelection({ fillColor: hex }, "fillColor"); } else setTabColor(hex); }} />}
      {dialog?.kind === "input" && dialog.purpose === "defaultWidth" && <InputDialog title="Standard Width" label="Standard column width:" numeric min={0} max={255} initial="8.43" onOk={(value) => { closeDialog(); setDefaultWidth(Number(value)); }} onCancel={closeDialog} />}
      <ConfirmDialog open={validationAlert !== null} title={validationAlert?.title ?? ""} message={validationAlert?.message ?? ""} confirmLabel="Retry" cancelLabel="Cancel" tone="primary" onCancel={() => { setValidationAlert(null); setEditing(null); focusGrid(); }} onConfirm={() => { setValidationAlert(null); requestAnimationFrame(() => editInputRef.current?.select()); }} />
      {dialog?.kind === "symbol" && <SymbolDialog onInsert={insertSymbol} onCancel={closeDialog} />}
      {dialog?.kind === "zoom" && <ZoomDialog value={zoom} onFitSelection={zoomToSelection} onOk={(value) => { setSheet((s) => ({ ...s, zoom: value })); closeDialog(); }} onCancel={closeDialog} />}
      {dialog?.kind === "input" && dialog.purpose === "rowHeight" && <InputDialog title="Row Height" label="Row height:" numeric min={0} max={409} initial={String(sheet.rowHeights?.[String(selection.r1)] ?? 15)} onOk={(value) => applyInput("rowHeight", value)} onCancel={closeDialog} />}
      {dialog?.kind === "input" && dialog.purpose === "columnWidth" && <InputDialog title="Column Width" label="Column width:" numeric min={0} max={255} initial={String(sheet.colWidths?.[columnLetters(selection.c1)] ?? 8.43)} onOk={(value) => applyInput("columnWidth", value)} onCancel={closeDialog} />}
      {dialog?.kind === "input" && dialog.purpose === "comment" && <InputDialog title={active.comment ? "Edit Comment" : "New Comment"} label={`Comment on ${activeCellRef}:`} multiline initial={active.comment ?? ""} onOk={(value) => applyInput("comment", value)} onCancel={closeDialog} />}
      {dialog?.kind === "input" && dialog.purpose === "protect" && <InputDialog title="Protect Sheet" label="Password to unprotect sheet (optional):" hint="Protect worksheet and contents of locked cells. Students' passwords are not stored; the sheet is simply protected." onOk={(value) => applyInput("protect", value)} onCancel={closeDialog} />}
      {dialog?.kind === "input" && dialog.purpose === "unprotect" && <InputDialog title="Unprotect Sheet" label="Password:" hint="Press OK to unprotect the sheet." onOk={(value) => applyInput("unprotect", value)} onCancel={closeDialog} />}
      {dialog?.kind === "input" && dialog.purpose === "chartTitle" && <InputDialog title="Chart Title" label="Chart title:" initial={(sheet.charts ?? []).find((chart) => chart.id === dialog.chartId)?.title ?? ""} onOk={(value) => applyInput("chartTitle", value, dialog.chartId)} onCancel={closeDialog} />}
      {headerDialog && <HeaderFooterDialog header={sheet.header} footer={sheet.footer} onCancel={() => setHeaderDialog(false)} onOk={(header, footer) => { setHeaderDialog(false); const usedPage = [header, footer].some((part) => Object.values(part).some((text) => /&\[Page\]/i.test(text ?? ""))); change(usedPage ? "pageNumber" : "header", { sheet: { ...sheet, header, footer } }); record("header"); }} />}
    </div>
  );
}

// The text being typed into a cell or the formula bar: a tiny store both inputs read, so typing does not redraw the sheet.
type TextStore = { get: () => string; set: (value: string) => void; subscribe: (listener: () => void) => () => void };
function createTextStore(): TextStore {
  let value = "";
  const listeners = new Set<() => void>();
  return { get: () => value, set: (next) => { if (next === value) return; value = next; listeners.forEach((listener) => listener()); }, subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; } };
}
// An input showing the store while live (being edited), otherwise the fallback text.
function StoreInput({ store, live, fallback, onText, inputRef, ...rest }: { store: TextStore; live: boolean; fallback: string; onText: (value: string) => void; inputRef?: React.Ref<HTMLInputElement> } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const text = useSyncExternalStore(store.subscribe, store.get, store.get);
  return <input ref={inputRef} {...rest} value={live ? text : fallback} onChange={(event) => onText(event.target.value)} />;
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
function Popover({ children, className, label, role = "menu" }: { children: React.ReactNode; className: string; label?: string; role?: string }) {
  const marker = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  useLayoutEffect(() => {
    const anchor = (marker.current?.parentElement?.closest("[data-xl-menu]") ?? marker.current?.parentElement) as HTMLElement | null;
    if (!anchor) return;
    const measure = () => {
      const box = anchor.getBoundingClientRect(), width = panel.current?.offsetWidth ?? 200;
      const left = Math.max(4, Math.min(box.left, window.innerWidth - width - 4));
      setPlace({ left, top: box.bottom + 2, maxHeight: Math.max(160, window.innerHeight - box.bottom - 10) });
    };
    measure();
    window.addEventListener("resize", measure); window.addEventListener("scroll", measure, true);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, []);
  return <>
    <span ref={marker} hidden />
    {typeof document !== "undefined" && createPortal(
      <div ref={panel} data-xl-menu role={role} aria-label={label} className={`fixed z-[80] overflow-y-auto ${className}`} style={{ left: place?.left ?? -9999, top: place?.top ?? -9999, maxHeight: place?.maxHeight }}>{children}</div>,
      document.body)}
  </>;
}
function Menu({ children }: { children: React.ReactNode }) {
  return <Popover className="min-w-[12rem] border border-[#c6c6c6] bg-white py-1 text-[12px] text-[#262626] shadow-lg">{children}</Popover>;
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
function ColorSplit({ id, label, swatch, icon, menu, setMenu, onApply, onPick, noneLabel, disabled, onMore }: { id: string; label: string; swatch: string; icon: React.ReactNode; menu: string | null; setMenu: (value: string | null) => void; onApply: () => void; onPick: (hex: string | null) => void; noneLabel: string; disabled?: boolean; onMore?: () => void }) {
  const open = menu === id;
  return (
    <span data-xl-menu className="relative flex">
      <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onApply} aria-label={label} title={label} className="flex h-[22px] flex-col items-center justify-center border border-transparent px-1 hover:border-[#c6c6c6] hover:bg-white disabled:opacity-40"><span className="leading-none">{icon}</span><span className="mt-0.5 h-[3px] w-4" style={{ backgroundColor: `#${swatch}` }} /></button>
      <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => setMenu(open ? null : id)} aria-label={`${label} palette`} aria-expanded={open} className="flex h-[22px] items-center border border-transparent px-0.5 text-[9px] hover:border-[#c6c6c6] hover:bg-white disabled:opacity-40">▾</button>
      {open && (
        <Popover label={`${label} palette`} className="w-56 border border-[#c6c6c6] bg-white p-2 text-[#262626] shadow-lg">
          <button type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => { onPick(null); setMenu(null); }} className="mb-1 w-full px-1 py-0.5 text-left text-[12px] hover:bg-[#d5e1f2]">{noneLabel}</button>
          <p className="text-[11px] font-semibold text-slate-500">Theme Colors</p>
          <div className="mt-1 grid grid-cols-10 gap-0.5">{THEME_COLORS.flat().map((hex, index) => <button key={`${hex}-${index}`} type="button" role="menuitem" aria-label={`#${hex}`} title={`#${hex}`} onMouseDown={(event) => event.preventDefault()} onClick={() => { onPick(hex); setMenu(null); }} className="h-4 w-4 border border-slate-200" style={{ backgroundColor: `#${hex}` }} />)}</div>
          <p className="mt-2 text-[11px] font-semibold text-slate-500">Standard Colors</p>
          <div className="mt-1 grid grid-cols-10 gap-0.5">{STANDARD_COLORS.map(([hex, name]) => <button key={hex} type="button" role="menuitem" aria-label={`${name} (#${hex})`} title={name} onMouseDown={(event) => event.preventDefault()} onClick={() => { onPick(hex); setMenu(null); }} className="h-4 w-4 border border-slate-200" style={{ backgroundColor: `#${hex}` }} />)}</div>
          {onMore && <button type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => { setMenu(null); onMore(); }} className="mt-2 w-full px-1 py-0.5 text-left text-[12px] hover:bg-[#d5e1f2]">More Colors...</button>}
        </Popover>
      )}
    </span>
  );
}
// Small line drawings for the ribbon, close to Excel 2013's icons.
function Icon({ name, big }: { name: string; big?: boolean }) {
  const s = big ? 30 : 16;
  const line = (x1: number, y1: number, x2: number, y2: number, color = "#444", w = 1.4) => <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} />;
  const rows = (ys: number[], widths: [number, number][]) => ys.map((y, i) => <g key={i}>{line(widths[i][0], y, widths[i][1], y)}</g>);
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
    fnBook: <><rect x={6} y={4} width={18} height={22} rx={1} fill="#fff" stroke="#888" /><rect x={6} y={4} width={4} height={22} fill="#217346" /><text x={12} y={19} fontSize={10} fontStyle="italic" fontFamily="serif" fill="#333">fx</text></>,
    showFormulas: <><rect x={2} y={2} width={12} height={12} fill="#fff" stroke="#888" /><text x={3.5} y={11.5} fontSize={8} fontStyle="italic" fontFamily="serif" fill="#217346">fx</text></>,
    filter: <><path d="M5 6 H25 L17 16 V25 L13 22 V16 Z" fill="#fff" stroke="#555" strokeWidth={1.4} /></>,
    dedupe: <><rect x={3} y={5} width={20} height={6} fill="#fff" stroke="#888" /><rect x={3} y={13} width={20} height={6} fill="#ffc7ce" stroke="#888" /><path d="M20 20 l8 8 M28 20 l-8 8" stroke="#d24726" strokeWidth={2} /></>,
    comment: <><path d="M4 5 H26 V20 H13 L7 26 V20 H4 Z" fill="#fff8c4" stroke="#b49c3a" strokeWidth={1.3} /></>,
    commentDelete: <><path d="M4 5 H22 V18 H12 L7 23 V18 H4 Z" fill="#fff8c4" stroke="#b49c3a" strokeWidth={1.3} /><path d="M19 18 l8 8 M27 18 l-8 8" stroke="#d24726" strokeWidth={2} /></>,
    lock: <><rect x={7} y={13} width={16} height={13} rx={1.5} fill="#e6b84a" stroke="#8a6d1f" /><path d="M10 13 V9 a5 5 0 0 1 10 0 V13" fill="none" stroke="#666" strokeWidth={2} /></>,
    freeze: <><rect x={3} y={4} width={24} height={22} fill="#fff" stroke="#888" /><rect x={3} y={4} width={24} height={6} fill="#bdd7ee" /><rect x={3} y={4} width={7} height={22} fill="#bdd7ee" opacity={0.8} />{line(3, 10, 27, 10, "#2a6bd4", 1.5)}{line(10, 4, 10, 26, "#2a6bd4", 1.5)}</>,
  };
  return <svg aria-hidden width={s} height={s} viewBox={big ? "0 0 30 30" : "0 0 16 16"} className="shrink-0">{content[name] ?? null}</svg>;
}
function ChartIcon({ type, small }: { type: ChartType; small?: boolean }) {
  const s = small ? 16 : 30;
  const body = type === "pie" ? <><circle cx={15} cy={15} r={11} fill="#5b9bd5" /><path d="M15 15 L15 4 A11 11 0 0 1 25.5 18 Z" fill="#ed7d31" /></>
    : type === "line" ? <><path d="M3 24 L10 14 L17 18 L27 6" fill="none" stroke="#5b9bd5" strokeWidth={2.5} /><path d="M3 27 H27" stroke="#888" /></>
    : type === "bar" ? <>{[[5, 16], [12, 22], [19, 12]].map(([y, w]) => <rect key={y} x={3} y={y} width={w} height={5} fill="#5b9bd5" />)}<path d="M3 3 V27" stroke="#888" /></>
    : <>{[[4, 14], [11, 8], [18, 18]].map(([x, h]) => <rect key={x} x={x} y={26 - h} width={5} height={h} fill="#5b9bd5" />)}{[[7, 10], [14, 16], [21, 6]].map(([x, h]) => <rect key={x} x={x} y={26 - h} width={3} height={h} fill="#ed7d31" />)}<path d="M3 26 H28" stroke="#888" /></>;
  return <svg aria-hidden width={s} height={s} viewBox="0 0 30 30" className="shrink-0">{body}</svg>;
}
// Icon Sets: Excel's coloured arrows and traffic lights.
function ConditionalIcon({ icon }: { icon: string }) {
  if (icon.startsWith("●")) { const color = icon.endsWith("g") ? "#63BE7B" : icon.endsWith("y") ? "#FFC000" : "#F8696B"; return <span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: color }} />; }
  const color = icon === "↑" ? "#63BE7B" : icon === "→" ? "#FFC000" : "#F8696B";
  return <span aria-hidden className="mr-1 font-bold" style={{ color }}>{icon}</span>;
}
function MenuHeading({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#eeeeee] px-3 py-0.5 text-[11px] font-semibold text-[#444]">{children}</div>;
}
function MenuSeparator() {
  return <div className="my-1 border-t border-[#e1e1e1]" />;
}
// Clicking into the Name Box or the Font Size box selects its text, as in Excel, so typing replaces it. The
// mouse-up that follows the focusing click would put the caret back; it is skipped once.
const selectAllOnFocus = {
  onFocus: (event: React.FocusEvent<HTMLInputElement>) => { event.currentTarget.select(); event.currentTarget.dataset.selectAll = "1"; },
  onMouseUp: (event: React.MouseEvent<HTMLInputElement>) => { if (event.currentTarget.dataset.selectAll) { event.preventDefault(); delete event.currentTarget.dataset.selectAll; } },
};

function FontSizeBox({ value, onChange, disabled }: { value: number; onChange: (size: number) => void; disabled?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  // Excel's own size list under the box. Not a <datalist>: the browser drew that list at the page's top-left
  // inside the scrolling ribbon. Fixed position, so the ribbon's overflow does not clip it.
  const [list, setList] = useState<{ left: number; top: number } | null>(null);
  const boxRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!list) return;
    const close = (event: Event) => { if (!boxRef.current?.contains(event.target as Node)) setList(null); };
    // Follow the box when the ribbon or page scrolls (clicking it can scroll the ribbon); scrolling the list itself does not move it.
    const follow = (event: Event) => { if (boxRef.current?.contains(event.target as Node)) return; const box = boxRef.current?.getBoundingClientRect(); if (box) setList((old) => old && (old.left !== box.left || old.top !== box.bottom) ? { left: box.left, top: box.bottom } : old); };
    document.addEventListener("mousedown", close); window.addEventListener("resize", follow); window.addEventListener("scroll", follow, true);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("resize", follow); window.removeEventListener("scroll", follow, true); };
  }, [list]);
  const apply = (raw: string) => { const size = Number(raw); if (Number.isFinite(size) && size >= 1 && size <= 409) onChange(Math.round(size * 2) / 2); setText(null); };
  const toggle = () => { if (list) { setList(null); return; } const box = boxRef.current?.getBoundingClientRect(); if (box) setList({ left: box.left, top: box.bottom }); };
  return (
    <span ref={boxRef} className="flex">
      <input aria-label="Font Size" disabled={disabled} value={text ?? String(value)} {...selectAllOnFocus} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); apply(text ?? String(value)); setList(null); } if (event.key === "Escape") setList(null); }} onBlur={() => { if (text !== null) apply(text); }} className="h-[22px] w-9 border border-r-0 border-[#c6c6c6] bg-white px-1 text-[12px]" />
      <button type="button" aria-label="Font Size list" aria-haspopup="listbox" aria-expanded={Boolean(list)} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={toggle} className="h-[22px] w-4 border border-[#c6c6c6] bg-white text-[9px] text-slate-600 hover:bg-[#d5e1f2] disabled:opacity-40">▾</button>
      {list && <div role="listbox" aria-label="Font sizes" className="fixed z-[90] max-h-72 w-[52px] overflow-y-auto border border-[#c6c6c6] bg-white py-0.5 text-[12px] shadow-lg" style={{ left: list.left, top: list.top }}>
        {FONT_SIZES.map((size) => <button key={size} type="button" role="option" aria-selected={size === value} onMouseDown={(event) => event.preventDefault()} onClick={() => { apply(String(size)); setList(null); }} className={`block w-full px-2 py-0.5 text-left hover:bg-[#d5e1f2] ${size === value ? "bg-[#cde6f7]" : ""}`}>{size}</button>)}
      </div>}
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
