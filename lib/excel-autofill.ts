import type { SheetCell } from "./excel-document.ts";
import { EMPTY_CELL, MAX_COLS, MAX_ROWS, refAt, shiftFormula, type Rect } from "./excel-sheet-model.ts";

// Excel's fill handle: the small square at the bottom-right corner of the selection. Dragging it (or double-clicking
// it, which fills down as far as the data next to it goes) fills the cells beyond the selection from the selected
// ones, the way Excel's AutoFill does:
//   - a formula is copied with its relative references moved ($A$1 stays), so =B2*C2 becomes =B3*C3 below;
//   - two or more numbers continue as a series (1, 2 -> 3, 4, 5; 10, 20 -> 30, 40);
//   - a single number is copied (Excel makes a series from one number only with Ctrl held);
//   - text ending in a number counts on (Item 1 -> Item 2, Q1 -> Q2, 001 -> 002);
//   - day and month names go on (Mon -> Tue, January -> February) and start again after the last;
//   - anything else repeats, in order.
// The formatting of the selected cells is copied along, in the same order.

type Cells = Record<string, SheetCell>;
export type FillDirection = "down" | "up" | "right" | "left";

const cellAt = (cells: Cells, row: number, col: number): SheetCell => cells[refAt(row, col)] ?? EMPTY_CELL;
const hasData = (cell: SheetCell) => cell.value !== null || Boolean(cell.formula);

/** Which way a drag to `target` fills: the longer way out of the selection, as in Excel; null inside the selection. */
export function fillDirectionFor(source: Rect, target: { row: number; col: number }): FillDirection | null {
  const dy = target.row > source.r2 ? target.row - source.r2 : target.row < source.r1 ? target.row - source.r1 : 0;
  const dx = target.col > source.c2 ? target.col - source.c2 : target.col < source.c1 ? target.col - source.c1 : 0;
  if (dy === 0 && dx === 0) return null;
  if (Math.abs(dy) >= Math.abs(dx)) return dy > 0 ? "down" : "up";
  return dx > 0 ? "right" : "left";
}

/** The cells a fill of `count` more rows or columns adds beyond the selection (kept inside the sheet). */
export function fillExtension(source: Rect, direction: FillDirection, count: number): Rect | null {
  const rect: Rect = direction === "down" ? { ...source, r1: source.r2 + 1, r2: Math.min(MAX_ROWS, source.r2 + count) }
    : direction === "up" ? { ...source, r1: Math.max(1, source.r1 - count), r2: source.r1 - 1 }
    : direction === "right" ? { ...source, c1: source.c2 + 1, c2: Math.min(MAX_COLS - 1, source.c2 + count) }
    : { ...source, c1: Math.max(0, source.c1 - count), c2: source.c1 - 1 };
  return rect.r1 > rect.r2 || rect.c1 > rect.c2 ? null : rect;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const NAME_LISTS = [WEEKDAYS, WEEKDAYS.map((name) => name.slice(0, 3)), MONTHS, MONTHS.map((name) => name.slice(0, 3))];

function nameIndex(text: string): { list: string[]; index: number } | null {
  const lower = text.trim().toLowerCase();
  if (!lower) return null;
  for (const list of NAME_LISTS) { const index = list.findIndex((name) => name.toLowerCase() === lower); if (index >= 0) return { list, index }; }
  return null;
}
const sameCase = (sample: string, word: string) => (sample === sample.toUpperCase() && sample !== sample.toLowerCase() ? word.toUpperCase() : sample === sample.toLowerCase() ? word.toLowerCase() : word);
const counted = (text: string) => { const match = /^(.*?)(\d+)$/.exec(text); return match ? { prefix: match[1], digits: match[2] } : null; };

/** The value that goes `k` places (k = 1, 2...) beyond the selected cells of one line, or undefined to copy them. */
function seriesValue(values: (string | number | null)[], k: number, backward: boolean): string | number | undefined {
  const n = values.length;
  if (values.some((value) => value === null)) return undefined;
  const sign = backward ? -1 : 1;
  if (values.every((value) => typeof value === "number")) {
    const numbers = values as number[];
    if (n < 2) return undefined; // one number is copied
    // the straight line through the numbers (their common difference when they are evenly spaced)
    const meanX = (n - 1) / 2, meanY = numbers.reduce((sum, value) => sum + value, 0) / n;
    let top = 0, bottom = 0;
    numbers.forEach((value, i) => { top += (i - meanX) * (value - meanY); bottom += (i - meanX) ** 2; });
    const step = bottom === 0 ? 0 : top / bottom;
    const base = backward ? numbers[0] : numbers[n - 1];
    return Math.round((base + sign * step * k) * 1e10) / 1e10;
  }
  if (values.every((value) => typeof value === "string")) {
    const texts = values as string[];
    const names = texts.map(nameIndex);
    if (names.every((entry) => entry && entry.list === names[0]!.list)) {
      const list = names[0]!.list, size = list.length;
      const step = n >= 2 ? (names[1]!.index - names[0]!.index + size) % size || 1 : 1;
      const base = backward ? names[0]!.index : names[n - 1]!.index;
      const index = (((base + sign * step * k) % size) + size) % size;
      return sameCase(texts[0], list[index]);
    }
    const parts = texts.map(counted);
    if (parts.every((part) => part && part.prefix === parts[0]!.prefix)) {
      const numbersOnly = parts.map((part) => Number(part!.digits));
      const step = n >= 2 ? numbersOnly[1] - numbersOnly[0] : 1;
      const base = backward ? numbersOnly[0] : numbersOnly[n - 1];
      const next = base + sign * step * k;
      if (next < 0) return undefined;
      return `${parts[0]!.prefix}${String(next).padStart(parts[0]!.digits.length, "0")}`;
    }
  }
  return undefined;
}

/**
 * Fills `count` more rows or columns beyond `source` in `direction`. Returns the new cells (the sheet is not changed).
 * Each column (for down/up) or row (for right/left) of the selection is filled on its own.
 */
export function autoFill(cells: Cells, source: Rect, direction: FillDirection, count: number): Cells {
  const extension = fillExtension(source, direction, count);
  if (!extension) return cells;
  const next: Cells = { ...cells };
  const vertical = direction === "down" || direction === "up", backward = direction === "up" || direction === "left";
  const lines = vertical ? Array.from({ length: source.c2 - source.c1 + 1 }, (_, i) => source.c1 + i) : Array.from({ length: source.r2 - source.r1 + 1 }, (_, i) => source.r1 + i);
  const length = vertical ? source.r2 - source.r1 + 1 : source.c2 - source.c1 + 1;
  for (const line of lines) {
    const place = (i: number) => (vertical ? { row: source.r1 + i, col: line } : { row: line, col: source.c1 + i });
    const sources = Array.from({ length }, (_, i) => place(i));
    const plain = sources.every(({ row, col }) => !cellAt(cells, row, col).formula);
    const values = sources.map(({ row, col }) => cellAt(cells, row, col).value);
    const total = vertical ? extension.r2 - extension.r1 + 1 : extension.c2 - extension.c1 + 1;
    for (let k = 1; k <= total; k++) {
      // k places beyond the selection; the target cell and the selected cell it repeats
      const target = vertical ? { row: backward ? source.r1 - k : source.r2 + k, col: line } : { row: line, col: backward ? source.c1 - k : source.c2 + k };
      const cycle = backward ? (length - 1 - ((k - 1) % length)) : (k - 1) % length;
      const from = sources[cycle], style = cellAt(cells, from.row, from.col);
      const series = plain ? seriesValue(values, k, backward) : undefined;
      if (series !== undefined) next[refAt(target.row, target.col)] = { ...style, value: series, formula: null };
      else next[refAt(target.row, target.col)] = { ...style, formula: shiftFormula(style.formula, target.row - from.row, target.col - from.col) };
    }
  }
  return next;
}

/**
 * Double-clicking the handle fills down as far as the data next to the selection goes (the column on its left, or if
 * that is empty beside the selection's last row, the column on its right). Returns the last row to fill, or null.
 */
export function autoFillDownLastRow(cells: Cells, source: Rect): number | null {
  const neighbours = [source.c1 - 1, source.c2 + 1].filter((col) => col >= 0 && col < MAX_COLS);
  for (const col of neighbours) {
    if (!hasData(cellAt(cells, source.r2, col))) continue;
    let last = source.r2;
    while (last + 1 <= MAX_ROWS && hasData(cellAt(cells, last + 1, col))) last++;
    if (last > source.r2) return last;
  }
  return null;
}
