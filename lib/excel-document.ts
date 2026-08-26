export const EXCEL_SUPPORTED_COMMANDS = new Set(["bold", "italic", "underline", "fontColor", "fillColor", "border", "numberFormat", "align", "sortAscending", "sortDescending", "insertRow", "deleteRow", "insertColumn", "deleteColumn"]);

type JsonObject = Record<string, unknown>;
const CELL_FIELDS = new Set(["value", "formula", "bold", "italic", "underline", "fontColor", "fillColor", "border", "numberFormat", "align"]);
const NUMBER_FORMATS = new Set(["General", "Number", "Currency", "Percentage"]);
const ALIGNMENTS = new Set(["left", "center", "right"]);
const object = (value: unknown): value is JsonObject => Boolean(value && typeof value === "object" && !Array.isArray(value));
const exact = (value: JsonObject, keys: Set<string>) => Object.keys(value).every((key) => keys.has(key)) && [...keys].every((key) => key in value);
const hexColor = (value: unknown) => value === null || (typeof value === "string" && /^[0-9A-Fa-f]{6}$/.test(value));
const CELL_REF = /^[A-Z]{1,2}[0-9]{1,3}$/;
const FORMULA = /^=[A-Za-z0-9():,+\-*/.\s]{0,200}$/;

function validateCell(ref: string, cell: unknown) {
  if (!CELL_REF.test(ref)) throw new Error(`Invalid cell reference ${ref}.`);
  if (!object(cell) || !exact(cell, CELL_FIELDS)) throw new Error(`Invalid cell fields at ${ref}.`);
  if (!["string", "number"].includes(typeof cell.value) && cell.value !== null) throw new Error(`Invalid cell value at ${ref}.`);
  if (typeof cell.value === "string" && cell.value.length > 1000) throw new Error(`Cell value too long at ${ref}.`);
  if (cell.formula !== null && (typeof cell.formula !== "string" || !FORMULA.test(cell.formula))) throw new Error(`Invalid formula at ${ref}.`);
  if (typeof cell.bold !== "boolean" || typeof cell.italic !== "boolean" || typeof cell.underline !== "boolean") throw new Error(`Invalid style flags at ${ref}.`);
  if (!hexColor(cell.fontColor)) throw new Error(`Invalid font color at ${ref}.`);
  if (!hexColor(cell.fillColor)) throw new Error(`Invalid fill color at ${ref}.`);
  if (cell.border !== null && (typeof cell.border !== "string" || cell.border.length > 50)) throw new Error(`Invalid border at ${ref}.`);
  if (cell.numberFormat !== null && (typeof cell.numberFormat !== "string" || !NUMBER_FORMATS.has(cell.numberFormat))) throw new Error(`Invalid number format at ${ref}.`);
  if (cell.align !== null && (typeof cell.align !== "string" || !ALIGNMENTS.has(cell.align))) throw new Error(`Invalid alignment at ${ref}.`);
}

function validateCells(cells: unknown) {
  if (!object(cells)) throw new Error("Sheet cells must be an object.");
  const entries = Object.entries(cells);
  if (entries.length > 5000) throw new Error("Sheet has too many cells.");
  for (const [ref, cell] of entries) validateCell(ref, cell);
}

export function validateExcelDocument(value: unknown) {
  if (!object(value) || value.schemaVersion !== "2") throw new Error("Invalid structured sheet snapshot.");
  if (!exact(value, new Set(["schemaVersion", "rows", "cols", "cells", "operations", "savedAt"]))) throw new Error("Unknown sheet document field.");
  if (typeof value.rows !== "number" || value.rows < 1 || value.rows > 200) throw new Error("Invalid row count.");
  if (typeof value.cols !== "number" || value.cols < 1 || value.cols > 26) throw new Error("Invalid column count.");
  if (!Array.isArray(value.operations) || value.operations.length > 256 || value.operations.some((op) => typeof op !== "string" || op.length > 60)) throw new Error("Invalid operation history.");
  if (typeof value.savedAt !== "string" || value.savedAt.length > 64 || !Number.isFinite(Date.parse(value.savedAt))) throw new Error("Invalid saved timestamp.");
  validateCells(value.cells);
  if (JSON.stringify(value).length > 2097152) throw new Error("Structured sheet is too large.");
  return value;
}

export function validateExcelOperations(value: unknown) {
  const document = validateExcelDocument(value) as JsonObject;
  for (const operation of document.operations as string[]) if (!EXCEL_SUPPORTED_COMMANDS.has(operation.split(":")[0])) throw new Error(`Sheet command ${operation} is not recognized.`);
  return document;
}
