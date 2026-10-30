import { toExcelDocumentV3, type ExcelDocument, type ExcelDocumentV2, type SheetCell } from "./excel-document.ts";

// Turns what the admin changed in the sheet while solving a question (the Model Answer page) into marking rules,
// in the criteria the database marks with (excel_efficiency_criterion_matches, migration 202610251700):
//   cells {range, props}   merged {ranges}   value {cell, equals}   sheet {path, equals|in|contains}
// A change is only a TARGET (a cell and what about it changed, a merged range, a sheet setting); the value each
// rule expects is read from the finished model sheet, so a later edit to the same cell is not lost.
type Sheet = ExcelDocument | ExcelDocumentV2;

export type ExcelChange =
  | { kind: "cell"; cell: string; keys: string[] }
  | { kind: "value"; cell: string }
  | { kind: "merge"; range: string }
  | { kind: "sheet"; path: string };
export type ExcelCriterion = Record<string, unknown>;
export type ExcelRuleGroup = { description: string; criteria: ExcelCriterion[] };
export type ExcelDiff = { changes: ExcelChange[]; unsupported: string[] };

const STYLE_KEYS = ["bold", "italic", "underline", "fontColor", "fillColor", "border", "numberFormat", "align", "fontSize", "fontFamily", "vAlign", "wrap", "rotate", "indent", "strike", "decimals", "underlineStyle", "vertAlign", "shrink", "currency"] as const;
const BOOLEAN_KEYS = new Set(["bold", "italic", "underline", "wrap", "strike"]);
const SHEET_PATHS = ["gridlines", "headings", "formulaBar", "printGridlines", "printHeadings", "printArea", "orientation", "paperSize", "margins", "zoom", "name", "freeze", "filter", "protected", "scale", "fitWidth", "fitHeight", "centerHorizontally", "centerVertically", "tabColor", "printTitleRows", "printTitleCols", "header.left", "header.center", "header.right", "footer.left", "footer.center", "footer.right"];
const UNSUPPORTED_SHEET_KEYS: [string, string][] = [["conditionalFormats", "conditional formatting"], ["charts", "charts"], ["validations", "data validation"], ["hiddenRows", "hidden rows"], ["hiddenCols", "hidden columns"], ["colWidths", "column widths"], ["rowHeights", "row heights"], ["rowBreaks", "page breaks"], ["definedNames", "named ranges"], ["filterHidden", "filter choices"]];

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// The same defaults the database applies when it reads a cell property (excel_efficiency_cell_prop).
function styleValue(cell: SheetCell | undefined, key: string): unknown {
  const raw = (cell as Record<string, unknown> | undefined)?.[key];
  if (BOOLEAN_KEYS.has(key)) return raw === true;
  if (key === "fontSize") return typeof raw === "number" ? raw : 11;
  if (key === "fontFamily") return typeof raw === "string" ? raw : "Calibri";
  if (key === "vAlign") return typeof raw === "string" ? raw : "bottom";
  if (key === "rotate" || key === "indent") return typeof raw === "number" ? raw : 0;
  if (key === "fontColor" || key === "fillColor") return typeof raw === "string" ? raw.toUpperCase() : null;
  if (key === "numberFormat") return typeof raw === "string" ? raw : "General";
  return raw === undefined ? null : raw;
}

// A typed number is a number whether the cell kept it as text or as a number.
function contentValue(cell: SheetCell | undefined): string | number | null {
  const raw = cell?.value;
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return raw;
  return /^\s*-?[0-9]+(\.[0-9]+)?\s*$/.test(raw) ? Number(raw) : raw;
}

const stripDollar = (value: string) => value.replace(/\$/g, "").toUpperCase();
function sheetValue(sheet: Sheet, path: string): unknown {
  const settings = ((toExcelDocumentV3(sheet)?.sheet ?? {}) as unknown) as Record<string, unknown>;
  const value = path.split(".").reduce<unknown>((current, part) => (current && typeof current === "object" ? (current as Record<string, unknown>)[part] : undefined), settings);
  if (path === "printArea" && typeof value === "string") return stripDollar(value);
  if (path.startsWith("header.") || path.startsWith("footer.")) return typeof value === "string" ? value : "";
  return value === undefined ? null : value;
}

export function diffExcelDocuments(beforeSheet: unknown, afterSheet: unknown): ExcelDiff {
  const before = toExcelDocumentV3(beforeSheet as Sheet), after = toExcelDocumentV3(afterSheet as Sheet);
  if (!before || !after) return { changes: [], unsupported: [] };
  const changes: ExcelChange[] = [], unsupported: string[] = [];
  const refs = [...new Set([...Object.keys(before.cells), ...Object.keys(after.cells)])].sort(compareRefs);
  for (const ref of refs) {
    const a = before.cells[ref], b = after.cells[ref];
    const keys = STYLE_KEYS.filter((key) => !same(styleValue(a, key), styleValue(b, key)));
    if (keys.length) changes.push({ kind: "cell", cell: ref, keys: [...keys] });
    if (!same(contentValue(a), contentValue(b))) changes.push({ kind: "value", cell: ref });
  }
  const beforeMerges = new Set(before.merges.map((range) => range.toUpperCase()));
  for (const range of after.merges) if (!beforeMerges.has(range.toUpperCase())) changes.push({ kind: "merge", range: range.toUpperCase() });
  for (const path of SHEET_PATHS) {
    const x = sheetValue(before, path), y = sheetValue(after, path);
    if (same(x, y)) continue;
    if ((path.startsWith("header.") || path.startsWith("footer.")) && y === "") { unsupported.push(`removing the ${path.replace(".", " ")} text`); continue; }
    changes.push({ kind: "sheet", path });
  }
  const beforeSettings = before.sheet as unknown as Record<string, unknown>, afterSettings = after.sheet as unknown as Record<string, unknown>;
  for (const [key, label] of UNSUPPORTED_SHEET_KEYS) if (!same(beforeSettings[key], afterSettings[key])) unsupported.push(label);
  return { changes, unsupported };
}

// ---------- cell references ----------
function parseRef(ref: string): { col: number; row: number } {
  const match = /^([A-Z]{1,2})([0-9]{1,3})$/.exec(ref.toUpperCase());
  if (!match) return { col: 0, row: 0 };
  const letters = match[1];
  return { col: letters.split("").reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0), row: Number(match[2]) };
}
function columnName(index: number): string {
  let name = "", n = index;
  while (n > 0) { name = String.fromCharCode(65 + ((n - 1) % 26)) + name; n = Math.floor((n - 1) / 26); }
  return name;
}
const compareRefs = (a: string, b: string) => { const x = parseRef(a), y = parseRef(b); return x.row - y.row || x.col - y.col; };

// Cells as the fewest rectangles: runs along each row, then identical runs on consecutive rows joined.
export function cellsToRanges(refs: string[]): string[] {
  const rows = new Map<number, number[]>();
  for (const ref of refs) { const { col, row } = parseRef(ref); if (!col || !row) continue; rows.set(row, [...(rows.get(row) ?? []), col]); }
  type Run = { top: number; bottom: number; left: number; right: number };
  const open = new Map<string, Run>(), done: Run[] = [];
  for (const row of [...rows.keys()].sort((a, b) => a - b)) {
    const cols = [...new Set(rows.get(row))].sort((a, b) => a - b), runs: [number, number][] = [];
    for (const col of cols) { const last = runs[runs.length - 1]; if (last && last[1] === col - 1) last[1] = col; else runs.push([col, col]); }
    const next = new Map<string, Run>();
    for (const [left, right] of runs) {
      const key = `${left}:${right}`, previous = open.get(key);
      if (previous && previous.bottom === row - 1) { previous.bottom = row; next.set(key, previous); open.delete(key); }
      else next.set(key, { top: row, bottom: row, left, right });
    }
    for (const run of open.values()) done.push(run);
    open.clear(); for (const [key, run] of next) open.set(key, run);
  }
  for (const run of open.values()) done.push(run);
  return done.sort((a, b) => a.top - b.top || a.left - b.left).map((run) => {
    const first = `${columnName(run.left)}${run.top}`, last = `${columnName(run.right)}${run.bottom}`;
    return first === last ? first : `${first}:${last}`;
  });
}

// ---------- rules ----------
// What a cell property may be: a cleared number format is the same as General, whichever way it was stored.
function allowed(key: string, value: unknown): unknown[] {
  if (key === "numberFormat" && value === "General") return ["General", null];
  return [value];
}
function sheetCriterion(path: string, value: unknown): ExcelCriterion | null {
  if (path === "printArea") return value === null ? { rule: "sheet", path, equals: null } : { rule: "sheet", path, in: [value] };
  if (path.startsWith("header.") || path.startsWith("footer.")) return typeof value === "string" && value ? { rule: "sheet", path, contains: value } : null;
  return { rule: "sheet", path, equals: value };
}
const describeRanges = (ranges: string[]) => ranges.join(", ");

// The rules for one question: each independent thing it asks becomes a group (a part of the question's marks).
export function excelRuleGroups(finalSheet: unknown, changes: ExcelChange[]): ExcelRuleGroup[] {
  const sheet = toExcelDocumentV3(finalSheet as Sheet);
  if (!sheet) return [];
  const groups: ExcelRuleGroup[] = [];
  // Formatting: cells that were given the same formatting are one group.
  const formatKeys = new Map<string, Set<string>>();
  for (const change of changes) if (change.kind === "cell") formatKeys.set(change.cell, new Set([...(formatKeys.get(change.cell) ?? []), ...change.keys]));
  const bySignature = new Map<string, { props: Record<string, unknown[]>; cells: string[] }>();
  for (const [cell, keys] of formatKeys) {
    const props: Record<string, unknown[]> = {};
    for (const key of [...keys].sort()) props[key] = allowed(key, styleValue(sheet.cells[cell], key));
    const signature = JSON.stringify(props), entry = bySignature.get(signature);
    if (entry) entry.cells.push(cell); else bySignature.set(signature, { props, cells: [cell] });
  }
  for (const { props, cells } of bySignature.values()) {
    const ranges = cellsToRanges(cells);
    groups.push({ description: `Formatting of ${describeRanges(ranges)} (${Object.keys(props).join(", ")})`, criteria: ranges.map((range) => ({ rule: "cells", range, props })) });
  }
  for (const change of changes) {
    if (change.kind === "value") {
      const value = contentValue(sheet.cells[change.cell]);
      groups.push({ description: `Content of ${change.cell}`, criteria: [value === null ? { rule: "cells", range: change.cell, props: { value: [null, ""] } } : { rule: "value", cell: change.cell, equals: value }] });
    } else if (change.kind === "merge") {
      groups.push({ description: `${change.range} merged`, criteria: [{ rule: "merged", ranges: [change.range] }] });
    } else if (change.kind === "sheet") {
      const criterion = sheetCriterion(change.path, sheetValue(sheet, change.path));
      if (criterion) groups.push({ description: `Sheet setting ${change.path}`, criteria: [criterion] });
    }
  }
  return groups;
}

// Marks shared equally between the groups to the cent; the last group takes the rounding.
export function splitMarks(total: number, parts: number): number[] {
  if (parts <= 1) return [Math.round(total * 100) / 100];
  const base = Math.floor((total / parts) * 100) / 100;
  const marks = Array<number>(parts).fill(base);
  marks[parts - 1] = Math.round((total - base * (parts - 1)) * 100) / 100;
  return marks;
}

export type ExcelQuestionRule = { allocatedMarks: number; partLabel: string | null; additionalCriteria: ExcelCriterion[] };

// A question's rules as saved: its marks split over the groups, a), b), c)... (more than 26 are joined into the last).
export function excelQuestionRules(marks: number, groups: ExcelRuleGroup[]): ExcelQuestionRule[] {
  if (!groups.length || !(marks > 0)) return [];
  const merged = groups.length <= 26 ? groups : [...groups.slice(0, 25), { description: "The rest", criteria: groups.slice(25).flatMap((group) => group.criteria) }];
  const shares = splitMarks(marks, merged.length);
  return merged.map((group, index) => ({ allocatedMarks: shares[index], partLabel: merged.length === 1 ? null : String.fromCharCode(97 + index), additionalCriteria: group.criteria }));
}
