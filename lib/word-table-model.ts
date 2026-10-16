// Word 2013 Table Tools for the Word Efficiency editor: everything the Design and
// Layout tabs do to a table, done on the real <table> element in the editor.
//
// A table is treated as a full grid (Word's model): a merged cell covers several
// grid positions (rowspan/colspan), and every operation -- insert, delete, merge,
// split, sort, ... -- works on that grid, so merged cells survive it. What is
// saved (see readTableAttrs) is the grid: rows[r][c] text and cellFormats[r][c]
// formatting for EVERY position (positions covered by a merge are { merged: true }),
// plus the table's own settings as flat fields. That keeps each Word option a
// separate gradable field: blocks.N.attrs.<field> or ...cellFormats.R.C.<field>.

import { applyCellFormat, readCellFormat, type CellFormat } from "./word-table-format.ts";

export const MAX_TABLE_ROWS = 50;
export const MAX_TABLE_COLUMNS = 20;

// ---------- grid ----------

export type GridSlot = { cell: HTMLTableCellElement; row: number; col: number; rowSpan: number; colSpan: number };
export type TableGrid = { rows: number; cols: number; at: (GridSlot | null)[][] };

export function tableGrid(table: HTMLTableElement): TableGrid {
  const trs = [...table.rows];
  const at: (GridSlot | null)[][] = trs.map(() => []);
  let cols = 0;
  trs.forEach((tr, r) => {
    let c = 0;
    for (const cell of [...tr.cells]) {
      while (at[r][c]) c++;
      const rowSpan = Math.max(1, Math.min(cell.rowSpan || 1, trs.length - r)), colSpan = Math.max(1, cell.colSpan || 1);
      const slot: GridSlot = { cell, row: r, col: c, rowSpan, colSpan };
      for (let dr = 0; dr < rowSpan; dr++) for (let dc = 0; dc < colSpan; dc++) at[r + dr][c + dc] = slot;
      c += colSpan;
      cols = Math.max(cols, c);
    }
  });
  for (const row of at) for (let c = 0; c < cols; c++) if (!row[c]) row[c] = null;
  return { rows: trs.length, cols, at };
}

export function slotOf(grid: TableGrid, cell: HTMLTableCellElement): GridSlot | null {
  for (const row of grid.at) for (const slot of row) if (slot?.cell === cell) return slot;
  return null;
}

// Every grid position that has no cell (a ragged row) gets an empty one, so the grid is rectangular.
export function normalizeTable(table: HTMLTableElement) {
  const grid = tableGrid(table);
  grid.at.forEach((row, r) => row.forEach((slot, c) => { if (!slot) insertCellAt(table, r, c, emptyCell(table.ownerDocument)); }));
}

function emptyCell(document: Document) {
  const td = document.createElement("td");
  td.className = "border p-2";
  td.append(document.createElement("br"));
  return td;
}

// Puts a cell into row r so that it starts at grid column c.
function insertCellAt(table: HTMLTableElement, r: number, c: number, cell: HTMLTableCellElement) {
  const grid = tableGrid(table);
  const tr = table.rows[r];
  const after = [...tr.cells].find(other => (slotOf(grid, other)?.col ?? 0) > c);
  tr.insertBefore(cell, after ?? null);
}

// Puts every cell into its row, in column order, with its spans -- the DOM form of a grid.
function layoutTable(table: HTMLTableElement, anchors: { cell: HTMLTableCellElement; row: number; col: number; rowSpan: number; colSpan: number }[]) {
  const trs = [...table.rows];
  for (const anchor of anchors) { anchor.cell.rowSpan = anchor.rowSpan; anchor.cell.colSpan = anchor.colSpan; }
  trs.forEach((tr, r) => tr.replaceChildren(...anchors.filter(anchor => anchor.row === r).sort((a, b) => a.col - b.col).map(anchor => anchor.cell)));
}

function isEmptyCell(cell: HTMLTableCellElement) { return !(cell.textContent ?? "").trim(); }

// ---------- rows and columns ----------

export function insertRow(table: HTMLTableElement, refRow: number, where: "above" | "below") {
  if (table.rows.length >= MAX_TABLE_ROWS) return false;
  const grid = tableGrid(table);
  const at = where === "above" ? refRow : refRow + 1;
  const tr = table.ownerDocument.createElement("tr");
  const reference = table.rows[Math.min(refRow, table.rows.length - 1)];
  if (reference?.style.height) tr.style.height = reference.style.height;
  const extended = new Set<HTMLTableCellElement>();
  for (let c = 0; c < grid.cols; c++) {
    const crossing = at > 0 && at < grid.rows ? grid.at[at][c] : null;
    if (crossing && crossing.row < at) {
      if (!extended.has(crossing.cell)) { crossing.cell.rowSpan = crossing.rowSpan + 1; extended.add(crossing.cell); }
      c += crossing.colSpan - 1;
      continue;
    }
    tr.append(emptyCell(table.ownerDocument));
  }
  const body = table.tBodies[0] ?? table;
  body.insertBefore(tr, table.rows[at] ?? null);
  return true;
}

export function deleteRow(table: HTMLTableElement, r: number) {
  if (table.rows.length <= 1) { table.remove(); return; }
  const grid = tableGrid(table);
  const handled = new Set<HTMLTableCellElement>();
  for (let c = 0; c < grid.cols; c++) {
    const slot = grid.at[r][c];
    if (!slot || handled.has(slot.cell)) continue;
    handled.add(slot.cell);
    if (slot.rowSpan > 1) {
      if (slot.row < r) slot.cell.rowSpan = slot.rowSpan - 1;
      else { slot.cell.rowSpan = slot.rowSpan - 1; insertCellAt(table, r + 1, slot.col, slot.cell); }
    }
  }
  table.rows[r].remove();
}

export function insertColumn(table: HTMLTableElement, refCol: number, where: "left" | "right") {
  const grid = tableGrid(table);
  if (grid.cols >= MAX_TABLE_COLUMNS) return false;
  const at = where === "left" ? refCol : refCol + 1;
  const extended = new Set<HTMLTableCellElement>();
  for (let r = 0; r < grid.rows; r++) {
    const crossing = at > 0 && at < grid.cols ? grid.at[r][at] : null;
    if (crossing && crossing.col < at) {
      if (!extended.has(crossing.cell)) { crossing.cell.colSpan = crossing.colSpan + 1; extended.add(crossing.cell); }
      continue;
    }
    const cell = emptyCell(table.ownerDocument);
    const tr = table.rows[r];
    const after = [...tr.cells].find(other => (slotOf(grid, other)?.col ?? 0) >= at);
    tr.insertBefore(cell, after ?? null);
  }
  const widths = columnWidths(table);
  if (widths.some(width => width !== null)) { widths.splice(at, 0, widths[Math.min(refCol, widths.length - 1)] ?? null); setColumnWidths(table, widths); }
  return true;
}

export function deleteColumn(table: HTMLTableElement, c: number) {
  const grid = tableGrid(table);
  if (grid.cols <= 1) { table.remove(); return; }
  const handled = new Set<HTMLTableCellElement>();
  for (let r = 0; r < grid.rows; r++) {
    const slot = grid.at[r][c];
    if (!slot || handled.has(slot.cell)) continue;
    handled.add(slot.cell);
    if (slot.colSpan > 1) slot.cell.colSpan = slot.colSpan - 1;
    else slot.cell.remove();
  }
  for (const tr of [...table.rows]) if (!tr.cells.length) tr.remove();
  const widths = columnWidths(table);
  if (widths.length > c) { widths.splice(c, 1); setColumnWidths(table, widths); }
}

/** Delete Cells… > Shift cells left / up: the cell's contents go, the cells after it move over, and an empty cell fills the end. */
export function deleteCellShift(table: HTMLTableElement, cell: HTMLTableCellElement, direction: "left" | "up"): string | null {
  const grid = tableGrid(table);
  const slot = slotOf(grid, cell);
  if (!slot) return "Place the cursor in a table cell.";
  if (slot.rowSpan > 1 || slot.colSpan > 1) return "Merged cells can't be shifted; split them first.";
  if (direction === "left") {
    const row = grid.at[slot.row];
    if (row.some(other => other && (other.rowSpan > 1 || other.colSpan > 1))) return "This row has merged cells; split them first.";
    const tr = table.rows[slot.row];
    cell.remove();
    tr.append(emptyCell(table.ownerDocument));
    return null;
  }
  const column = grid.at.map(row => row[slot.col]);
  if (column.some(other => other && (other.rowSpan > 1 || other.colSpan > 1))) return "This column has merged cells; split them first.";
  const cells = column.slice(slot.row).map(other => other!.cell);
  for (let i = 0; i < cells.length - 1; i++) cells[i].replaceChildren(...[...cells[i + 1].childNodes]);
  cells[cells.length - 1].replaceChildren(table.ownerDocument.createElement("br"));
  return null;
}

/** Insert Cells… > Shift cells right / down: an empty cell goes in at the cursor and the cells after it move over
 *  (the table gains a column / row at the end to hold the last one, so it stays a grid). */
export function insertCellShift(table: HTMLTableElement, cell: HTMLTableCellElement, direction: "right" | "down"): string | null {
  const grid = tableGrid(table);
  const slot = slotOf(grid, cell);
  if (!slot) return "Place the cursor in a table cell.";
  if (direction === "right") {
    if (grid.at[slot.row].some(other => other && (other.rowSpan > 1 || other.colSpan > 1))) return "This row has merged cells; split them first.";
    if (grid.cols >= MAX_TABLE_COLUMNS) return `A table can have at most ${MAX_TABLE_COLUMNS} columns.`;
    insertColumn(table, grid.cols - 1, "right");
    const cells = tableGrid(table).at[slot.row].map(other => other!.cell);
    for (let i = cells.length - 1; i > slot.col; i--) cells[i].replaceChildren(...[...cells[i - 1].childNodes]);
    cells[slot.col].replaceChildren(table.ownerDocument.createElement("br"));
    return null;
  }
  if (grid.at.some(row => { const other = row[slot.col]; return other && (other.rowSpan > 1 || other.colSpan > 1); })) return "This column has merged cells; split them first.";
  if (grid.rows >= MAX_TABLE_ROWS) return `A table can have at most ${MAX_TABLE_ROWS} rows.`;
  insertRow(table, grid.rows - 1, "below");
  const cells = tableGrid(table).at.map(row => row[slot.col]!.cell);
  for (let i = cells.length - 1; i > slot.row; i--) cells[i].replaceChildren(...[...cells[i - 1].childNodes]);
  cells[slot.row].replaceChildren(table.ownerDocument.createElement("br"));
  return null;
}

// ---------- merge / split ----------

export function selectionRect(grid: TableGrid, cells: HTMLTableCellElement[]) {
  const slots = cells.map(cell => slotOf(grid, cell)).filter((slot): slot is GridSlot => Boolean(slot));
  if (!slots.length) return null;
  return { r1: Math.min(...slots.map(s => s.row)), c1: Math.min(...slots.map(s => s.col)), r2: Math.max(...slots.map(s => s.row + s.rowSpan - 1)), c2: Math.max(...slots.map(s => s.col + s.colSpan - 1)) };
}

/** Merge Cells: the cells must form a rectangle; their contents are kept in the top-left cell. */
export function mergeCells(table: HTMLTableElement, cells: HTMLTableCellElement[]): string | null {
  const grid = tableGrid(table);
  const rect = selectionRect(grid, cells);
  if (!rect) return "Select the cells to merge first.";
  const inside = new Set<GridSlot>();
  for (let r = rect.r1; r <= rect.r2; r++) for (let c = rect.c1; c <= rect.c2; c++) { const slot = grid.at[r][c]; if (slot) inside.add(slot); }
  if (inside.size < 2) return "Select two or more cells to merge.";
  const chosen = new Set(cells);
  for (const slot of inside) if (!chosen.has(slot.cell) || slot.row < rect.r1 || slot.col < rect.c1 || slot.row + slot.rowSpan - 1 > rect.r2 || slot.col + slot.colSpan - 1 > rect.c2) return "The selected cells must form a rectangle.";
  const anchor = grid.at[rect.r1][rect.c1]!.cell;
  for (const slot of inside) {
    if (slot.cell === anchor) continue;
    if (!isEmptyCell(slot.cell)) { if (!isEmptyCell(anchor)) anchor.append(table.ownerDocument.createTextNode(" ")); anchor.append(...[...slot.cell.childNodes].filter(node => node.nodeName !== "BR")); }
    slot.cell.remove();
  }
  anchor.rowSpan = rect.r2 - rect.r1 + 1;
  anchor.colSpan = rect.c2 - rect.c1 + 1;
  for (const tr of [...table.rows]) if (!tr.cells.length) { tr.remove(); for (const row of table.rows) for (const cell of row.cells) if (cell.rowSpan > table.rows.length) cell.rowSpan = table.rows.length; }
  return null;
}

/** Split Cells: divides one cell into columns x rows (adding grid columns/rows when it is too small). */
export function splitCell(table: HTMLTableElement, cell: HTMLTableCellElement, columns: number, rows: number): string | null {
  columns = Math.max(1, Math.min(MAX_TABLE_COLUMNS, Math.round(columns)));
  rows = Math.max(1, Math.min(MAX_TABLE_ROWS, Math.round(rows)));
  if (columns === 1 && rows === 1) return null;
  let grid = tableGrid(table);
  let slot = slotOf(grid, cell);
  if (!slot) return "Place the cursor in the cell to split.";
  // Widen / heighten the grid inside this cell's area when it is too small.
  if (slot.colSpan < columns) {
    const add = columns - slot.colSpan;
    if (grid.cols + add > MAX_TABLE_COLUMNS) return `A table can have at most ${MAX_TABLE_COLUMNS} columns.`;
    const lastCol = slot.col + slot.colSpan - 1;
    const widened = new Set<HTMLTableCellElement>();
    for (let r = 0; r < grid.rows; r++) { const other = grid.at[r][lastCol]; if (other && !widened.has(other.cell)) { other.cell.colSpan = other.colSpan + add; widened.add(other.cell); } }
    const widths = columnWidths(table);
    if (widths.some(width => width !== null)) { const share = widths[lastCol] !== null ? (widths[lastCol] as number) / (add + 1) : null; widths.splice(lastCol, 1, ...Array(add + 1).fill(share)); setColumnWidths(table, widths); }
  }
  grid = tableGrid(table); slot = slotOf(grid, cell)!;
  if (slot.rowSpan < rows) {
    const add = rows - slot.rowSpan;
    if (grid.rows + add > MAX_TABLE_ROWS) return `A table can have at most ${MAX_TABLE_ROWS} rows.`;
    const lastRow = slot.row + slot.rowSpan - 1;
    const tallened = new Set<HTMLTableCellElement>();
    for (let c = 0; c < grid.cols; c++) { const other = grid.at[lastRow][c]; if (other && !tallened.has(other.cell)) { other.cell.rowSpan = other.rowSpan + add; tallened.add(other.cell); } }
    const body = table.tBodies[0] ?? table;
    for (let i = 0; i < add; i++) body.insertBefore(table.ownerDocument.createElement("tr"), table.rows[lastRow + 1 + i] ?? null);
  }
  grid = tableGrid(table); slot = slotOf(grid, cell)!;
  const sizes = (total: number, parts: number) => Array.from({ length: parts }, (_, i) => Math.floor(total / parts) + (i < total % parts ? 1 : 0));
  const colSizes = sizes(slot.colSpan, columns), rowSizes = sizes(slot.rowSpan, rows);
  const anchors: { cell: HTMLTableCellElement; row: number; col: number; rowSpan: number; colSpan: number }[] = [];
  for (const row of grid.at) for (const other of row) if (other && other.cell !== cell && !anchors.some(a => a.cell === other.cell)) anchors.push(other);
  let r = slot.row;
  rowSizes.forEach((rowSpan, ri) => {
    let c = slot!.col;
    colSizes.forEach((colSpan, ci) => {
      const piece = ri === 0 && ci === 0 ? cell : (cell.cloneNode(false) as HTMLTableCellElement);
      if (piece !== cell) piece.append(table.ownerDocument.createElement("br"));
      anchors.push({ cell: piece, row: r, col: c, rowSpan, colSpan });
      c += colSpan;
    });
    r += rowSpan;
  });
  layoutTable(table, anchors);
  return null;
}

/** Split Table: the rows from `atRow` down become a second table right after this one. */
export function splitTable(table: HTMLTableElement, atRow: number): HTMLTableElement | null {
  if (atRow <= 0 || atRow >= table.rows.length) return null;
  const grid = tableGrid(table);
  // Cells that span across the split line are cut in two.
  for (let c = 0; c < grid.cols; c++) {
    const slot = grid.at[atRow][c];
    if (slot && slot.row < atRow) {
      const below = slot.cell.cloneNode(false) as HTMLTableCellElement;
      below.append(table.ownerDocument.createElement("br"));
      below.rowSpan = slot.row + slot.rowSpan - atRow; below.colSpan = slot.colSpan;
      slot.cell.rowSpan = atRow - slot.row;
      insertCellAt(table, atRow, slot.col, below);
      c += slot.colSpan - 1;
    }
  }
  const second = table.cloneNode(false) as HTMLTableElement;
  second.removeAttribute("id");
  const colgroup = table.querySelector("colgroup");
  if (colgroup) second.append(colgroup.cloneNode(true));
  const body = second.appendChild(table.ownerDocument.createElement("tbody"));
  for (const tr of [...table.rows].slice(atRow)) body.append(tr);
  const gap = table.ownerDocument.createElement("p");
  gap.setAttribute("data-block-type", "paragraph");
  gap.append(table.ownerDocument.createElement("br"));
  table.after(gap, second);
  return second;
}

// ---------- sizes ----------

const CM_PER_PX = 2.54 / 96;
export function columnWidths(table: HTMLTableElement): (number | null)[] {
  const cols = [...(table.querySelector("colgroup")?.children ?? [])] as HTMLElement[];
  return cols.map(col => { const value = Number.parseFloat(col.style.width); return Number.isFinite(value) && col.style.width.endsWith("cm") ? value : null; });
}
export function setColumnWidths(table: HTMLTableElement, widths: (number | null)[]) {
  let colgroup = table.querySelector("colgroup");
  if (widths.every(width => width === null)) { colgroup?.remove(); return; }
  if (!colgroup) { colgroup = table.ownerDocument.createElement("colgroup"); table.prepend(colgroup); }
  colgroup.replaceChildren(...widths.map(width => { const col = table.ownerDocument.createElement("col"); if (width !== null) col.style.width = `${round2(width)}cm`; return col; }));
}
export function rowHeights(table: HTMLTableElement): (number | null)[] {
  return [...table.rows].map(tr => { const value = Number.parseFloat(tr.style.height); return Number.isFinite(value) && tr.style.height.endsWith("cm") ? value : null; });
}
export function setRowHeight(table: HTMLTableElement, rows: number[], cm: number | null) {
  for (const r of rows) { const tr = table.rows[r]; if (tr) tr.style.height = cm === null ? "" : `${round2(cm)}cm`; }
}
export function setColumnWidth(table: HTMLTableElement, cols: number[], cm: number | null) {
  const count = tableGrid(table).cols;
  const widths = columnWidths(table);
  while (widths.length < count) widths.push(null);
  for (const c of cols) if (c < count) widths[c] = cm === null ? null : cm;
  table.style.tableLayout = "fixed";
  setColumnWidths(table, widths);
}
const round2 = (value: number) => Math.round(value * 100) / 100;

/** Distribute Rows: every row gets the same height (the average of their current heights). */
export function distributeRows(table: HTMLTableElement) {
  const heights = [...table.rows].map(tr => tr.getBoundingClientRect().height * CM_PER_PX).filter(height => height > 0);
  const average = heights.length ? heights.reduce((sum, h) => sum + h, 0) / heights.length : 0.6;
  setRowHeight(table, [...table.rows].map((_, r) => r), Math.max(0.2, round2(average)));
}
/** Distribute Columns: every column gets the same width (the table's width shared out). */
export function distributeColumns(table: HTMLTableElement) {
  const count = tableGrid(table).cols;
  const width = table.getBoundingClientRect().width * CM_PER_PX;
  const each = count ? Math.max(0.5, round2((width > 0 ? width : count * 2.5) / count)) : 2.5;
  setColumnWidth(table, Array.from({ length: count }, (_, c) => c), each);
}

/** AutoFit: to contents, to the window, or fixed column widths. */
export function autoFit(table: HTMLTableElement, mode: "auto" | "window" | "fixed") {
  table.setAttribute("data-table-layout", mode);
  if (mode === "fixed") {
    const count = tableGrid(table).cols;
    const first = [...table.rows].find(tr => tr.cells.length === count);
    const widths = first ? [...first.cells].map(cell => round2(cell.getBoundingClientRect().width * CM_PER_PX) || 2.5) : Array(count).fill(2.5);
    table.style.tableLayout = "fixed"; table.style.width = "auto";
    setColumnWidths(table, widths);
  } else {
    setColumnWidths(table, []);
    table.style.tableLayout = "auto";
    table.style.width = mode === "window" ? "100%" : "auto";
  }
}

// ---------- sort ----------

/** Sort (Word's Sort dialog for a table): by one column, ascending or descending, as text, number or date. */
export type SortKey = { column: number; type: "text" | "number" | "date"; order: "ascending" | "descending" };
export function sortTable(table: HTMLTableElement, column: number, order: "ascending" | "descending", type: "text" | "number" | "date", hasHeader: boolean): string | null {
  return sortTableBy(table, [{ column, type, order }], { hasHeader });
}
/** Sort with Word's Sort by / Then by / Then by keys. Options: header row kept, case sensitive,
 *  and "Sort column only" (only the first key's column is reordered; other cells stay). */
export function sortTableBy(table: HTMLTableElement, keys: SortKey[], options: { hasHeader: boolean; caseSensitive?: boolean; columnOnly?: boolean }): string | null {
  const grid = tableGrid(table);
  if (!keys.length) return null;
  if ([...table.querySelectorAll("td,th")].some(cell => (cell as HTMLTableCellElement).rowSpan > 1)) return "Rows with vertically merged cells cannot be sorted.";
  const start = options.hasHeader ? 1 : 0;
  const rows = [...table.rows].slice(start);
  const value = (r: number, key: SortKey): number | string => {
    const text = (grid.at[r]?.[key.column]?.cell.textContent ?? "").trim();
    if (key.type === "number") { const number = Number.parseFloat(text.replace(/[^0-9.+-]/g, "")); return Number.isFinite(number) ? number : -Infinity; }
    if (key.type === "date") { const date = Date.parse(text); return Number.isFinite(date) ? date : -Infinity; }
    return options.caseSensitive ? text : text.toLowerCase();
  };
  const compare = (a: number, b: number) => {
    for (const key of keys) {
      const x = value(a, key), y = value(b, key);
      const result = typeof x === "string" && typeof y === "string" ? x.localeCompare(y, undefined, { sensitivity: options.caseSensitive ? "case" : "base", caseFirst: "upper" }) : x < y ? -1 : x > y ? 1 : 0;
      if (result) return result * (key.order === "ascending" ? 1 : -1);
    }
    return 0;
  };
  const order = rows.map(tr => tr.rowIndex).sort(compare);
  if (options.columnOnly) {
    const column = keys[0].column;
    const contents = order.map(r => [...(grid.at[r]?.[column]?.cell.childNodes ?? [])]);
    rows.forEach((tr, i) => grid.at[tr.rowIndex]?.[column]?.cell.replaceChildren(...contents[i]));
    return null;
  }
  const all = [...table.rows], sorted = order.map(r => all[r]);
  const parent = rows[0]?.parentElement;
  if (parent) for (const tr of sorted) parent.append(tr);
  return null;
}

// ---------- convert ----------

export const SEPARATORS = { paragraph: "\n", tab: "\t", comma: ",", other: "-" } as const;

/** Convert to Text: each row becomes a paragraph, cells joined by the separator. */
export function tableToParagraphs(table: HTMLTableElement, separator: string): HTMLElement[] {
  const grid = tableGrid(table);
  const document = table.ownerDocument;
  const lines: string[] = [];
  for (let r = 0; r < grid.rows; r++) {
    const cells: string[] = [];
    for (let c = 0; c < grid.cols; c++) { const slot = grid.at[r][c]; if (slot && slot.row === r && slot.col === c) cells.push((slot.cell.textContent ?? "").replace(/\s+/g, " ").trim()); }
    if (separator === "\n") lines.push(...cells); else lines.push(cells.join(separator));
  }
  const paragraphs = lines.map(line => { const p = document.createElement("p"); p.setAttribute("data-block-type", "paragraph"); p.textContent = line; if (!line) p.append(document.createElement("br")); return p; });
  table.replaceWith(...paragraphs);
  return paragraphs;
}

/** Convert Text to Table: each paragraph is a row, split at the separator. */
export function paragraphsToTable(paragraphs: HTMLElement[], separator: string, columns: number | null): HTMLTableElement | null {
  if (!paragraphs.length) return null;
  const document = paragraphs[0].ownerDocument;
  let cells = separator === "\n" ? [paragraphs.map(p => (p.textContent ?? "").trim())] : paragraphs.map(p => (p.textContent ?? "").split(separator).map(text => text.trim()));
  if (separator === "\n") { const count = Math.max(1, columns ?? 1); const flat = cells[0]; cells = []; for (let i = 0; i < flat.length; i += count) cells.push(flat.slice(i, i + count)); }
  const width = Math.min(MAX_TABLE_COLUMNS, Math.max(columns ?? 1, ...cells.map(row => row.length)));
  const table = document.createElement("table");
  table.setAttribute("data-block-type", "table");
  table.setAttribute("data-table-style", "table-grid");
  table.className = "my-3 border-collapse";
  table.style.width = "100%";
  const body = table.appendChild(document.createElement("tbody"));
  for (const row of cells.slice(0, MAX_TABLE_ROWS)) {
    const tr = body.appendChild(document.createElement("tr"));
    for (let c = 0; c < width; c++) { const td = tr.appendChild(document.createElement("td")); td.className = "border p-2"; if (row[c]) td.textContent = row[c]; else td.append(document.createElement("br")); }
  }
  paragraphs[0].before(table);
  for (const p of paragraphs) p.remove();
  return table;
}

// ---------- formula ----------

export const FORMULA_FUNCTIONS = ["SUM", "AVERAGE", "COUNT", "MAX", "MIN", "PRODUCT"] as const;
const numberIn = (text: string) => { const match = text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/); return match ? Number(match[0]) : null; };

/** Formula: =SUM(ABOVE), =AVERAGE(LEFT), ... on the numbers next to the cell. Returns the result, or an error message. */
export function evaluateFormula(table: HTMLTableElement, cell: HTMLTableCellElement, formula: string): { value: number } | { error: string } {
  const match = formula.trim().toUpperCase().match(/^=\s*(SUM|AVERAGE|COUNT|MAX|MIN|PRODUCT)\s*\(\s*(ABOVE|BELOW|LEFT|RIGHT)\s*\)$/);
  if (!match) return { error: "Use a formula like =SUM(ABOVE), =AVERAGE(LEFT), =MAX(BELOW) or =COUNT(RIGHT)." };
  const [, fn, direction] = match;
  const grid = tableGrid(table);
  const slot = slotOf(grid, cell);
  if (!slot) return { error: "Place the cursor in a table cell." };
  const values: number[] = [];
  const seen = new Set<HTMLTableCellElement>();
  const take = (r: number, c: number) => { const other = grid.at[r]?.[c]; if (other && other.cell !== cell && !seen.has(other.cell)) { seen.add(other.cell); const value = numberIn(other.cell.textContent ?? ""); if (value !== null) values.push(value); } };
  if (direction === "ABOVE") for (let r = slot.row - 1; r >= 0; r--) take(r, slot.col);
  if (direction === "BELOW") for (let r = slot.row + slot.rowSpan; r < grid.rows; r++) take(r, slot.col);
  if (direction === "LEFT") for (let c = slot.col - 1; c >= 0; c--) take(slot.row, c);
  if (direction === "RIGHT") for (let c = slot.col + slot.colSpan; c < grid.cols; c++) take(slot.row, c);
  const sum = values.reduce((total, value) => total + value, 0);
  const value = fn === "SUM" ? sum : fn === "AVERAGE" ? (values.length ? sum / values.length : 0) : fn === "COUNT" ? values.length : fn === "MAX" ? (values.length ? Math.max(...values) : 0) : fn === "MIN" ? (values.length ? Math.min(...values) : 0) : values.reduce((total, v) => total * v, 1);
  return { value: Math.round(value * 100) / 100 };
}

// ---------- cell formatting beyond the font ----------

export type BorderSide = "top" | "right" | "bottom" | "left";
export type Pen = { style: "solid" | "double" | "dotted" | "dashed" | "none"; width: number; color: string };
export const DEFAULT_PEN: Pen = { style: "solid", width: 0.5, color: "000000" };
export const BORDER_WIDTHS = [0.25, 0.5, 0.75, 1, 1.5, 2.25, 3, 4.5, 6];
export const penValue = (pen: Pen) => (pen.style === "none" ? "none" : `${pen.style} ${pen.width} ${pen.color.toUpperCase()}`);
export function penCss(value: string | undefined | null) {
  if (!value || value === "none") return "none";
  const [style, width, color] = value.split(" ");
  const px = Math.max(1, Math.round(Number(width) * 4 / 3));
  return `${style === "double" ? Math.max(3, px) : px}px ${style} #${color}`;
}
const SIDE_STYLE: Record<BorderSide, "borderTop" | "borderRight" | "borderBottom" | "borderLeft"> = { top: "borderTop", right: "borderRight", bottom: "borderBottom", left: "borderLeft" };
const SIDE_DATA: Record<BorderSide, string> = { top: "borderTop", right: "borderRight", bottom: "borderBottom", left: "borderLeft" };

export function setCellBorder(cell: HTMLTableCellElement, side: BorderSide, value: string) {
  cell.dataset[SIDE_DATA[side]] = value;
  cell.style[SIDE_STYLE[side]] = penCss(value);
}

export type BorderCommand = "bottom" | "top" | "left" | "right" | "none" | "all" | "outside" | "inside" | "insideH" | "insideV" | "diagonalDown" | "diagonalUp";

/** The Borders drop-down: applies the pen (or No Border) to sides of the selected cells, like Word. */
export function applyBorders(table: HTMLTableElement, cells: HTMLTableCellElement[], command: BorderCommand, pen: Pen) {
  const grid = tableGrid(table);
  const rect = selectionRect(grid, cells);
  if (!rect) return;
  const value = command === "none" ? "none" : penValue(pen);
  for (const cell of new Set(cells)) {
    const slot = slotOf(grid, cell);
    if (!slot) continue;
    const top = slot.row === rect.r1, bottom = slot.row + slot.rowSpan - 1 === rect.r2, left = slot.col === rect.c1, right = slot.col + slot.colSpan - 1 === rect.c2;
    const set = (side: BorderSide, on: boolean) => { if (on) setCellBorder(cell, side, value); };
    if (command === "none") { for (const side of ["top", "right", "bottom", "left"] as BorderSide[]) setCellBorder(cell, side, "none"); delete cell.dataset.borderDiagonal; cell.style.backgroundImage = ""; continue; }
    if (command === "all") { for (const side of ["top", "right", "bottom", "left"] as BorderSide[]) setCellBorder(cell, side, value); continue; }
    if (command === "outside") { set("top", top); set("bottom", bottom); set("left", left); set("right", right); continue; }
    if (command === "inside") { set("top", !top); set("bottom", !bottom); set("left", !left); set("right", !right); continue; }
    if (command === "insideH") { set("top", !top); set("bottom", !bottom); continue; }
    if (command === "insideV") { set("left", !left); set("right", !right); continue; }
    if (command === "top") set("top", top);
    if (command === "bottom") set("bottom", bottom);
    if (command === "left") set("left", left);
    if (command === "right") set("right", right);
    if (command === "diagonalDown" || command === "diagonalUp") setDiagonal(cell, command === "diagonalDown" ? "down" : "up", pen);
  }
}

export function setDiagonal(cell: HTMLTableCellElement, direction: "down" | "up" | null, pen: Pen = DEFAULT_PEN) {
  if (!direction) { delete cell.dataset.borderDiagonal; cell.style.backgroundImage = ""; return; }
  cell.dataset.borderDiagonal = `${direction} ${penValue(pen)}`;
  cell.style.backgroundImage = diagonalCss(cell.dataset.borderDiagonal);
}
function diagonalCss(value: string) {
  const [direction, , width, color] = value.split(" ");
  const line = `#${color ?? "000000"}`, w = Math.max(1, Math.round(Number(width ?? 0.5) * 4 / 3));
  return `linear-gradient(to ${direction === "down" ? "top right" : "bottom right"}, transparent calc(50% - ${w / 2}px), ${line} calc(50% - ${w / 2}px), ${line} calc(50% + ${w / 2}px), transparent calc(50% + ${w / 2}px))`;
}

export function setShading(cell: HTMLTableCellElement, color: string | null) {
  if (!color) { delete cell.dataset.shading; cell.style.backgroundColor = ""; return; }
  cell.dataset.shading = color.toUpperCase();
  cell.style.backgroundColor = `#${color}`;
}

export type TextDirection = "horizontal" | "down" | "up";
/** Text Direction cycles like Word's button: horizontal -> rotated down (90°) -> rotated up (270°). */
export function cycleTextDirection(cell: HTMLTableCellElement): TextDirection {
  const current = (cell.dataset.textDirection as TextDirection) || "horizontal";
  const next: TextDirection = current === "horizontal" ? "down" : current === "down" ? "up" : "horizontal";
  setTextDirection(cell, next);
  return next;
}
export function setTextDirection(cell: HTMLTableCellElement, direction: TextDirection) {
  if (direction === "horizontal") delete cell.dataset.textDirection; else cell.dataset.textDirection = direction;
}

// ---------- table settings ----------

export const TABLE_STYLE_OPTION_KEYS = ["headerRow", "totalRow", "bandedRows", "firstColumn", "lastColumn", "bandedColumns"] as const;
export type TableStyleOptionKey = (typeof TABLE_STYLE_OPTION_KEYS)[number];
export const DEFAULT_STYLE_OPTIONS: Record<TableStyleOptionKey, boolean> = { headerRow: true, totalRow: false, bandedRows: true, firstColumn: true, lastColumn: false, bandedColumns: false };

export const TABLE_STYLES: { id: string; name: string }[] = [
  { id: "table-grid", name: "Table Grid" },
  { id: "plain-1", name: "Plain Table 1" },
  { id: "plain-2", name: "Plain Table 2" },
  { id: "plain-3", name: "Plain Table 3" },
  { id: "plain-4", name: "Plain Table 4" },
  { id: "plain-5", name: "Plain Table 5" },
  { id: "grid-1-light", name: "Grid Table 1 Light" },
  { id: "grid-4-accent-1", name: "Grid Table 4 - Accent 1" },
  { id: "grid-5-dark-accent-1", name: "Grid Table 5 Dark - Accent 1" },
  { id: "grid-6-colorful-accent-1", name: "Grid Table 6 Colorful - Accent 1" },
  { id: "list-3-accent-1", name: "List Table 3 - Accent 1" },
  { id: "list-4-accent-2", name: "List Table 4 - Accent 2" },
];
const STYLE_IDS = new Set(TABLE_STYLES.map(style => style.id));

export type CellMargins = { top: number; bottom: number; left: number; right: number };
export const DEFAULT_CELL_MARGINS: CellMargins = { top: 0, bottom: 0, left: 0.19, right: 0.19 };

export function setCellMargins(table: HTMLTableElement, margins: CellMargins | null) {
  if (!margins) { for (const key of ["top", "bottom", "left", "right"] as const) { table.style.removeProperty(`--wt-pad-${key}`); delete table.dataset[`cellMargin${key[0].toUpperCase()}${key.slice(1)}`]; } return; }
  for (const key of ["top", "bottom", "left", "right"] as const) {
    table.style.setProperty(`--wt-pad-${key}`, `${round2(margins[key])}cm`);
    table.dataset[`cellMargin${key[0].toUpperCase()}${key.slice(1)}`] = String(round2(margins[key]));
  }
  table.dataset.cellMargins = "true";
}

export function tableCellMargins(table: HTMLTableElement): CellMargins {
  const read = (key: "Top" | "Bottom" | "Left" | "Right", fallback: number) => { const value = Number(table.dataset[`cellMargin${key}`]); return Number.isFinite(value) && table.dataset[`cellMargin${key}`] !== undefined ? value : fallback; };
  return { top: read("Top", DEFAULT_CELL_MARGINS.top), bottom: read("Bottom", DEFAULT_CELL_MARGINS.bottom), left: read("Left", DEFAULT_CELL_MARGINS.left), right: read("Right", DEFAULT_CELL_MARGINS.right) };
}

// ---------- save / load ----------

export type TableAttrs = {
  rows: string[][];
  cellFormats: CellFormat[][];
  tableLayout?: string;
  tableStyle?: string;
  headerRow?: boolean; totalRow?: boolean; bandedRows?: boolean; firstColumn?: boolean; lastColumn?: boolean; bandedColumns?: boolean;
  repeatHeader?: boolean;
  tableAlign?: "left" | "center" | "right";
  cellMarginTop?: number; cellMarginBottom?: number; cellMarginLeft?: number; cellMarginRight?: number;
  rowHeights?: (number | null)[];
  colWidths?: (number | null)[];
  // Table Properties / Table Options (setTableWidth ... setRowCanSplit below).
  tableWidth?: number; tableWidthUnit?: "cm" | "pct";
  tableIndent?: number;
  tableWrap?: "around";
  cellSpacing?: number;
  rowHeightRules?: ("exactly" | null)[];
  rowCantSplit?: (true | null)[];
  tableTitle?: string; tableDescription?: string;
};

/** Reads a table from the editor into the saved form (one grid position per cell). */
export function readTableAttrs(table: HTMLTableElement): TableAttrs {
  const grid = tableGrid(table);
  const rows: string[][] = [], cellFormats: CellFormat[][] = [];
  for (let r = 0; r < Math.min(grid.rows, MAX_TABLE_ROWS); r++) {
    rows.push([]); cellFormats.push([]);
    for (let c = 0; c < Math.min(grid.cols, MAX_TABLE_COLUMNS); c++) {
      const slot = grid.at[r][c];
      if (!slot) { rows[r].push(""); cellFormats[r].push({}); continue; }
      if (slot.row !== r || slot.col !== c) { rows[r].push(""); cellFormats[r].push({ merged: true }); continue; }
      rows[r].push((slot.cell.textContent ?? "").slice(0, 10000));
      const format: CellFormat = readCellFormat(slot.cell);
      if (slot.rowSpan > 1) format.rowspan = slot.rowSpan;
      if (slot.colSpan > 1) format.colspan = slot.colSpan;
      const data = slot.cell.dataset;
      if (data.shading) format.shading = data.shading;
      for (const side of ["borderTop", "borderRight", "borderBottom", "borderLeft"] as const) if (data[side]) format[side] = data[side];
      if (data.borderDiagonal) format.borderDiagonal = data.borderDiagonal;
      if (data.textDirection === "down" || data.textDirection === "up") format.textDirection = data.textDirection;
      if (PAD_KEYS.every(([, key]) => data[key] !== undefined)) for (const [, key] of PAD_KEYS) format[key] = Number(data[key]);
      if (data.noWrap === "true") format.noWrap = true;
      if (data.fitText === "true") format.fitText = true;
      cellFormats[r].push(format);
    }
  }
  const attrs: TableAttrs = { rows, cellFormats };
  const data = table.dataset;
  if (data.tableLayout) attrs.tableLayout = data.tableLayout;
  if (data.tableStyle && STYLE_IDS.has(data.tableStyle)) {
    attrs.tableStyle = data.tableStyle;
    for (const key of TABLE_STYLE_OPTION_KEYS) attrs[key] = data[key] !== undefined ? data[key] === "true" : DEFAULT_STYLE_OPTIONS[key];
  }
  if (data.repeatHeader === "true") attrs.repeatHeader = true;
  if (data.tableAlign === "center" || data.tableAlign === "right") attrs.tableAlign = data.tableAlign;
  if (data.cellMargins === "true") { const margins = tableCellMargins(table); attrs.cellMarginTop = margins.top; attrs.cellMarginBottom = margins.bottom; attrs.cellMarginLeft = margins.left; attrs.cellMarginRight = margins.right; }
  const heights = rowHeights(table).slice(0, rows.length);
  if (heights.some(height => height !== null)) attrs.rowHeights = heights;
  const widths = columnWidths(table).slice(0, rows[0]?.length ?? 0);
  if (widths.some(width => width !== null)) attrs.colWidths = widths;
  const width = tableWidth(table);
  if (width) { attrs.tableWidth = width.width; attrs.tableWidthUnit = width.unit; }
  if (tableIndent(table)) attrs.tableIndent = tableIndent(table);
  if (data.tableWrap === "around") attrs.tableWrap = "around";
  const spacing = cellSpacing(table);
  if (spacing !== null) attrs.cellSpacing = spacing;
  const trs = [...table.rows].slice(0, rows.length);
  if (trs.some(tr => tr.dataset.heightRule === "exactly")) attrs.rowHeightRules = trs.map(tr => (tr.dataset.heightRule === "exactly" ? "exactly" : null));
  if (trs.some(tr => tr.dataset.cantSplit === "true")) attrs.rowCantSplit = trs.map(tr => (tr.dataset.cantSplit === "true" ? true : null));
  if (data.altTitle) attrs.tableTitle = data.altTitle.slice(0, 255);
  if (data.altDescription) attrs.tableDescription = data.altDescription.slice(0, 2000);
  return attrs;
}

/** Builds the table in the editor from its saved form (reverse of readTableAttrs). */
export function renderTableAttrs(table: HTMLTableElement, attrs: Record<string, unknown>) {
  const document = table.ownerDocument;
  const rows = attrs.rows as string[][];
  const formats = Array.isArray(attrs.cellFormats) ? (attrs.cellFormats as (CellFormat | null)[][]) : null;
  if (typeof attrs.tableLayout === "string") {
    table.setAttribute("data-table-layout", attrs.tableLayout);
    table.style.tableLayout = attrs.tableLayout === "window" ? "auto" : attrs.tableLayout;
    table.style.width = attrs.tableLayout === "fixed" ? "auto" : "100%";
  }
  if (typeof attrs.tableStyle === "string" && STYLE_IDS.has(attrs.tableStyle)) {
    table.dataset.tableStyle = attrs.tableStyle;
    for (const key of TABLE_STYLE_OPTION_KEYS) table.dataset[key] = String(typeof attrs[key] === "boolean" ? attrs[key] : DEFAULT_STYLE_OPTIONS[key]);
  }
  if (attrs.repeatHeader === true) table.dataset.repeatHeader = "true";
  if (attrs.tableAlign === "center" || attrs.tableAlign === "right") setTableAlign(table, attrs.tableAlign);
  if (typeof attrs.cellMarginTop === "number") setCellMargins(table, { top: attrs.cellMarginTop, bottom: Number(attrs.cellMarginBottom ?? 0), left: Number(attrs.cellMarginLeft ?? 0), right: Number(attrs.cellMarginRight ?? 0) });
  if (Array.isArray(attrs.colWidths)) { table.style.tableLayout = "fixed"; setColumnWidths(table, attrs.colWidths as (number | null)[]); }
  if (typeof attrs.tableWidth === "number") setTableWidth(table, attrs.tableWidth, attrs.tableWidthUnit === "pct" ? "pct" : "cm");
  if (typeof attrs.tableIndent === "number") setTableIndent(table, attrs.tableIndent);
  if (attrs.tableWrap === "around") setTableWrap(table, "around");
  if (typeof attrs.cellSpacing === "number") setCellSpacing(table, attrs.cellSpacing);
  setTableAltText(table, typeof attrs.tableTitle === "string" ? attrs.tableTitle : "", typeof attrs.tableDescription === "string" ? attrs.tableDescription : "");
  const body = table.appendChild(document.createElement("tbody"));
  rows.forEach((row, r) => {
    const tr = body.appendChild(document.createElement("tr"));
    const height = Array.isArray(attrs.rowHeights) ? (attrs.rowHeights as (number | null)[])[r] : null;
    if (typeof height === "number") tr.style.height = `${height}cm`;
    if (Array.isArray(attrs.rowHeightRules) && attrs.rowHeightRules[r] === "exactly") tr.dataset.heightRule = "exactly";
    if (Array.isArray(attrs.rowCantSplit) && attrs.rowCantSplit[r] === true) { tr.dataset.cantSplit = "true"; tr.style.breakInside = "avoid"; }
    row.forEach((text, c) => {
      const format = formats?.[r]?.[c] ?? null;
      if (format?.merged) return;
      const td = tr.appendChild(document.createElement("td"));
      td.className = "border p-2";
      td.textContent = text;
      if (format?.rowspan) td.rowSpan = format.rowspan;
      if (format?.colspan) td.colSpan = format.colspan;
      if (format?.shading) setShading(td, format.shading);
      for (const side of ["top", "right", "bottom", "left"] as BorderSide[]) { const value = format?.[SIDE_DATA[side] as "borderTop"]; if (value) setCellBorder(td, side, value); }
      if (format?.borderDiagonal) { td.dataset.borderDiagonal = format.borderDiagonal; td.style.backgroundImage = diagonalCss(format.borderDiagonal); }
      if (format?.textDirection) setTextDirection(td, format.textDirection);
      if (format && (typeof format.padTop === "number" || format.noWrap || format.fitText)) setCellOptions(td, { margins: typeof format.padTop === "number" ? { top: format.padTop, bottom: format.padBottom ?? 0, left: format.padLeft ?? 0, right: format.padRight ?? 0 } : null, wrapText: !format.noWrap, fitText: Boolean(format.fitText) });
      applyCellFormat(td, format);
    });
  });
}

export function setTableAlign(table: HTMLTableElement, align: "left" | "center" | "right") {
  if (align === "left") delete table.dataset.tableAlign; else table.dataset.tableAlign = align;
  table.style.marginLeft = align === "left" ? (table.dataset.tableIndent ? `${table.dataset.tableIndent}cm` : "") : "auto";
  table.style.marginRight = align === "right" ? "" : align === "center" ? "auto" : "";
}

export function setTableStyle(table: HTMLTableElement, styleId: string | null) {
  if (!styleId || !STYLE_IDS.has(styleId)) { delete table.dataset.tableStyle; for (const key of TABLE_STYLE_OPTION_KEYS) delete table.dataset[key]; return; }
  table.dataset.tableStyle = styleId;
  for (const key of TABLE_STYLE_OPTION_KEYS) if (table.dataset[key] === undefined) table.dataset[key] = String(DEFAULT_STYLE_OPTIONS[key]);
}

export function setStyleOption(table: HTMLTableElement, key: TableStyleOptionKey, on: boolean) {
  if (!table.dataset.tableStyle) setTableStyle(table, "table-grid");
  table.dataset[key] = String(on);
}

// ---------- Table Properties / Table Options / Cell Options ----------

/** Table Properties > Table > Preferred width (cm, or % of the page width). null = not set. */
export function setTableWidth(table: HTMLTableElement, width: number | null, unit: "cm" | "pct" = "cm") {
  if (width === null) { delete table.dataset.tableWidth; delete table.dataset.tableWidthUnit; table.style.width = table.dataset.tableLayout === "fixed" ? "auto" : ""; return; }
  table.dataset.tableWidth = String(round2(width));
  table.dataset.tableWidthUnit = unit;
  table.style.width = unit === "pct" ? `${round2(width)}%` : `${round2(width)}cm`;
}
export function tableWidth(table: HTMLTableElement): { width: number; unit: "cm" | "pct" } | null {
  const width = Number(table.dataset.tableWidth);
  return table.dataset.tableWidth !== undefined && Number.isFinite(width) ? { width, unit: table.dataset.tableWidthUnit === "pct" ? "pct" : "cm" } : null;
}

/** Table Properties > Table > Indent from left (cm; Word applies it to left-aligned tables only). */
export function setTableIndent(table: HTMLTableElement, cm: number) {
  if (!cm) { delete table.dataset.tableIndent; if (!table.dataset.tableAlign) table.style.marginLeft = ""; return; }
  table.dataset.tableIndent = String(round2(cm));
  if (!table.dataset.tableAlign) table.style.marginLeft = `${round2(cm)}cm`;
}
export const tableIndent = (table: HTMLTableElement) => Number(table.dataset.tableIndent) || 0;

/** Table Properties > Table > Text wrapping: None, or Around (text flows beside the table). */
export function setTableWrap(table: HTMLTableElement, wrap: "none" | "around") {
  if (wrap === "none") delete table.dataset.tableWrap; else table.dataset.tableWrap = "around";
}

/** Table Options > Allow spacing between cells (cm). null = off. */
export function setCellSpacing(table: HTMLTableElement, cm: number | null) {
  if (cm === null || cm <= 0) { delete table.dataset.cellSpacing; table.style.borderCollapse = ""; table.style.borderSpacing = ""; return; }
  table.dataset.cellSpacing = String(round2(cm));
  table.style.borderCollapse = "separate";
  table.style.borderSpacing = `${round2(cm)}cm`;
}
export const cellSpacing = (table: HTMLTableElement) => (table.dataset.cellSpacing !== undefined ? Number(table.dataset.cellSpacing) : null);

/** Table Properties > Row > Row height is: At least (default) or Exactly. */
export function setRowHeightRule(table: HTMLTableElement, rows: number[], rule: "atLeast" | "exactly") {
  for (const r of rows) { const tr = table.rows[r]; if (!tr) continue; if (rule === "exactly") tr.dataset.heightRule = "exactly"; else delete tr.dataset.heightRule; }
}
/** Table Properties > Row > Allow row to break across pages (on by default). */
export function setRowCanSplit(table: HTMLTableElement, rows: number[], allow: boolean) {
  for (const r of rows) { const tr = table.rows[r]; if (!tr) continue; if (allow) { delete tr.dataset.cantSplit; tr.style.breakInside = ""; } else { tr.dataset.cantSplit = "true"; tr.style.breakInside = "avoid"; } }
}

export type CellOptions = { margins: CellMargins | null; wrapText: boolean; fitText: boolean };
const PAD_KEYS = [["top", "padTop"], ["bottom", "padBottom"], ["left", "padLeft"], ["right", "padRight"]] as const;
/** Cell Options: own cell margins (null = "Same as the whole table"), Wrap text, Fit text. */
export function setCellOptions(cell: HTMLTableCellElement, options: CellOptions) {
  for (const [side, key] of PAD_KEYS) {
    if (options.margins) { cell.dataset[key] = String(round2(options.margins[side])); cell.style.setProperty(`padding-${side}`, `${round2(options.margins[side])}cm`); }
    else { delete cell.dataset[key]; cell.style.removeProperty(`padding-${side}`); }
  }
  if (options.wrapText) { delete cell.dataset.noWrap; cell.style.whiteSpace = ""; } else { cell.dataset.noWrap = "true"; cell.style.whiteSpace = "nowrap"; }
  if (options.fitText) cell.dataset.fitText = "true"; else delete cell.dataset.fitText;
}
export function cellOptions(cell: HTMLTableCellElement): CellOptions {
  const own = PAD_KEYS.every(([, key]) => cell.dataset[key] !== undefined);
  return {
    margins: own ? { top: Number(cell.dataset.padTop), bottom: Number(cell.dataset.padBottom), left: Number(cell.dataset.padLeft), right: Number(cell.dataset.padRight) } : null,
    wrapText: cell.dataset.noWrap !== "true",
    fitText: cell.dataset.fitText === "true",
  };
}

/** Table Properties > Alt Text: title and description. */
export function setTableAltText(table: HTMLTableElement, title: string, description: string) {
  if (title.trim()) table.dataset.altTitle = title.slice(0, 255); else delete table.dataset.altTitle;
  if (description.trim()) table.dataset.altDescription = description.slice(0, 2000); else delete table.dataset.altDescription;
  if (title.trim()) table.setAttribute("aria-label", title.slice(0, 255)); else table.removeAttribute("aria-label");
}
