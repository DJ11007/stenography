// Pure helpers behind the Excel Efficiency workspace: cell references and ranges, merged cells, inserting
// and deleting rows/columns, formula values, borders and the used part of a sheet.
import { columnIndex, columnLetters, computedCellValue, type SheetCells } from "./excel-formula.ts";
import type { SheetCell, SheetSettings } from "./excel-document.ts";

export type Rect = { r1: number; c1: number; r2: number; c2: number };
export const MAX_ROWS = 200, MAX_COLS = 26;
export const DEFAULT_FONT = "Calibri", DEFAULT_FONT_SIZE = 11;
export const EMPTY_CELL: SheetCell = { value: null, formula: null, bold: false, italic: false, underline: false, fontColor: null, fillColor: null, border: null, numberFormat: "General", align: null };
export const STYLE_KEYS = ["bold", "italic", "underline", "fontColor", "fillColor", "border", "numberFormat", "align", "fontSize", "fontFamily", "vAlign", "wrap", "rotate", "indent", "strike", "decimals"] as const;

export function refAt(row: number, col: number) { return `${columnLetters(col)}${row}`; }
export function parseRef(ref: string): { row: number; col: number } | null {
  const match = ref.toUpperCase().replace(/\$/g, "").match(/^([A-Z]{1,2})([0-9]{1,3})$/);
  return match ? { col: columnIndex(match[1]), row: Number(match[2]) } : null;
}
export function normalizeRect(a: { row: number; col: number }, b: { row: number; col: number }): Rect {
  return { r1: Math.min(a.row, b.row), c1: Math.min(a.col, b.col), r2: Math.max(a.row, b.row), c2: Math.max(a.col, b.col) };
}
/** "A1:C3" or "A1" (with or without $) to a rectangle. */
export function parseRange(range: string): Rect | null {
  const [start, end = start] = range.toUpperCase().replace(/\$/g, "").split(":");
  const a = parseRef(start), b = parseRef(end);
  return a && b ? normalizeRect(a, b) : null;
}
export function rangeString(rect: Rect) {
  const start = refAt(rect.r1, rect.c1), end = refAt(rect.r2, rect.c2);
  return start === end ? start : `${start}:${end}`;
}
export function rectRefs(rect: Rect) {
  const refs: string[] = [];
  for (let row = rect.r1; row <= rect.r2; row++) for (let col = rect.c1; col <= rect.c2; col++) refs.push(refAt(row, col));
  return refs;
}
export const rectsOverlap = (a: Rect, b: Rect) => a.r1 <= b.r2 && b.r1 <= a.r2 && a.c1 <= b.c2 && b.c1 <= a.c2;
export const rectContains = (rect: Rect, row: number, col: number) => row >= rect.r1 && row <= rect.r2 && col >= rect.c1 && col <= rect.c2;

/** The merged range that covers a cell, if any. */
export function mergeAt(merges: string[], row: number, col: number): Rect | null {
  for (const range of merges) { const rect = parseRange(range); if (rect && rectContains(rect, row, col)) return rect; }
  return null;
}
/** A selection grows to take in every merged range it touches, as in Excel. */
export function expandForMerges(rect: Rect, merges: string[]): Rect {
  let current = { ...rect }, changed = true;
  while (changed) {
    changed = false;
    for (const range of merges) {
      const merged = parseRange(range);
      if (!merged || !rectsOverlap(current, merged)) continue;
      const next = { r1: Math.min(current.r1, merged.r1), c1: Math.min(current.c1, merged.c1), r2: Math.max(current.r2, merged.r2), c2: Math.max(current.c2, merged.c2) };
      if (next.r1 !== current.r1 || next.c1 !== current.c1 || next.r2 !== current.r2 || next.c2 !== current.c2) { current = next; changed = true; }
    }
  }
  return current;
}

/**
 * Merge a rectangle (Merge & Center / Merge Cells), or each of its rows (Merge Across). Merged ranges it
 * overlaps are replaced. As in Excel, only the upper-left value stays: the others are cleared, and
 * `discarded` tells the caller to warn about it.
 */
export function mergeRanges(cells: Record<string, SheetCell>, merges: string[], rect: Rect, across: boolean) {
  const targets: Rect[] = across ? Array.from({ length: rect.r2 - rect.r1 + 1 }, (_, i) => ({ r1: rect.r1 + i, c1: rect.c1, r2: rect.r1 + i, c2: rect.c2 })) : [rect];
  const nextCells = { ...cells };
  let discarded = false;
  for (const target of targets) {
    if (target.r1 === target.r2 && target.c1 === target.c2) continue;
    rectRefs(target).forEach((ref, index) => {
      if (index === 0) return;
      const cell = nextCells[ref];
      if (cell && (cell.value !== null || cell.formula)) { discarded = true; nextCells[ref] = { ...cell, value: null, formula: null }; }
    });
  }
  const kept = merges.filter((range) => { const merged = parseRange(range); return !merged || !rectsOverlap(merged, rect); });
  const added = targets.filter((target) => target.r1 !== target.r2 || target.c1 !== target.c2).map(rangeString);
  return { cells: nextCells, merges: [...kept, ...added], discarded };
}
export function unmergeRanges(merges: string[], rect: Rect) {
  return merges.filter((range) => { const merged = parseRange(range); return !merged || !rectsOverlap(merged, rect); });
}

/** What a typed entry becomes: a formula, a number or text. */
export function parseEntry(raw: string): { value: string | number | null; formula: string | null } {
  if (raw.startsWith("=") && raw.length > 1) return { value: null, formula: raw };
  const trimmed = raw.trim();
  if (trimmed === "") return { value: null, formula: null };
  const numeric = trimmed.replace(/,/g, "");
  if (/^-?\d+(\.\d+)?$/.test(numeric)) return { value: Number(numeric), formula: null };
  if (/^-?\d+(\.\d+)?%$/.test(numeric)) return { value: Number(numeric.slice(0, -1)) / 100, formula: null };
  return { value: raw.slice(0, 1000), formula: null };
}

/** Every formula cell's value worked out again (formulas depend on other cells). */
export function recomputeFormulas(cells: Record<string, SheetCell>): Record<string, SheetCell> {
  const plain: SheetCells = Object.fromEntries(Object.entries(cells).map(([ref, cell]) => [ref, { value: cell.value, formula: cell.formula }]));
  let changed = false;
  const next: Record<string, SheetCell> = {};
  for (const [ref, cell] of Object.entries(cells)) {
    if (!cell.formula) { next[ref] = cell; continue; }
    const value = computedCellValue(ref, plain);
    const stored = typeof value === "string" ? value.slice(0, 1000) : value;
    if (stored !== cell.value) changed = true;
    next[ref] = { ...cell, value: stored };
  }
  return changed ? next : cells;
}

/** A cell with nothing in it and no formatting is left out of the saved sheet. */
export function isBlankCell(cell: SheetCell) {
  return cell.value === null && !cell.formula && !cell.bold && !cell.italic && !cell.underline && !cell.fontColor && !cell.fillColor && !cell.border
    && (cell.numberFormat ?? "General") === "General" && !cell.align && !cell.fontSize && !cell.fontFamily && !cell.vAlign && !cell.wrap && !cell.rotate && !cell.indent && !cell.strike && cell.decimals == null;
}

/** Insert (delta 1) or delete (delta -1) a row; cells and merged ranges below move. */
export function shiftRows(cells: Record<string, SheetCell>, merges: string[], at: number, delta: 1 | -1) {
  const next: Record<string, SheetCell> = {};
  for (const [ref, cell] of Object.entries(cells)) {
    const parsed = parseRef(ref); if (!parsed) continue;
    if (delta < 0 && parsed.row === at) continue;
    const row = parsed.row >= at && !(delta < 0 && parsed.row === at) ? parsed.row + delta : parsed.row;
    if (row >= 1 && row <= MAX_ROWS) next[refAt(row, parsed.col)] = cell;
  }
  const nextMerges = merges.flatMap((range) => {
    const rect = parseRange(range); if (!rect) return [];
    if (delta < 0 && rect.r1 === at && rect.r2 === at) return [];
    const r1 = rect.r1 > at || (delta > 0 && rect.r1 === at) ? rect.r1 + delta : rect.r1;
    const r2 = rect.r2 >= at ? rect.r2 + delta : rect.r2;
    const moved = { ...rect, r1, r2: Math.max(r1, r2) };
    return moved.r1 === moved.r2 && moved.c1 === moved.c2 ? [] : [rangeString(moved)];
  });
  return { cells: next, merges: nextMerges };
}
export function shiftColumns(cells: Record<string, SheetCell>, merges: string[], at: number, delta: 1 | -1) {
  const next: Record<string, SheetCell> = {};
  for (const [ref, cell] of Object.entries(cells)) {
    const parsed = parseRef(ref); if (!parsed) continue;
    if (delta < 0 && parsed.col === at) continue;
    const col = parsed.col >= at && !(delta < 0 && parsed.col === at) ? parsed.col + delta : parsed.col;
    if (col >= 0 && col < MAX_COLS) next[refAt(parsed.row, col)] = cell;
  }
  const nextMerges = merges.flatMap((range) => {
    const rect = parseRange(range); if (!rect) return [];
    if (delta < 0 && rect.c1 === at && rect.c2 === at) return [];
    const c1 = rect.c1 > at || (delta > 0 && rect.c1 === at) ? rect.c1 + delta : rect.c1;
    const c2 = rect.c2 >= at ? rect.c2 + delta : rect.c2;
    const moved = { ...rect, c1, c2: Math.max(c1, Math.min(c2, MAX_COLS - 1)) };
    return moved.r1 === moved.r2 && moved.c1 === moved.c2 ? [] : [rangeString(moved)];
  });
  return { cells: next, merges: nextMerges };
}

/** Rows and columns the saved sheet needs: everything used, never fewer than the starting sheet had. */
export function usedExtent(cells: Record<string, SheetCell>, merges: string[], sheet: SheetSettings, minRows: number, minCols: number) {
  let rows = minRows, cols = minCols;
  for (const [ref, cell] of Object.entries(cells)) { if (isBlankCell(cell)) continue; const parsed = parseRef(ref); if (parsed) { rows = Math.max(rows, parsed.row); cols = Math.max(cols, parsed.col + 1); } }
  for (const range of [...merges, ...(sheet.printArea ? [sheet.printArea] : [])]) { const rect = parseRange(range); if (rect) { rows = Math.max(rows, rect.r2); cols = Math.max(cols, rect.c2 + 1); } }
  return { rows: Math.min(Math.max(rows, 1), MAX_ROWS), cols: Math.min(Math.max(cols, 1), MAX_COLS) };
}

// Borders: "all" thin lines, or per side with t/r/b/l (upper case = thick), e.g. "tb" or "TRBL".
export type BorderStyle = "all" | "outside" | "thickBox" | "bottom" | "top" | "left" | "right" | "none";
export function applyBorder(cells: Record<string, SheetCell>, rect: Rect, style: BorderStyle): Record<string, SheetCell> {
  const next = { ...cells };
  for (let row = rect.r1; row <= rect.r2; row++) for (let col = rect.c1; col <= rect.c2; col++) {
    const ref = refAt(row, col), cell = next[ref] ?? EMPTY_CELL;
    const sides = new Set((cell.border && /^[tlbrTLBR]+$/.test(cell.border) ? cell.border : cell.border ? "tlbr" : "").split("").filter(Boolean));
    const edge = { t: row === rect.r1, b: row === rect.r2, l: col === rect.c1, r: col === rect.c2 };
    const set = (side: "t" | "r" | "b" | "l", thick = false) => { sides.delete(side); sides.delete(side.toUpperCase()); sides.add(thick ? side.toUpperCase() : side); };
    if (style === "none") sides.clear();
    else if (style === "all") (["t", "r", "b", "l"] as const).forEach((side) => set(side));
    else if (style === "outside" || style === "thickBox") (Object.keys(edge) as ("t" | "r" | "b" | "l")[]).forEach((side) => { if (edge[side]) set(side, style === "thickBox"); });
    else { const side = style[0] as "t" | "r" | "b" | "l"; if (edge[side]) set(side); }
    const order = ["t", "r", "b", "l"];
    const value = [...sides].sort((a, b) => order.indexOf(a.toLowerCase()) - order.indexOf(b.toLowerCase())).join("");
    next[ref] = { ...cell, border: value || null };
  }
  return next;
}
/** CSS for a cell's border value (older sheets kept a CSS string). */
export function borderCss(border: string | null | undefined): Record<string, string> {
  if (!border) return {};
  if (!/^[tlbrTLBR]+$/.test(border)) return { border };
  const css: Record<string, string> = {};
  const names = { t: "borderTop", r: "borderRight", b: "borderBottom", l: "borderLeft" } as const;
  for (const char of border) css[names[char.toLowerCase() as "t" | "r" | "b" | "l"]] = `${char === char.toUpperCase() ? 2 : 1}px solid #000`;
  return css;
}

/** Number shown in a cell for its number format. */
export function formatCellValue(value: unknown, format: SheetCell["numberFormat"] | null | undefined, decimals?: number | null): string {
  if (typeof value !== "number") return value == null ? "" : String(value);
  const places = decimals ?? (format === "General" || !format ? null : 2);
  if (format === "Currency") return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: places ?? 2, maximumFractionDigits: places ?? 2 })}`;
  if (format === "Percentage") return `${(value * 100).toFixed(places ?? 2)}%`;
  if (format === "Number") return value.toLocaleString("en-IN", { minimumFractionDigits: places ?? 2, maximumFractionDigits: places ?? 2 });
  if (places !== null) return value.toFixed(places);
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1e9) / 1e9);
}

/** The cells just above (or else just left of) a cell that hold numbers, for AutoSum. */
export function autoSumRange(cells: Record<string, SheetCell>, row: number, col: number): string | null {
  const numberAt = (r: number, c: number) => { const cell = cells[refAt(r, c)]; return cell && (typeof cell.value === "number") ; };
  let top = row - 1; while (top >= 1 && !numberAt(top, col)) { if (cells[refAt(top, col)]?.value != null) break; top--; }
  if (top >= 1 && numberAt(top, col)) { let start = top; while (start - 1 >= 1 && numberAt(start - 1, col)) start--; return `${refAt(start, col)}:${refAt(top, col)}`; }
  let left = col - 1; while (left >= 0 && !numberAt(row, left)) { if (cells[refAt(row, left)]?.value != null) break; left--; }
  if (left >= 0 && numberAt(row, left)) { let start = left; while (start - 1 >= 0 && numberAt(row, start - 1)) start--; return `${refAt(row, start)}:${refAt(row, left)}`; }
  return null;
}

/** Header/footer codes shown as Excel shows them on a printed page. */
export function previewHeaderText(text: string | undefined, page = 1, pages = 1) {
  return (text ?? "").replace(/&\[Page\]/gi, String(page)).replace(/&\[Pages\]/gi, String(pages)).replace(/&\[Date\]/gi, new Date().toLocaleDateString("en-IN")).replace(/&\[Time\]/gi, new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })).replace(/&\[File\]/gi, "Book1").replace(/&\[Tab\]/gi, "Sheet1");
}
