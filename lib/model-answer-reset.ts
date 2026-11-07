// "Reset Q<n>" on the admin Model Answer pages (Word and Excel): undo ONE question's answer in the saved paper without
// touching the others. What a question changed is read from its marking checks (the paragraphs, words, page settings,
// cells... they look at); exactly those things go back to how the paper started. Another question's work on the same
// paragraph (its alignment when this question set its font, say) stays.

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const clone = <T,>(value: T): T => structuredClone(value);

// ---------------------------------------------------------------- Word

type Block = Json & { type?: string; runs?: Json[]; attrs?: Json; alignment?: unknown };
type WordDoc = Json & { blocks: Block[]; pageLayout?: Json };

const isHeaderFooter = (block: Block) => block.type === "header" || block.type === "footer";
const runText = (run: Json) => (typeof run.text === "string" ? run.text : "");
const blockText = (block: Block) => (Array.isArray(block.runs) ? block.runs.map(runText).join("") : "");

/** Index in doc.blocks of the place-th block of a kind, counted the way the server grades (rule_blocks). */
function blockIndex(doc: WordDoc, kind: string, place: number): number | null {
  let seen = -1;
  for (let index = 0; index < doc.blocks.length; index++) {
    const block = doc.blocks[index];
    const matches = kind === "header" || kind === "footer" ? block.type === kind : kind === "table" ? block.type === "table" : kind === "any" ? true : !isHeaderFooter(block);
    if (matches && ++seen === place) return index;
  }
  return null;
}
/** The pristine block at the same body place as doc.blocks[index] (paragraph counts match: the page refuses saves that change them). */
function pristineTwin(doc: WordDoc, pristine: WordDoc, index: number): Block | null {
  const block = doc.blocks[index];
  if (!block) return null;
  const kind = isHeaderFooter(block) ? String(block.type) : "body";
  let place = -1;
  for (let i = 0; i <= index; i++) if (kind === "body" ? !isHeaderFooter(doc.blocks[i]) : doc.blocks[i].type === kind) place++;
  const twin = blockIndex(pristine, kind, place);
  return twin === null ? null : pristine.blocks[twin];
}

/** Sets `fields` (or the text) of the runs inside [from, to) back to the pristine block's, splitting runs where needed. */
function revertRuns(block: Block, twin: Block, fields: string[] | "all", from = 0, to = Number.POSITIVE_INFINITY) {
  const runs = Array.isArray(block.runs) ? block.runs : [], twinRuns = Array.isArray(twin.runs) ? twin.runs : [];
  const text = blockText(block), twinText = blockText(twin);
  // Text of a different length (a word typed or deleted) cannot be matched character by character: whole paragraph back.
  if (text.length !== twinText.length || fields === "all") { block.runs = clone(twinRuns); return; }
  const cuts = new Set<number>([0, text.length, Math.max(0, from), Math.min(text.length, to)]);
  let at = 0; for (const run of runs) { at += runText(run).length; cuts.add(at); }
  at = 0; for (const run of twinRuns) { at += runText(run).length; cuts.add(at); }
  const points = [...cuts].filter((point) => point >= 0 && point <= text.length).sort((a, b) => a - b);
  const runAt = (list: Json[], offset: number) => { let start = 0; for (const run of list) { const end = start + runText(run).length; if (offset < end) return run; start = end; } return list[list.length - 1] ?? {}; };
  const pieces: Json[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (a === b) continue;
    const piece = clone(runAt(runs, a));
    piece.text = text.slice(a, b);
    if (a >= from && b <= to) {
      const source = runAt(twinRuns, a);
      for (const field of fields) {
        if (field === "text") piece.text = twinText.slice(a, b);
        else if (field in source) piece[field] = clone(source[field]); else delete piece[field];
      }
    }
    pieces.push(piece);
  }
  // Neighbouring pieces with the same formatting become one run again.
  const merged: Json[] = [];
  for (const piece of pieces) {
    const last = merged[merged.length - 1];
    if (last && JSON.stringify({ ...last, text: "" }) === JSON.stringify({ ...piece, text: "" })) last.text = runText(last) + runText(piece);
    else merged.push(piece);
  }
  block.runs = merged;
}

/** Offsets of the k-th run that has text (how the server numbers runs in a target like blocks.3.runs.2.bold). */
function textRunSpan(block: Block, k: number): [number, number] | null {
  let start = 0, seen = -1;
  for (const run of Array.isArray(block.runs) ? block.runs : []) {
    const length = runText(run).length;
    if (length > 0 && ++seen === k) return [start, start + length];
    start += length;
  }
  return null;
}

function revertBlockPath(block: Block, twin: Block, path: string[]) {
  // alignment | type | attrs.<field>[.deeper] -> the whole first-level value comes back.
  if (path[0] === "attrs") {
    const field = path[1];
    if (!field) { block.attrs = clone(twin.attrs ?? {}); return; }
    const attrs = isObject(block.attrs) ? block.attrs : (block.attrs = {});
    if (isObject(twin.attrs) && field in twin.attrs) attrs[field] = clone(twin.attrs[field]); else delete attrs[field];
    // A paragraph turned into a list item (numbering) goes back with its type.
    if (field === "listStyle" || field === "listLevel") block.type = twin.type;
    return;
  }
  if (path[0] === "type") { block.type = twin.type; if (isObject(twin.attrs)) block.attrs = clone(twin.attrs); return; }
  const key = path[0];
  if (key in twin) block[key] = clone(twin[key]); else delete block[key];
}

function revertHeaderFooter(doc: WordDoc, pristine: WordDoc, kind: "header" | "footer") {
  const kept = doc.blocks.filter((block) => block.type !== kind);
  const fresh = pristine.blocks.filter((block) => block.type === kind).map((block) => clone(block));
  doc.blocks = kind === "header" ? [...fresh, ...kept] : [...kept, ...fresh];
}

function revertPage(doc: WordDoc, pristine: WordDoc, key: string) {
  const layout = isObject(doc.pageLayout) ? doc.pageLayout : (doc.pageLayout = {});
  const source = isObject(pristine.pageLayout) ? pristine.pageLayout : {};
  layout[key] = key in source ? clone(source[key]) : null;
}

function wordFindSpans(block: Block, find: string, caseSensitive: boolean): [number, number][] {
  const text = blockText(block).replace(/ /g, " "), hay = caseSensitive ? text : text.toLowerCase(), needle = caseSensitive ? find : find.toLowerCase();
  const spans: [number, number][] = [];
  if (!needle) return spans;
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + needle.length)) spans.push([at, at + needle.length]);
  return spans;
}

/** Undoes one criterion (auto-built { target } or hand-written { rule, kind, place, ... }). Returns false when it names nothing that can be undone. */
function undoWordCriterion(doc: WordDoc, pristine: WordDoc, criterion: unknown): boolean {
  if (!isObject(criterion)) return false;
  if (criterion.rule === "anyOf") return (Array.isArray(criterion.criteria) ? criterion.criteria : []).map((item) => undoWordCriterion(doc, pristine, item)).some(Boolean);
  const kind = typeof criterion.kind === "string" ? criterion.kind : "body";
  if (kind === "header" || kind === "footer") { revertHeaderFooter(doc, pristine, kind); return true; }
  const place = typeof criterion.place === "number" ? criterion.place : null;
  const target = typeof criterion.target === "string" ? criterion.target : null;
  if (target?.startsWith("pageLayout.")) { revertPage(doc, pristine, target.split(".")[1]); return true; }

  // Which block: by kind + place, or by the absolute index in an auto-built target.
  let index: number | null = null;
  let path: string[] = [];
  if (target && /^blocks\.[0-9]+\./.test(target)) {
    const parts = target.split(".");
    index = place !== null && typeof criterion.kind === "string" ? blockIndex(doc, kind, place) : Number(parts[1]);
    path = parts.slice(2);
  } else if (place !== null) index = blockIndex(doc, kind, place);
  if (index === null || !doc.blocks[index]) return false;
  const block = doc.blocks[index];
  if (isHeaderFooter(block)) { revertHeaderFooter(doc, pristine, block.type as "header" | "footer"); return true; }
  const twin = pristineTwin(doc, pristine, index);
  if (!twin) return false;

  if (criterion.rule === "words" || criterion.rule === "run") {
    revertRuns(block, twin, Object.keys(isObject(criterion.props) ? criterion.props : {}).filter((key) => key !== "text").concat(isObject(criterion.props) && "text" in criterion.props ? ["text"] : []));
    return true;
  }
  if (criterion.rule === "text") {
    const props = isObject(criterion.props) ? Object.keys(criterion.props) : [];
    const fields = props.length ? props : ["text"]; // no props: it checks the text itself (typed words, UPPER CASE...)
    const spans = wordFindSpans(block, String(criterion.find ?? ""), Boolean(criterion.caseSensitive));
    for (const [from, to] of spans) revertRuns(block, twin, fields, from, to);
    return spans.length > 0;
  }
  if (criterion.rule === "table") {
    const attrs = isObject(block.attrs) ? block.attrs : (block.attrs = {});
    const twinAttrs = isObject(twin.attrs) ? twin.attrs : {};
    if ("headerAt" in criterion || "columns" in criterion || "rowCount" in criterion || "sortedColumn" in criterion) attrs.rows = clone(twinAttrs.rows);
    if ("cellProps" in criterion) attrs.cellFormats = clone(twinAttrs.cellFormats ?? null);
    if (isObject(criterion.attrs)) for (const key of Object.keys(criterion.attrs)) { if (key in twinAttrs) attrs[key] = clone(twinAttrs[key]); else delete attrs[key]; }
    return true;
  }
  if (path[0] === "runs" && /^[0-9]+$/.test(path[1] ?? "") && path[2]) {
    if (path[2] === "text") { revertRuns(block, twin, ["text"]); return true; }
    const span = textRunSpan(block, Number(path[1]));
    if (!span) return false;
    revertRuns(block, twin, [path[2]], span[0], span[1]);
    return true;
  }
  if (path.length) { revertBlockPath(block, twin, path); return true; }
  return false;
}

export type ResetResult<T> = { document: T; undone: number; skipped: number };

/** The saved Word paper with one question's answer undone. `criteria` are the question's checks (auto or hand-written). */
export function resetWordQuestion(current: unknown, pristine: unknown, criteria: unknown[]): ResetResult<unknown> {
  if (!isObject(current) || !Array.isArray(current.blocks) || !isObject(pristine) || !Array.isArray(pristine.blocks)) return { document: current, undone: 0, skipped: criteria.length };
  const doc = clone(current) as WordDoc, base = pristine as WordDoc;
  let undone = 0, skipped = 0;
  for (const criterion of criteria) { if (undoWordCriterion(doc, base, criterion)) undone++; else skipped++; }
  return { document: doc, undone, skipped };
}

// ---------------------------------------------------------------- Excel

type Sheet = Json & { cells: Record<string, Json>; merges?: string[]; sheet?: Json };
const columnNumber = (letters: string) => [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
const columnName = (n: number) => { let name = ""; for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) name = String.fromCharCode(65 + ((x - 1) % 26)) + name; return name; };
function rectOf(range: string): { r1: number; c1: number; r2: number; c2: number } | null {
  const [a, b = a] = range.toUpperCase().replace(/\$/g, "").split(":");
  const pa = /^([A-Z]{1,2})([0-9]{1,4})$/.exec(a), pb = /^([A-Z]{1,2})([0-9]{1,4})$/.exec(b);
  if (!pa || !pb) return null;
  const c1 = columnNumber(pa[1]), r1 = Number(pa[2]), c2 = columnNumber(pb[1]), r2 = Number(pb[2]);
  return { r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) };
}
const overlaps = (a: NonNullable<ReturnType<typeof rectOf>>, b: NonNullable<ReturnType<typeof rectOf>>) => a.r1 <= b.r2 && b.r1 <= a.r2 && a.c1 <= b.c2 && b.c1 <= a.c2;

function revertCells(sheet: Sheet, pristine: Sheet, range: string, keys: string[] | null) {
  const rect = rectOf(range);
  if (!rect) return false;
  for (let row = rect.r1; row <= rect.r2; row++) for (let col = rect.c1; col <= rect.c2; col++) {
    const ref = `${columnName(col)}${row}`, before = pristine.cells[ref];
    if (!keys) { if (before) sheet.cells[ref] = clone(before); else delete sheet.cells[ref]; continue; }
    const cell = sheet.cells[ref] ? { ...sheet.cells[ref] } : (before ? clone(before) : {});
    for (const key of keys) { if (before && key in before) cell[key] = clone(before[key]); else delete cell[key]; }
    sheet.cells[ref] = cell;
  }
  return true;
}

function revertSheetPath(sheet: Sheet, pristine: Sheet, path: string) {
  const parts = path.split(".");
  const read = (root: unknown) => parts.reduce<unknown>((value, part) => (isObject(value) ? value[part] : undefined), root);
  const settings = isObject(sheet.sheet) ? sheet.sheet : (sheet.sheet = {});
  let node: Json = settings;
  for (const part of parts.slice(0, -1)) node = isObject(node[part]) ? (node[part] as Json) : (node[part] = {});
  const value = read(pristine.sheet);
  node[parts[parts.length - 1]] = value === undefined ? null : clone(value);
}

function undoExcelCriterion(sheet: Sheet, pristine: Sheet, criterion: unknown): boolean {
  if (!isObject(criterion)) return false;
  if (criterion.rule === "cells" && typeof criterion.range === "string") {
    const keys = isObject(criterion.props) ? Object.keys(criterion.props) : null;
    // "value" in props means the cell's content: the whole cell comes back.
    return revertCells(sheet, pristine, criterion.range, keys && !keys.includes("value") ? keys : null);
  }
  if (criterion.rule === "value" && typeof criterion.cell === "string") return revertCells(sheet, pristine, criterion.cell, null);
  if (criterion.rule === "merged" && Array.isArray(criterion.ranges)) {
    const rects = criterion.ranges.map((range) => rectOf(String(range))).filter((rect): rect is NonNullable<typeof rect> => rect !== null);
    const hit = (range: string) => { const rect = rectOf(range); return rect !== null && rects.some((other) => overlaps(rect, other)); };
    sheet.merges = [...(sheet.merges ?? []).filter((range) => !hit(range)), ...(pristine.merges ?? []).filter(hit)];
    return rects.length > 0;
  }
  if (criterion.rule === "sheet" && typeof criterion.path === "string") { revertSheetPath(sheet, pristine, criterion.path); return true; }
  return false;
}

/** The saved Excel sheet with one question's answer undone. `criteria` are all the question's checks. */
export function resetExcelQuestion(current: unknown, pristine: unknown, criteria: unknown[]): ResetResult<unknown> {
  if (!isObject(current) || !isObject(current.cells) || !isObject(pristine) || !isObject(pristine.cells)) return { document: current, undone: 0, skipped: criteria.length };
  const sheet = clone(current) as Sheet, base = pristine as Sheet;
  let undone = 0, skipped = 0;
  for (const criterion of criteria) { if (undoExcelCriterion(sheet, base, criterion)) undone++; else skipped++; }
  return { document: sheet, undone, skipped };
}
