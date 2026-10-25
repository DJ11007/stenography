// A saved Excel Efficiency sheet. Version "3" (the Excel 2013-like workspace) adds font size / font /
// vertical alignment / wrap per cell, merged ranges and the sheet's page settings; version "2" sheets
// (older attempts and the starting sheet) are read as version 3 with Excel's defaults.
export const EXCEL_SUPPORTED_COMMANDS = new Set([
  "bold", "italic", "underline", "fontColor", "fillColor", "border", "numberFormat", "align", "sortAscending", "sortDescending",
  "insertRow", "deleteRow", "insertColumn", "deleteColumn",
  "fontSize", "fontFamily", "vAlign", "wrap", "mergeCenter", "mergeAcross", "mergeCells", "unmerge", "formatPainter", "clearFormats", "clearContents",
  "copy", "cut", "paste", "autoSum", "gridlines", "headings", "formulaBar", "printGridlines", "printHeadings", "printArea", "clearPrintArea",
  "orientation", "paperSize", "margins", "header", "footer", "pageNumber", "formula",
  "formatCells", "rotate", "indent", "decimals", "fillDown", "fillRight", "pasteValues", "pasteFormatting", "cellStyle", "edit",
]);

export type SheetCell = {
  value: string | number | null; formula: string | null; bold: boolean; italic: boolean; underline: boolean;
  fontColor: string | null; fillColor: string | null; border: string | null;
  numberFormat: "General" | "Number" | "Currency" | "Percentage"; align: "left" | "center" | "right" | null;
  fontSize?: number | null; fontFamily?: string | null; vAlign?: "top" | "middle" | "bottom" | null; wrap?: boolean | null;
  // Format Cells extras: text angle (-90..90 degrees, 255 = vertical text), indent level, strikethrough, decimal places.
  rotate?: number | null; indent?: number | null; strike?: boolean | null; decimals?: number | null;
};
export type HeaderFooter = { left?: string; center?: string; right?: string };
export type PaperSize = "Letter" | "Legal" | "A4" | "A5" | "A3" | "Executive" | "Tabloid" | "B5";
export type SheetSettings = {
  gridlines: boolean; headings: boolean; formulaBar: boolean; printGridlines: boolean; printHeadings: boolean;
  printArea: string | null; orientation: "portrait" | "landscape"; paperSize: PaperSize; margins: "Normal" | "Wide" | "Narrow";
  header: HeaderFooter; footer: HeaderFooter; zoom: number;
};
export type ExcelDocumentV2 = { schemaVersion: "2"; rows: number; cols: number; cells: Record<string, SheetCell>; operations: string[]; savedAt: string };
export type ExcelDocument = { schemaVersion: "3"; rows: number; cols: number; cells: Record<string, SheetCell>; merges: string[]; sheet: SheetSettings; operations: string[]; savedAt: string };

export const DEFAULT_SHEET_SETTINGS: SheetSettings = {
  gridlines: true, headings: true, formulaBar: true, printGridlines: false, printHeadings: false,
  printArea: null, orientation: "portrait", paperSize: "Letter", margins: "Normal", header: {}, footer: {}, zoom: 100,
};
export const PAPER_SIZES: PaperSize[] = ["Letter", "Legal", "A4", "A5", "A3", "Executive", "Tabloid", "B5"];

/** Any saved sheet (version 2 or 3) as a version 3 sheet. */
export function toExcelDocumentV3(document: ExcelDocument | ExcelDocumentV2 | null | undefined): ExcelDocument | null {
  if (!document || typeof document !== "object") return null;
  if (document.schemaVersion === "3") return { ...document, merges: document.merges ?? [], sheet: { ...DEFAULT_SHEET_SETTINGS, ...(document.sheet ?? {}) } };
  if (document.schemaVersion === "2") return { schemaVersion: "3", rows: document.rows, cols: document.cols, cells: document.cells ?? {}, merges: [], sheet: { ...DEFAULT_SHEET_SETTINGS }, operations: document.operations ?? [], savedAt: document.savedAt };
  return null;
}

type JsonObject = Record<string, unknown>;
const CELL_FIELDS = new Set(["value", "formula", "bold", "italic", "underline", "fontColor", "fillColor", "border", "numberFormat", "align"]);
const OPTIONAL_CELL_FIELDS = new Set(["fontSize", "fontFamily", "vAlign", "wrap", "rotate", "indent", "strike", "decimals"]);
const NUMBER_FORMATS = new Set(["General", "Number", "Currency", "Percentage"]);
const ALIGNMENTS = new Set(["left", "center", "right"]);
const V_ALIGNMENTS = new Set(["top", "middle", "bottom"]);
const SHEET_KEYS = new Set(["gridlines", "headings", "formulaBar", "printGridlines", "printHeadings", "printArea", "orientation", "paperSize", "margins", "header", "footer", "zoom"]);
const object = (value: unknown): value is JsonObject => Boolean(value && typeof value === "object" && !Array.isArray(value));
const hexColor = (value: unknown) => value === null || (typeof value === "string" && /^[0-9A-Fa-f]{6}$/.test(value));
const CELL_REF = /^[A-Z]{1,2}[0-9]{1,3}$/;
const RANGE = /^[A-Z]{1,2}[0-9]{1,3}:[A-Z]{1,2}[0-9]{1,3}$/;
const PRINT_AREA = /^\$?[A-Z]{1,2}\$?[0-9]{1,3}(:\$?[A-Z]{1,2}\$?[0-9]{1,3})?$/;
export const EXCEL_FORMULA = /^=[A-Za-z0-9():,+\-*/.\s$<>="&%]{0,200}$/;

function validateCell(ref: string, cell: unknown) {
  if (!CELL_REF.test(ref)) throw new Error(`Invalid cell reference ${ref}.`);
  if (!object(cell) || ![...CELL_FIELDS].every((key) => key in cell) || Object.keys(cell).some((key) => !CELL_FIELDS.has(key) && !OPTIONAL_CELL_FIELDS.has(key))) throw new Error(`Invalid cell fields at ${ref}.`);
  if (!["string", "number"].includes(typeof cell.value) && cell.value !== null) throw new Error(`Invalid cell value at ${ref}.`);
  if (typeof cell.value === "string" && cell.value.length > 1000) throw new Error(`Cell value too long at ${ref}.`);
  if (cell.formula !== null && (typeof cell.formula !== "string" || !EXCEL_FORMULA.test(cell.formula))) throw new Error(`Invalid formula at ${ref}.`);
  if (typeof cell.bold !== "boolean" || typeof cell.italic !== "boolean" || typeof cell.underline !== "boolean") throw new Error(`Invalid style flags at ${ref}.`);
  if (!hexColor(cell.fontColor)) throw new Error(`Invalid font color at ${ref}.`);
  if (!hexColor(cell.fillColor)) throw new Error(`Invalid fill color at ${ref}.`);
  if (cell.border !== null && (typeof cell.border !== "string" || cell.border.length > 50)) throw new Error(`Invalid border at ${ref}.`);
  if (cell.numberFormat !== null && (typeof cell.numberFormat !== "string" || !NUMBER_FORMATS.has(cell.numberFormat))) throw new Error(`Invalid number format at ${ref}.`);
  if (cell.align !== null && (typeof cell.align !== "string" || !ALIGNMENTS.has(cell.align))) throw new Error(`Invalid alignment at ${ref}.`);
  if ("fontSize" in cell && cell.fontSize !== null && (typeof cell.fontSize !== "number" || cell.fontSize < 1 || cell.fontSize > 409)) throw new Error(`Invalid font size at ${ref}.`);
  if ("fontFamily" in cell && cell.fontFamily !== null && (typeof cell.fontFamily !== "string" || cell.fontFamily.length > 60)) throw new Error(`Invalid font at ${ref}.`);
  if ("vAlign" in cell && cell.vAlign !== null && (typeof cell.vAlign !== "string" || !V_ALIGNMENTS.has(cell.vAlign))) throw new Error(`Invalid vertical alignment at ${ref}.`);
  if ("wrap" in cell && cell.wrap !== null && typeof cell.wrap !== "boolean") throw new Error(`Invalid wrap text at ${ref}.`);
  if ("rotate" in cell && cell.rotate !== null && (typeof cell.rotate !== "number" || !((cell.rotate >= -90 && cell.rotate <= 90) || cell.rotate === 255))) throw new Error(`Invalid text orientation at ${ref}.`);
  if ("indent" in cell && cell.indent !== null && (typeof cell.indent !== "number" || cell.indent < 0 || cell.indent > 15)) throw new Error(`Invalid indent at ${ref}.`);
  if ("strike" in cell && cell.strike !== null && typeof cell.strike !== "boolean") throw new Error(`Invalid strikethrough at ${ref}.`);
  if ("decimals" in cell && cell.decimals !== null && (typeof cell.decimals !== "number" || cell.decimals < 0 || cell.decimals > 10)) throw new Error(`Invalid decimal places at ${ref}.`);
}

function validateCells(cells: unknown) {
  if (!object(cells)) throw new Error("Sheet cells must be an object.");
  const entries = Object.entries(cells);
  if (entries.length > 5000) throw new Error("Sheet has too many cells.");
  for (const [ref, cell] of entries) validateCell(ref, cell);
}

function validateSheet(sheet: unknown) {
  if (!object(sheet) || JSON.stringify(sheet).length > 4000) throw new Error("Invalid sheet settings.");
  for (const [key, value] of Object.entries(sheet)) {
    if (!SHEET_KEYS.has(key)) throw new Error(`Unknown sheet setting ${key}.`);
    if (["gridlines", "headings", "formulaBar", "printGridlines", "printHeadings"].includes(key) && typeof value !== "boolean") throw new Error(`Invalid sheet option ${key}.`);
  }
  if (sheet.printArea != null && (typeof sheet.printArea !== "string" || !PRINT_AREA.test(sheet.printArea))) throw new Error("Invalid print area.");
  if ("orientation" in sheet && !["portrait", "landscape"].includes(String(sheet.orientation))) throw new Error("Invalid orientation.");
  if ("paperSize" in sheet && !PAPER_SIZES.includes(sheet.paperSize as PaperSize)) throw new Error("Invalid paper size.");
  if ("margins" in sheet && !["Normal", "Wide", "Narrow"].includes(String(sheet.margins))) throw new Error("Invalid margins.");
  if ("zoom" in sheet && (typeof sheet.zoom !== "number" || sheet.zoom < 10 || sheet.zoom > 400)) throw new Error("Invalid zoom.");
  for (const part of ["header", "footer"] as const) {
    if (!(part in sheet)) continue;
    const value = sheet[part];
    if (!object(value) || Object.entries(value).some(([key, text]) => !["left", "center", "right"].includes(key) || typeof text !== "string" || text.length > 255)) throw new Error(`Invalid ${part}.`);
  }
}

export function validateExcelDocument(value: unknown) {
  if (!object(value) || (value.schemaVersion !== "2" && value.schemaVersion !== "3")) throw new Error("Invalid structured sheet snapshot.");
  const allowed = value.schemaVersion === "3" ? ["schemaVersion", "rows", "cols", "cells", "merges", "sheet", "operations", "savedAt"] : ["schemaVersion", "rows", "cols", "cells", "operations", "savedAt"];
  if (!["schemaVersion", "rows", "cols", "cells", "operations", "savedAt"].every((key) => key in value) || Object.keys(value).some((key) => !allowed.includes(key))) throw new Error("Unknown sheet document field.");
  if (typeof value.rows !== "number" || value.rows < 1 || value.rows > 200) throw new Error("Invalid row count.");
  if (typeof value.cols !== "number" || value.cols < 1 || value.cols > 26) throw new Error("Invalid column count.");
  if (!Array.isArray(value.operations) || value.operations.length > 256 || value.operations.some((op) => typeof op !== "string" || op.length > 60)) throw new Error("Invalid operation history.");
  if (typeof value.savedAt !== "string" || value.savedAt.length > 64 || !Number.isFinite(Date.parse(value.savedAt))) throw new Error("Invalid saved timestamp.");
  if ("merges" in value && (!Array.isArray(value.merges) || value.merges.length > 500 || value.merges.some((range) => typeof range !== "string" || !RANGE.test(range)))) throw new Error("Invalid merged cells.");
  if ("sheet" in value) validateSheet(value.sheet);
  validateCells(value.cells);
  if (JSON.stringify(value).length > 2097152) throw new Error("Structured sheet is too large.");
  return value;
}

export function validateExcelOperations(value: unknown) {
  const document = validateExcelDocument(value) as JsonObject;
  for (const operation of document.operations as string[]) if (!EXCEL_SUPPORTED_COMMANDS.has(operation.split(":")[0])) throw new Error(`Sheet command ${operation} is not recognized.`);
  return document;
}
