// Table cell formatting for the Word Efficiency editor.
//
// Real reported need: EFFICIENCY TEST 2's Q5 asks students to format a table
// ("font size 10 for the first column", "Top Centre alignment for the third
// row", "double strikethrough for the second row"). A saved table used to keep
// only each cell's TEXT (attrs.rows), so any table formatting a student did was
// lost on submit -- nothing a grader, automatic or human, could ever see.
//
// attrs.cellFormats sits next to attrs.rows, one entry per cell, and records
// the formatting of each cell's text. Only formatting that differs from plain
// text is stored (booleans only when on, alignment only when set), so an
// untouched table stays small and older documents without it stay valid.

export type CellAlign = "left" | "center" | "right" | "justify";
export type CellVerticalAlign = "top" | "middle" | "bottom";
export type CellFormat = {
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  doubleStrike?: boolean;
  color?: string;
  highlight?: string;
  align?: CellAlign;
  valign?: CellVerticalAlign;
  // Table Tools (lib/word-table-model.ts): a merged cell covers rowspan x colspan
  // grid positions; the positions it covers are saved as { merged: true }.
  rowspan?: number;
  colspan?: number;
  merged?: boolean;
  shading?: string;
  // "solid 0.5 000000" (style, width in pt, colour) or "none".
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
  // "down solid 0.5 000000" / "up ...": Word's diagonal borders.
  borderDiagonal?: string;
  textDirection?: "down" | "up";
};

export const CELL_FORMAT_KEYS = ["fontSize", "fontFamily", "bold", "italic", "underline", "strike", "doubleStrike", "color", "highlight", "align", "valign", "rowspan", "colspan", "merged", "shading", "borderTop", "borderRight", "borderBottom", "borderLeft", "borderDiagonal", "textDirection"] as const;
export const BORDER_VALUE = /^(none|(solid|double|dotted|dashed) (0\.25|0\.5|0\.75|1|1\.5|2\.25|3|4\.5|6) [0-9A-F]{6})$/i;
export const DIAGONAL_VALUE = /^(down|up) (solid|double|dotted|dashed) (0\.25|0\.5|0\.75|1|1\.5|2\.25|3|4\.5|6) [0-9A-F]{6}$/i;
const ALIGNS = new Set(["left", "center", "right", "justify"]);
const VALIGNS = new Set(["top", "middle", "bottom"]);

function hexColor(value: string): string | null {
  const match = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (!match) return /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1).toUpperCase() : null;
  if (match[4] !== undefined && Number(match[4]) === 0) return null;
  return [match[1], match[2], match[3]].map((part) => Number(part).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function firstTextNode(cell: Element): Text | null {
  const walker = cell.ownerDocument.createTreeWalker(cell, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if ((node.textContent ?? "").trim()) return node as Text;
  return null;
}

/** Reads the formatting of a cell's text the way it is shown on screen. */
export function readCellFormat(cell: HTMLTableCellElement): CellFormat {
  const view = cell.ownerDocument.defaultView;
  const format: CellFormat = {};
  const text = firstTextNode(cell);
  const ownVertical = cell.style.verticalAlign;
  if (VALIGNS.has(ownVertical)) format.valign = ownVertical as CellVerticalAlign;
  if (!text || !view) {
    const align = cell.style.textAlign;
    if (ALIGNS.has(align) && align !== "left") format.align = align as CellAlign;
    return format;
  }
  const parent = text.parentElement as HTMLElement;
  const style = view.getComputedStyle(parent);
  const size = Number.parseFloat(style.fontSize);
  if (Number.isFinite(size) && size > 0) format.fontSize = Math.round(size * 0.75 * 2) / 2;
  const family = style.fontFamily.split(",")[0]?.replace(/["']/g, "").trim();
  if (family) format.fontFamily = family;
  if (Number(style.fontWeight) >= 600) format.bold = true;
  if (style.fontStyle === "italic") format.italic = true;
  const color = hexColor(style.color);
  if (color) format.color = color;
  let underline = false, strike = false, doubleStrike = false, highlight: string | null = null;
  for (let element: HTMLElement | null = parent; element && element !== cell; element = element.parentElement) {
    const tag = element.tagName;
    if (tag === "U" || tag === "INS") underline = true;
    if (tag === "S" || tag === "STRIKE" || tag === "DEL") strike = true;
    const line = `${element.style.textDecorationLine} ${element.style.textDecoration}`;
    if (line.includes("underline") || element.dataset.underlineStyle) underline = true;
    if (line.includes("line-through")) { if (element.style.textDecorationStyle === "double" || element.dataset.doubleStrike === "true") doubleStrike = true; else strike = true; }
    if (element.dataset.doubleStrike === "true") doubleStrike = true;
    if (!highlight) highlight = hexColor(element.style.backgroundColor);
  }
  if (underline) format.underline = true;
  if (doubleStrike) format.doubleStrike = true;
  else if (strike) format.strike = true;
  if (highlight) format.highlight = highlight;
  const align = style.textAlign === "start" ? "left" : style.textAlign === "end" ? "right" : style.textAlign;
  if (ALIGNS.has(align) && align !== "left") format.align = align as CellAlign;
  return format;
}

/** Re-applies a saved cell format when a document is loaded back into the editor. */
export function applyCellFormat(cell: HTMLTableCellElement, format: CellFormat | null | undefined) {
  if (!format) return;
  if (format.align) cell.style.textAlign = format.align;
  if (format.valign) cell.style.verticalAlign = format.valign;
  const document = cell.ownerDocument;
  const span = document.createElement("span");
  if (format.fontSize) span.style.fontSize = `${format.fontSize}pt`;
  if (format.fontFamily) span.style.fontFamily = format.fontFamily;
  if (format.bold) span.style.fontWeight = "700";
  if (format.italic) span.style.fontStyle = "italic";
  if (format.color) span.style.color = `#${format.color}`;
  if (format.highlight) span.style.backgroundColor = `#${format.highlight}`;
  if (format.underline) { span.style.textDecorationLine = "underline"; span.dataset.underlineStyle = "single"; }
  let inner: HTMLElement = span;
  if (format.strike || format.doubleStrike) {
    inner = document.createElement("span");
    inner.style.textDecorationLine = "line-through";
    inner.style.textDecorationStyle = format.doubleStrike ? "double" : "solid";
    if (format.doubleStrike) span.dataset.doubleStrike = "true";
    span.append(inner);
  }
  inner.append(...cell.childNodes);
  cell.append(span);
}

/** Shape check shared by the client-side document validator. */
export function validCellFormats(value: unknown, rows: unknown[][]): boolean {
  if (!Array.isArray(value) || value.length !== rows.length) return false;
  return value.every((row, rowIndex) => Array.isArray(row) && row.length === rows[rowIndex].length && row.every((cell) => {
    if (cell === null) return true;
    if (!cell || typeof cell !== "object" || Array.isArray(cell)) return false;
    return Object.entries(cell as Record<string, unknown>).every(([key, item]) => {
      if (!(CELL_FORMAT_KEYS as readonly string[]).includes(key)) return false;
      if (key === "fontSize") return typeof item === "number" && item >= 1 && item <= 1638;
      if (key === "fontFamily") return typeof item === "string" && item.length <= 100;
      if (key === "color" || key === "highlight" || key === "shading") return typeof item === "string" && /^[0-9A-F]{6}$/i.test(item);
      if (key === "rowspan") return Number.isInteger(item) && (item as number) >= 1 && (item as number) <= 50;
      if (key === "colspan") return Number.isInteger(item) && (item as number) >= 1 && (item as number) <= 20;
      if (key === "borderTop" || key === "borderRight" || key === "borderBottom" || key === "borderLeft") return typeof item === "string" && BORDER_VALUE.test(item);
      if (key === "borderDiagonal") return typeof item === "string" && DIAGONAL_VALUE.test(item);
      if (key === "textDirection") return item === "down" || item === "up";
      if (key === "align") return typeof item === "string" && ALIGNS.has(item);
      if (key === "valign") return typeof item === "string" && VALIGNS.has(item);
      return typeof item === "boolean";
    });
  }));
}
