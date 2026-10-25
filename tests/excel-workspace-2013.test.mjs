import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { applyBorder, autoSumRange, borderCss, expandForMerges, formatCellValue, mergeAt, mergeRanges, parseEntry, parseRange, rangeString, recomputeFormulas, shiftColumns, shiftRows, unmergeRanges, usedExtent, EMPTY_CELL } from "../lib/excel-sheet-model.ts";
import { DEFAULT_SHEET_SETTINGS, toExcelDocumentV3, validateExcelDocument, validateExcelOperations } from "../lib/excel-document.ts";
import { evaluateFormula } from "../lib/excel-formula.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const cell = (patch = {}) => ({ ...EMPTY_CELL, ...patch });

test("ranges, merged cells and selections grow over merged areas as in Excel", () => {
  assert.deepEqual(parseRange("A27:L27"), { r1: 27, c1: 0, r2: 27, c2: 11 });
  assert.deepEqual(parseRange("$A$1:$L$31"), { r1: 1, c1: 0, r2: 31, c2: 11 });
  assert.equal(rangeString({ r1: 5, c1: 1, r2: 5, c2: 1 }), "B5");
  const merges = ["A1:G1"];
  assert.deepEqual(mergeAt(merges, 1, 3), { r1: 1, c1: 0, r2: 1, c2: 6 });
  assert.deepEqual(expandForMerges({ r1: 1, c1: 2, r2: 2, c2: 2 }, merges), { r1: 1, c1: 0, r2: 2, c2: 6 });
});

test("Merge & Center / Merge Across / Unmerge, keeping only the upper-left value", () => {
  const cells = { A1: cell({ value: "Title" }), B1: cell({ value: "x" }) };
  const merged = mergeRanges(cells, [], parseRange("A1:C1"), false);
  assert.deepEqual(merged.merges, ["A1:C1"]);
  assert.equal(merged.cells.B1.value, null);
  assert.equal(merged.discarded, true);
  assert.deepEqual(mergeRanges({}, [], parseRange("A28:L31"), true).merges, ["A28:L28", "A29:L29", "A30:L30", "A31:L31"]);
  assert.deepEqual(unmergeRanges(["A1:C1", "A5:B5"], parseRange("B1")), ["A5:B5"]);
});

test("inserting and deleting rows and columns moves cells and merged ranges", () => {
  const cells = { A2: cell({ value: 1 }), A5: cell({ value: 5 }) };
  const inserted = shiftRows(cells, ["A5:C5"], 3, 1);
  assert.deepEqual(Object.keys(inserted.cells).sort(), ["A2", "A6"]);
  assert.deepEqual(inserted.merges, ["A6:C6"]);
  const deleted = shiftRows(cells, ["A5:C5"], 5, -1);
  assert.deepEqual(Object.keys(deleted.cells), ["A2"]);
  assert.deepEqual(deleted.merges, []);
  assert.deepEqual(shiftColumns({ B1: cell({ value: 2 }) }, ["B2:C2"], 0, 1).merges, ["C2:D2"]);
});

test("typed entries, formulas (lower case, $ references, IF comparisons) and AutoSum", () => {
  assert.deepEqual(parseEntry("=SUM(I3:I4)"), { value: null, formula: "=SUM(I3:I4)" });
  assert.deepEqual(parseEntry("1,500"), { value: 1500, formula: null });
  assert.deepEqual(parseEntry("12%"), { value: 0.12, formula: null });
  const plain = { I3: { value: 5000, formula: null }, I4: { value: 1000, formula: null } };
  assert.equal(evaluateFormula("=sum(i3:i4)", plain), 6000);
  assert.equal(evaluateFormula("=$I$3+$I$4", plain), 6000);
  assert.equal(evaluateFormula("=IF(I3>I4,\"High\",\"Low\")", plain), "High");
  const sheet = { I3: cell({ value: 5000 }), I4: cell({ value: 1000 }), I5: cell({ formula: "=I3+I4" }) };
  assert.equal(recomputeFormulas(sheet).I5.value, 6000, "a formula cell saves its value, which the marking checks");
  assert.equal(autoSumRange({ I3: cell({ value: 5000 }), I4: cell({ value: 1000 }) }, 5, 8), "I3:I4");
});

test("borders per side, number formats and the used part of the sheet", () => {
  const boxed = applyBorder({}, parseRange("A1:B2"), "outside");
  assert.equal(boxed.A1.border, "tl");
  assert.equal(boxed.B2.border, "rb");
  assert.deepEqual(borderCss("T"), { borderTop: "2px solid #000" });
  assert.equal(formatCellValue(1500, "Currency"), "₹1,500.00");
  assert.equal(formatCellValue(0.125, "Percentage"), "12.50%");
  assert.deepEqual(usedExtent({}, ["A27:L31"], { ...DEFAULT_SHEET_SETTINGS }, 26, 12), { rows: 31, cols: 12 });
});

test("saved sheets: version 3 (merges, page settings, font size, Middle Align) validates, version 2 reads as version 3", async () => {
  const model = JSON.parse(await read("tests/fixtures/excel-test1-model.json"));
  assert.equal(validateExcelOperations(model), model, "every operation the workspace records is recognised (formula:SUM used to be refused)");
  assert.throws(() => validateExcelDocument({ ...model, sheet: { ...model.sheet, orientation: "sideways" } }), /orientation/);
  assert.throws(() => validateExcelDocument({ ...model, merges: ["A1"] }), /merged/);
  const v3 = toExcelDocumentV3({ schemaVersion: "2", rows: 2, cols: 2, cells: {}, operations: [], savedAt: new Date().toISOString() });
  assert.equal(v3.schemaVersion, "3");
  assert.deepEqual(v3.merges, []);
  assert.equal(v3.sheet.gridlines, true);
});

test("the workspace has Excel 2013's commands the papers ask about, and saves them", async () => {
  const editor = await read("app/typing/excel-efficiency/[language]/[testId]/workspace/rich-sheet-editor.tsx");
  for (const label of ["Merge &amp; Center", "Merge Across", "Merge Cells", "Unmerge Cells", "Middle Align", "Format Painter", "Wrap Text", "Font Size", "Set Print Area", "Clear Print Area", "Landscape", "Portrait", "Header &amp; Footer", "Page Number", "Gridlines: View", "Headings: View", "Formula Bar", "Name Box", "AutoSum", "Insert Sheet Rows", "Delete Sheet Columns", "Clear Formats"]) assert.ok(editor.includes(label), label);
  assert.match(editor, /\["C00000", "Dark Red"\], \["FF0000", "Red"\]/, "Excel's standard colours, Red included");
  assert.match(editor, /return \{ schemaVersion: "3", rows: extent\.rows, cols: extent\.cols, cells: kept, merges: m, sheet: s,/);
  assert.match(editor, /onChange=\{\(event\) => \{ const text = event\.target\.value; event\.target\.value = ""; if \(text && !submitted && !editing\) beginEdit\(text\); \}\}/, "typed text from an input method or phone starts editing too");
  assert.match(editor, /onPaste=\{\(event\) => \{ event\.preventDefault\(\); if \(!submitted\) pasteText\(event\.clipboardData\.getData\("text\/plain"\)\); \}\}/);
  assert.match(editor, /Math\.min\(MAX_ROWS, Math\.max\(50, extent\.rows \+ 25, focus\.row \+ 10\)\)/, "rows beyond the starting sheet (Q1, Q2 use rows 27-31) can be reached");
});

test("the .xlsx reader brings in merged cells, font size, colour, underline and alignment", async () => {
  const source = await read("lib/excel-sheet.ts");
  assert.match(source, /sheetXml\?\.worksheet\?\.mergeCells\?\.mergeCell/);
  assert.match(source, /\.\.\.\(font\?\.size && font\.size !== 11 \? \{ fontSize: font\.size \} : \{\}\)/);
  assert.match(source, /vertical === "center" \? "middle"/);
  const sql = await read("supabase/migrations/202610251700_excel_efficiency_sheet_v3_and_rule_marking.sql");
  assert.match(sql, /if unmarked = 0 and auto then/, "results are published straight after submitting when every question has rules");
});
