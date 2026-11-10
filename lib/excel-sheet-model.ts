// Pure helpers behind the Excel Efficiency workspace: cell references and ranges, merged cells, inserting
// and deleting rows/columns, formula values, borders and the used part of a sheet.
import { columnIndex, columnLetters, computedCellValue, serialToDate, type FormulaCache, type SheetCells } from "./excel-formula.ts";
import type { ConditionalFormat, ConditionalStyle, SheetCell, SheetSettings } from "./excel-document.ts";

export type Rect = { r1: number; c1: number; r2: number; c2: number };
export const MAX_ROWS = 500, MAX_COLS = 26;
export const DEFAULT_FONT = "Calibri", DEFAULT_FONT_SIZE = 11;
export const EMPTY_CELL: SheetCell = { value: null, formula: null, bold: false, italic: false, underline: false, fontColor: null, fillColor: null, border: null, numberFormat: "General", align: null };
export const STYLE_KEYS = ["bold", "italic", "underline", "fontColor", "fillColor", "border", "numberFormat", "align", "fontSize", "fontFamily", "vAlign", "wrap", "rotate", "indent", "strike", "decimals", "underlineStyle", "vertAlign", "shrink", "currency", "locked", "hiddenFormula"] as const;

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

const VOLATILE_FORMULA_RE = /\b(NOW|TODAY)\s*\(/;
const REF_TOKEN_RE = /\$?[A-Z]{1,2}\$?[0-9]{1,3}(?::\$?[A-Z]{1,2}\$?[0-9]{1,3})?/g;
/** Whether a formula's text reads `ref` -- as a lone cell, or inside an A1:B2-style range. */
function formulaReferencesCell(formula: string, ref: { row: number; col: number }): boolean {
  for (const token of formula.match(REF_TOKEN_RE) ?? []) {
    if (token.includes(":")) {
      const range = parseRange(token);
      if (range && ref.row >= range.r1 && ref.row <= range.r2 && ref.col >= range.c1 && ref.col <= range.c2) return true;
    } else {
      const at = parseRef(token);
      if (at && at.row === ref.row && at.col === ref.col) return true;
    }
  }
  return false;
}

/** Every formula cell's value worked out again (formulas depend on other cells).
 * `touchedRefs`, when given, is the set of cells this edit actually changed (a single typed cell, a fill, a
 * paste...): only formulas that read one of them -- or, in later rounds, a cell whose own value just changed
 * because of them -- are re-evaluated, instead of every formula cell in the sheet. This is a large win on a
 * sheet with thousands of formula cells (e.g. a 500-row paper), where the overwhelming majority of formulas
 * cannot possibly be affected by a single edit. Left out (or if the sheet has a volatile function -- NOW/TODAY,
 * whose value can change without any cell being touched), every formula cell is recomputed, as before. */
export function recomputeFormulas(cells: Record<string, SheetCell>, names?: Record<string, string>, touchedRefs?: Iterable<string>): Record<string, SheetCell> {
  const plain: SheetCells = Object.fromEntries(Object.entries(cells).map(([ref, cell]) => [ref, { value: cell.value, formula: cell.formula }]));
  let changed = false;
  const next: Record<string, SheetCell> = {};
  const cache: FormulaCache = new Map();
  let pending = touchedRefs ? new Set(touchedRefs) : null;
  if (pending) for (const cell of Object.values(cells)) if (cell.formula && VOLATILE_FORMULA_RE.test(cell.formula)) { pending = null; break; }
  if (!pending) {
    for (const [ref, cell] of Object.entries(cells)) {
      if (!cell.formula) { next[ref] = cell; continue; }
      const value = computedCellValue(ref, plain, names, cache);
      const stored = typeof value === "string" ? value.slice(0, 1000) : value;
      if (stored !== cell.value) changed = true;
      next[ref] = { ...cell, value: stored };
    }
    return changed ? next : cells;
  }
  for (const [ref, cell] of Object.entries(cells)) next[ref] = cell;
  let round = 0;
  while (pending.size && round < 20) {
    round++;
    const parsedPending = [...pending].map(parseRef).filter((p): p is { row: number; col: number } => p !== null);
    const newlyChanged = new Set<string>();
    for (const [ref, cell] of Object.entries(next)) {
      if (!cell.formula || !parsedPending.some((p) => formulaReferencesCell(cell.formula!, p))) continue;
      const value = computedCellValue(ref, plain, names, cache);
      const stored = typeof value === "string" ? value.slice(0, 1000) : value;
      if (stored !== cell.value) { changed = true; next[ref] = { ...cell, value: stored }; newlyChanged.add(ref); }
    }
    pending = newlyChanged;
  }
  return changed ? next : cells;
}

/** A cell with nothing in it and no formatting is left out of the saved sheet. */
export function isBlankCell(cell: SheetCell) {
  return cell.value === null && !cell.formula && !cell.bold && !cell.italic && !cell.underline && !cell.fontColor && !cell.fillColor && !cell.border
    && (cell.numberFormat ?? "General") === "General" && !cell.align && !cell.fontSize && !cell.fontFamily && !cell.vAlign && !cell.wrap && !cell.rotate && !cell.indent && !cell.strike && cell.decimals == null && !cell.comment
    && !cell.underlineStyle && !cell.vertAlign && cell.locked == null && !cell.hiddenFormula && !cell.link && !cell.shrink && !cell.currency;
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

// Borders per side, one token each: the side (t/r/b/l, u = diagonal up "/", d = diagonal down "\\"), then an optional
// line mark, then an optional "@RRGGBB" colour (none = Automatic, black). A lower-case side with no mark is a thin
// line, an upper-case one a medium line (the menu's "Thick Box" and "Thick Bottom", as in Excel), "=" a double line
// -- so sheets saved before the Format Cells Border tab, and the marking rules written for them, read the same
// (e.g. "tb=" = thin top, double bottom). The other Excel line styles: "!" thick, ":" hair, "." dotted, "-" dashed,
// "~" dash-dot, "^" dash-dot-dot (upper case: the medium ones), "/" slanted dash-dot. Older sheets kept a CSS string.
export type BorderStyle = "all" | "outside" | "thickBox" | "bottom" | "top" | "left" | "right" | "none"
  | "bottomDouble" | "thickBottom" | "topBottom" | "topThickBottom" | "topDoubleBottom";
export type BorderLineStyle = "hair" | "dotted" | "dashDotDot" | "dashDot" | "dashed" | "thin"
  | "mediumDashDotDot" | "slantDashDot" | "mediumDashDot" | "mediumDashed" | "medium" | "thick" | "double";
export type BorderLine = { style: BorderLineStyle; color: string | null };
/** The lines of the Format Cells Border tab: the outline, the lines between cells, and the two diagonals. */
export type BorderEdge = "top" | "bottom" | "left" | "right" | "insideH" | "insideV" | "diagUp" | "diagDown";
type Side = "t" | "r" | "b" | "l" | "u" | "d";
const SIDE_ORDER: Side[] = ["t", "r", "b", "l", "u", "d"];
const LINE_CODES: [BorderLineStyle, boolean, string][] = [
  ["thin", false, ""], ["medium", true, ""], ["double", false, "="], ["thick", false, "!"], ["hair", false, ":"], ["dotted", false, "."],
  ["dashed", false, "-"], ["dashDot", false, "~"], ["dashDotDot", false, "^"], ["mediumDashed", true, "-"], ["mediumDashDot", true, "~"],
  ["mediumDashDotDot", true, "^"], ["slantDashDot", true, "/"],
];
const BORDER_TOKENS = /^(?:[trbludTRBLUD][=!:.\-~^/]?(?:@[0-9A-Fa-f]{6})?)+$/;
const sameLine = (a: BorderLine | null | undefined, b: BorderLine | null | undefined) => (a ?? null) === (b ?? null) || (Boolean(a && b) && a!.style === b!.style && a!.color === b!.color);
function borderSides(border: string | null | undefined): Map<Side, BorderLine> {
  const sides = new Map<Side, BorderLine>();
  if (!border) return sides;
  if (!BORDER_TOKENS.test(border)) { (["t", "r", "b", "l"] as Side[]).forEach((side) => sides.set(side, { style: "thin", color: null })); return sides; }
  for (const [, char, mark, color] of border.matchAll(/([trbludTRBLUD])([=!:.\-~^/]?)(?:@([0-9A-Fa-f]{6}))?/g)) {
    const upper = char !== char.toLowerCase();
    const style = LINE_CODES.find(([, medium, code]) => medium === upper && code === mark)?.[0] ?? (upper ? "medium" : "thin");
    sides.set(char.toLowerCase() as Side, { style, color: color ? color.toUpperCase() : null });
  }
  return sides;
}
function borderString(sides: Map<Side, BorderLine>) {
  const token = (side: Side, line: BorderLine, withColor: boolean) => {
    const [, medium, code] = LINE_CODES.find(([style]) => style === line.style) ?? LINE_CODES[0];
    return (medium ? side.toUpperCase() : side) + code + (withColor && line.color && line.color !== "000000" ? `@${line.color}` : "");
  };
  const used = SIDE_ORDER.filter((side) => sides.has(side));
  const text = used.map((side) => token(side, sides.get(side)!, true)).join("");
  // A saved border is at most 50 characters; six coloured sides would pass that, so the colours give way first.
  return (text.length <= 50 ? text : used.map((side) => token(side, sides.get(side)!, false)).join("")) || null;
}
export function applyBorder(cells: Record<string, SheetCell>, rect: Rect, style: BorderStyle): Record<string, SheetCell> {
  const next = { ...cells };
  for (let row = rect.r1; row <= rect.r2; row++) for (let col = rect.c1; col <= rect.c2; col++) {
    const ref = refAt(row, col), cell = next[ref] ?? EMPTY_CELL;
    const sides = borderSides(cell.border);
    const edge: Record<Side, boolean> = { t: row === rect.r1, b: row === rect.r2, l: col === rect.c1, r: col === rect.c2, u: false, d: false };
    const set = (side: Side, kind: BorderLineStyle = "thin") => { if (edge[side]) sides.set(side, { style: kind, color: null }); };
    if (style === "none") sides.clear();
    else if (style === "all") (["t", "r", "b", "l"] as Side[]).forEach((side) => sides.set(side, { style: "thin", color: null }));
    else if (style === "outside" || style === "thickBox") (["t", "r", "b", "l"] as Side[]).forEach((side) => set(side, style === "thickBox" ? "medium" : "thin"));
    else if (style === "bottomDouble") set("b", "double");
    else if (style === "thickBottom") set("b", "medium");
    else if (style === "topBottom") { set("t"); set("b"); }
    else if (style === "topThickBottom") { set("t"); set("b", "medium"); }
    else if (style === "topDoubleBottom") { set("t"); set("b", "double"); }
    else set(style[0] as Side);
    next[ref] = { ...cell, border: borderString(sides) };
  }
  return next;
}
// Which cell sides carry each line of the Border tab: the outline is drawn on the cells at the edge, a line between
// cells on both of its neighbours (as All Borders does), a diagonal in every cell.
function edgeSides(edge: BorderEdge, rect: Rect, row: number, col: number): Side[] {
  if (edge === "top") return row === rect.r1 ? ["t"] : [];
  if (edge === "bottom") return row === rect.r2 ? ["b"] : [];
  if (edge === "left") return col === rect.c1 ? ["l"] : [];
  if (edge === "right") return col === rect.c2 ? ["r"] : [];
  if (edge === "insideH") return [...(row > rect.r1 ? ["t" as Side] : []), ...(row < rect.r2 ? ["b" as Side] : [])];
  if (edge === "insideV") return [...(col > rect.c1 ? ["l" as Side] : []), ...(col < rect.c2 ? ["r" as Side] : [])];
  return [edge === "diagUp" ? "u" : "d"];
}
const EDGES: BorderEdge[] = ["top", "bottom", "left", "right", "insideH", "insideV", "diagUp", "diagDown"];
/** The Border tab's lines as the selection has them; a line that differs from cell to cell is left out (Excel greys it). */
export function readBorderLines(cells: Record<string, SheetCell>, rect: Rect): Partial<Record<BorderEdge, BorderLine | null>> {
  const lines: Partial<Record<BorderEdge, BorderLine | null>> = {};
  for (const edge of EDGES) {
    let found: BorderLine | null | undefined, mixed = false;
    for (let row = rect.r1; row <= rect.r2 && !mixed; row++) for (let col = rect.c1; col <= rect.c2 && !mixed; col++) {
      const sides = borderSides(cells[refAt(row, col)]?.border);
      for (const side of edgeSides(edge, rect, row, col)) {
        const line = sides.get(side) ?? null;
        if (found === undefined) found = line; else if (!sameLine(found, line)) mixed = true;
      }
    }
    if (!mixed && found !== undefined) lines[edge] = found;
  }
  return lines;
}
/** Draws (or, with null, removes) the given lines of the Border tab on the selection; lines not given stay as they are. */
export function applyBorderLines(cells: Record<string, SheetCell>, rect: Rect, lines: Partial<Record<BorderEdge, BorderLine | null>>): Record<string, SheetCell> {
  const next = { ...cells };
  const edges = EDGES.filter((edge) => edge in lines);
  if (!edges.length) return next;
  for (let row = rect.r1; row <= rect.r2; row++) for (let col = rect.c1; col <= rect.c2; col++) {
    const ref = refAt(row, col), cell = next[ref] ?? EMPTY_CELL;
    const sides = borderSides(cell.border);
    for (const edge of edges) for (const side of edgeSides(edge, rect, row, col)) { const line = lines[edge]; if (line) sides.set(side, { style: line.style, color: line.color }); else sides.delete(side); }
    const border = borderString(sides);
    if (border !== (cell.border ?? null)) next[ref] = { ...cell, border };
  }
  return next;
}
const LINE_CSS: Record<BorderLineStyle, string> = {
  hair: "1px dotted", dotted: "1px dotted", dashDotDot: "1px dashed", dashDot: "1px dashed", dashed: "1px dashed", thin: "1px solid",
  mediumDashDotDot: "2px dashed", slantDashDot: "2px dashed", mediumDashDot: "2px dashed", mediumDashed: "2px dashed", medium: "2px solid", thick: "3px solid", double: "3px double",
};
/** CSS for a cell's border value. */
export function borderCss(border: string | null | undefined): Record<string, string> {
  if (!border) return {};
  // Per side, never the "border" shorthand: the cell style also sets borderRight / borderBottom (gridlines), and
  // React warns when a shorthand and its parts are mixed in one style.
  if (!BORDER_TOKENS.test(border)) return { borderTop: border, borderRight: border, borderBottom: border, borderLeft: border };
  const css: Record<string, string> = {};
  const names = { t: "borderTop", r: "borderRight", b: "borderBottom", l: "borderLeft" } as const;
  for (const [side, line] of borderSides(border)) if (side !== "u" && side !== "d") css[names[side]] = `${LINE_CSS[line.style]} #${line.color ?? "000"}`;
  return css;
}
/** Background images drawing a cell's diagonal borders (none when it has no diagonal). */
export function borderDiagonals(border: string | null | undefined): string[] {
  if (!border || !BORDER_TOKENS.test(border)) return [];
  const sides = borderSides(border), images: string[] = [];
  for (const [side, direction] of [["u", "to top right"], ["d", "to bottom right"]] as const) {
    const line = sides.get(side);
    if (!line) continue;
    const half = line.style === "thick" || line.style === "double" ? 1.5 : line.style.startsWith("medium") || line.style === "slantDashDot" ? 1 : 0.6;
    const color = `#${line.color ?? "000"}`;
    images.push(`linear-gradient(${direction}, transparent calc(50% - ${half}px), ${color} calc(50% - ${half}px), ${color} calc(50% + ${half}px), transparent calc(50% + ${half}px))`);
  }
  return images;
}

/** Number shown in a cell for its number format (and currency symbol for Currency / Accounting). */
export function formatCellValue(value: unknown, format: SheetCell["numberFormat"] | null | undefined, decimals?: number | null, currency?: string | null): string {
  if (typeof value !== "number") return value == null ? "" : String(value);
  const places = decimals ?? (format === "General" || !format ? null : 2);
  const symbol = currency ?? "₹";
  const grouped = (n: number) => n.toLocaleString(symbol === "₹" ? "en-IN" : "en-US", { minimumFractionDigits: places ?? 2, maximumFractionDigits: places ?? 2 });
  if (format === "Text") return String(value);
  if (format === "ShortDate" || format === "LongDate" || format === "Time") {
    const date = serialToDate(value);
    if (format === "Time") return date.toLocaleTimeString("en-IN", { timeZone: "UTC", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).toUpperCase();
    if (format === "LongDate") return date.toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return date.toLocaleDateString("en-GB", { timeZone: "UTC" }).split("/").join("-");
  }
  if (format === "Accounting") return value < 0 ? `${symbol} (${grouped(-value)})` : `${symbol} ${grouped(value)}`;
  if (format === "Currency") return value < 0 ? `-${symbol}${grouped(-value)}` : `${symbol}${grouped(value)}`;
  if (format === "Percentage") return `${(value * 100).toFixed(places ?? 2)}%`;
  if (format === "Number") return value.toLocaleString("en-IN", { minimumFractionDigits: places ?? 2, maximumFractionDigits: places ?? 2 });
  if (format === "Scientific") { const [mantissa, exponent] = value.toExponential(places ?? 2).split("e"); const e = Number(exponent); return `${mantissa}E${e < 0 ? "-" : "+"}${String(Math.abs(e)).padStart(2, "0")}`; }
  if (format === "Fraction") {
    // Excel's "Up to one digit" fraction: the nearest n/d with d from 1 to 9.
    const sign = value < 0 ? "-" : "", whole = Math.floor(Math.abs(value)), rest = Math.abs(value) - whole;
    let best = { n: 0, d: 1, error: rest };
    for (let d = 1; d <= 9; d++) { const n = Math.round(rest * d); const error = Math.abs(rest - n / d); if (error < best.error - 1e-12) best = { n, d, error }; }
    if (best.n === best.d) return `${sign}${whole + 1}`;
    if (best.n === 0) return `${sign}${whole}`;
    return `${sign}${whole ? `${whole} ` : ""}${best.n}/${best.d}`;
  }
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

/** Excel's current region: the block of filled cells around a cell, bounded by empty rows and columns. */
export function currentRegion(cells: Record<string, SheetCell>, row: number, col: number): Rect {
  const filled = (r: number, c: number) => { const cell = cells[refAt(r, c)]; return Boolean(cell && (cell.value !== null || cell.formula)); };
  let rect: Rect = { r1: row, c1: col, r2: row, c2: col }, grew = true;
  while (grew) {
    grew = false;
    const rowHas = (r: number) => { for (let c = Math.max(0, rect.c1 - 1); c <= Math.min(MAX_COLS - 1, rect.c2 + 1); c++) if (filled(r, c)) return true; return false; };
    const colHas = (c: number) => { for (let r = Math.max(1, rect.r1 - 1); r <= Math.min(MAX_ROWS, rect.r2 + 1); r++) if (filled(r, c)) return true; return false; };
    if (rect.r1 > 1 && rowHas(rect.r1 - 1)) { rect = { ...rect, r1: rect.r1 - 1 }; grew = true; }
    if (rect.r2 < MAX_ROWS && rowHas(rect.r2 + 1)) { rect = { ...rect, r2: rect.r2 + 1 }; grew = true; }
    if (rect.c1 > 0 && colHas(rect.c1 - 1)) { rect = { ...rect, c1: rect.c1 - 1 }; grew = true; }
    if (rect.c2 < MAX_COLS - 1 && colHas(rect.c2 + 1)) { rect = { ...rect, c2: rect.c2 + 1 }; grew = true; }
  }
  return rect;
}

// Conditional Formatting with Excel's preset formats: Highlight Cells / Top-Bottom rules colour the cell; Data Bars,
// Color Scales and Icon Sets draw a bar, a colour or an icon that depends on the value's place in the range.
export const CONDITIONAL_STYLES: Record<ConditionalStyle, { label: string; fill?: string; font?: string; border?: string; bar?: string; scale?: string[]; icons?: string[] }> = {
  lightRedDarkRed: { label: "Light Red Fill with Dark Red Text", fill: "FFC7CE", font: "9C0006" },
  yellowDarkYellow: { label: "Yellow Fill with Dark Yellow Text", fill: "FFEB9C", font: "9C5700" },
  greenDarkGreen: { label: "Green Fill with Dark Green Text", fill: "C6EFCE", font: "006100" },
  lightRed: { label: "Light Red Fill", fill: "FFC7CE" },
  redText: { label: "Red Text", font: "9C0006" },
  redBorder: { label: "Red Border", border: "1px solid #C00000" },
  blueBar: { label: "Blue Data Bar", bar: "638EC6" },
  greenBar: { label: "Green Data Bar", bar: "63BE7B" },
  redBar: { label: "Red Data Bar", bar: "F8696B" },
  orangeBar: { label: "Orange Data Bar", bar: "FFB628" },
  greenYellowRed: { label: "Green - Yellow - Red Color Scale", scale: ["F8696B", "FFEB84", "63BE7B"] },
  redYellowGreen: { label: "Red - Yellow - Green Color Scale", scale: ["63BE7B", "FFEB84", "F8696B"] },
  greenWhite: { label: "Green - White Color Scale", scale: ["FCFCFF", "63BE7B"] },
  redWhite: { label: "Red - White Color Scale", scale: ["FCFCFF", "F8696B"] },
  arrows3: { label: "3 Arrows (Colored)", icons: ["↓", "→", "↑"] },
  trafficLights3: { label: "3 Traffic Lights", icons: ["●r", "●y", "●g"] },
};
export const HIGHLIGHT_STYLES: ConditionalStyle[] = ["lightRedDarkRed", "yellowDarkYellow", "greenDarkGreen", "lightRed", "redText", "redBorder"];
export type ConditionalLook = { fill?: string; font?: string; border?: string; bar?: { color: string; percent: number }; icon?: string };
const mix = (a: string, b: string, t: number) => [0, 2, 4].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("").toUpperCase();
/** How conditional formatting shows a cell (the first matching rule wins, as in Excel's rule order). */
export function conditionalStyleAt(cells: Record<string, SheetCell>, rules: ConditionalFormat[] | undefined, row: number, col: number): ConditionalLook | null {
  if (!rules?.length) return null;
  // As in Excel, a data bar, an icon and a colour scale show together with a highlight rule's format.
  const value = cells[refAt(row, col)]?.value ?? null;
  const look: ConditionalLook = {};
  let highlighted = false;
  for (const rule of rules) {
    const rect = parseRange(rule.range);
    if (!rect || !rectContains(rect, row, col)) continue;
    const values = () => rectRefs(rect).map((ref) => cells[ref]?.value ?? null);
    const style = CONDITIONAL_STYLES[rule.style];
    if (rule.type === "dataBar" || rule.type === "colorScale" || rule.type === "iconSet") {
      if (typeof value !== "number") continue;
      const numbers = values().filter((v): v is number => typeof v === "number");
      const min = Math.min(...numbers), max = Math.max(...numbers), t = max === min ? 1 : (value - min) / (max - min);
      if (rule.type === "dataBar" && style.bar && !look.bar) look.bar = { color: style.bar, percent: Math.max(8, Math.round(t * 100)) };
      if (rule.type === "colorScale" && style.scale && !look.fill) { const stops = style.scale; look.fill = stops.length === 2 ? mix(stops[0], stops[1], t) : t < 0.5 ? mix(stops[0], stops[1], t * 2) : mix(stops[1], stops[2], (t - 0.5) * 2); }
      if (rule.type === "iconSet" && style.icons && !look.icon) look.icon = style.icons[t >= 2 / 3 ? 2 : t >= 1 / 3 ? 1 : 0];
      continue;
    }
    if (!highlighted && conditionalMatches(rule, value, values)) { highlighted = true; if (style.fill) look.fill = style.fill; look.font = style.font; look.border = style.border; }
  }
  return look.fill || look.font || look.border || look.bar || look.icon ? look : null;
}
export function conditionalMatches(rule: ConditionalFormat, value: string | number | null, rangeValues: () => (string | number | null)[]) {
  if (value === null || value === "") return false;
  const num = (v: unknown) => (typeof v === "number" ? v : v != null && String(v).trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
  const x = num(value), a = num(rule.value), b = num(rule.value2);
  const numbers = () => rangeValues().filter((v): v is number => typeof v === "number");
  switch (rule.type) {
    case "greaterThan": return x !== null && a !== null && x > a;
    case "lessThan": return x !== null && a !== null && x < a;
    case "between": return x !== null && a !== null && b !== null && x >= Math.min(a, b) && x <= Math.max(a, b);
    case "equalTo": return a !== null && x !== null ? x === a : String(value).toLowerCase() === String(rule.value ?? "").toLowerCase();
    case "textContains": return String(rule.value ?? "") !== "" && String(value).toLowerCase().includes(String(rule.value).toLowerCase());
    case "duplicate": case "unique": { const key = String(value).toLowerCase(); const count = rangeValues().filter((v) => v !== null && String(v).toLowerCase() === key).length; return rule.type === "duplicate" ? count > 1 : count === 1; }
    case "top": case "bottom": case "topPercent": case "bottomPercent": {
      if (typeof value !== "number") return false;
      const list = numbers().sort((p, q) => (rule.type.startsWith("top") ? q - p : p - q));
      const n = a ?? 10, count = rule.type.endsWith("Percent") ? Math.max(1, Math.floor((list.length * n) / 100)) : n;
      const edge = list[Math.min(list.length, Math.max(1, Math.floor(count))) - 1];
      return edge !== undefined && (rule.type.startsWith("top") ? value >= edge : value <= edge);
    }
    case "aboveAverage": case "belowAverage": { if (typeof value !== "number") return false; const list = numbers(); const average = list.reduce((p, q) => p + q, 0) / (list.length || 1); return rule.type === "aboveAverage" ? value > average : value < average; }
  }
  return false;
}

/** A formula moved by rows/columns, as Excel adjusts relative references when it fills or pastes ($ parts stay). */
export function shiftFormula(formula: string | null, dRow: number, dCol: number): string | null {
  if (!formula || (dRow === 0 && dCol === 0)) return formula;
  return formula.replace(/("(?:[^"]|"")*")|(?<![A-Za-z0-9_$])(\$?)([A-Za-z]{1,2})(\$?)([0-9]{1,3})(?![A-Za-z0-9_(])/g, (match, quoted: string | undefined, colAbs: string, letters: string, rowAbs: string, digits: string) => {
    if (quoted) return match;
    const col = colAbs ? columnIndex(letters) : columnIndex(letters) + dCol, row = rowAbs ? Number(digits) : Number(digits) + dRow;
    if (col < 0 || row < 1) return "#REF!";
    return `${colAbs}${columnLetters(col)}${rowAbs}${row}`;
  });
}
