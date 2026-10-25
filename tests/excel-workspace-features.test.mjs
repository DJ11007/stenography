import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evaluateFormula, FUNCTION_LIBRARY } from "../lib/excel-formula.ts";
import { validateExcelDocument, validateExcelOperations } from "../lib/excel-document.ts";
import { conditionalMatches, currentRegion, formatCellValue, EMPTY_CELL } from "../lib/excel-sheet-model.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const c = (value, formula = null) => ({ value, formula });
const cells = { A1: c("Name"), B1: c("Marks"), A2: c("Ram"), B2: c(80), A3: c("Shyam"), B3: c(45), A4: c("Mohan"), B4: c(92), C2: c(null, "=B2*2"), D1: c("rajasthan high court") };

// The Function Library of the FORMULAS tab: what the papers ask (SUM/AVERAGE/IF ... VLOOKUP, COUNTIF, text, dates).
test("formulas give what Excel gives, errors included", () => {
  const cases = [
    ["=SUM(B2:B4)", 217], ["=AVERAGE(B2:B4)", 217 / 3], ["=MAX(B2:B4)", 92], ["=COUNT(A1:B4)", 3], ["=COUNTA(A1:A4)", 4], ["=COUNTIF(B2:B4,\">50\")", 2], ["=SUMIF(B2:B4,\">50\")", 172],
    ["=IF(B2>=50,\"Pass\",\"Fail\")", "Pass"], ["=IF(B3>=50,\"Pass\",\"Fail\")", "Fail"], ["=AND(B2>50,B4>50)", "TRUE"], ["=OR(B3>50,B2<10)", "FALSE"], ["=NOT(B3>50)", "TRUE"],
    ["=VLOOKUP(\"Shyam\",A2:B4,2,FALSE)", 45], ["=VLOOKUP(\"X\",A2:B4,2,FALSE)", "#N/A"], ["=IFERROR(VLOOKUP(\"X\",A2:B4,2,FALSE),\"Not found\")", "Not found"], ["=IF(IFERROR(1/0,0)=0,\"ok\",\"no\")", "ok"],
    ["=UPPER(A2)", "RAM"], ["=PROPER(D1)", "Rajasthan High Court"], ["=LEN(A3)", 5], ["=A2&\" \"&A3", "Ram Shyam"], ["=CONCATENATE(A2,\"-\",B2)", "Ram-80"], ["=LEFT(A3,2)", "Sh"],
    ["=ROUND(10/3,2)", 3.33], ["=B2/0", "#DIV/0!"], ["=NOSUCH(1)", "#NAME?"], ["=RANK(B2,B2:B4)", 2], ["=2^3", 8], ["=50%*B2", 40], ["=C2+1", 161], ["=sum(b2:b4)", 217], ["=$B$2+$B$3", 125],
    ["=MEDIAN(B2:B4)", 80], ["=LARGE(B2:B4,1)", 92], ["=INDEX(A2:B4,3,1)", "Mohan"], ["=MATCH(\"Mohan\",A2:A4,0)", 3], ["=YEAR(DATE(2026,10,25))", 2026], ["=IF(B2>50,B2*10%,0)", 8],
  ];
  for (const [formula, want] of cases) {
    const got = evaluateFormula(formula, cells);
    if (typeof want === "number") assert.ok(Math.abs(got - want) < 1e-9, `${formula} gave ${got}`); else assert.equal(got, want, formula);
  }
  for (const category of ["Financial", "Logical", "Text", "Date & Time", "Lookup & Reference", "Math & Trig", "Statistical"]) assert.ok(FUNCTION_LIBRARY.some((fn) => fn.category === category), category);
});

test("a saved sheet may hold the new settings (database migration 202610252200 checks the same)", () => {
  const base = { schemaVersion: "3", rows: 41, cols: 12, merges: [], savedAt: "2026-10-25T10:00:00Z", operations: ["filter", "sort", "removeDuplicates", "conditionalFormat", "chart", "comment", "freezePanes", "formula:COUNTIF", "renameSheet", "protectSheet", "columnWidth", "replace", "printTitles", "hideRows"],
    cells: { A36: { ...EMPTY_CELL, value: "Mohan", comment: "Topper" }, B41: { ...EMPTY_CELL, value: 2, formula: "=COUNTIF(B36:B39,\">50\")" }, C1: { ...EMPTY_CELL, value: 46320, numberFormat: "ShortDate" } } };
  const sheet = { gridlines: true, headings: true, formulaBar: true, printGridlines: false, printHeadings: false, printArea: null, orientation: "portrait", paperSize: "Letter", margins: "Normal", header: {}, footer: {}, zoom: 100,
    name: "Marks", freeze: "A2", filter: "A35:C40", filterHidden: { C: ["Ajmer"] }, protected: false, printTitleRows: "$1:$1", conditionalFormats: [{ range: "B36:B39", type: "greaterThan", value: 50, style: "lightRedDarkRed" }],
    charts: [{ id: "chart1", type: "column", range: "A35:B39", title: "Marks", anchor: "D35" }], hiddenRows: [3], hiddenCols: [2], colWidths: { C: 20 }, rowHeights: { "1": 30 } };
  assert.ok(validateExcelOperations({ ...base, sheet }));
  assert.throws(() => validateExcelDocument({ ...base, sheet: { ...sheet, name: "Bad/Name" } }), /sheet name/);
  assert.throws(() => validateExcelDocument({ ...base, sheet: { ...sheet, charts: [{ id: "x", type: "donut", range: "A1:B2", title: "", anchor: "A1" }] } }), /chart/);
  assert.throws(() => validateExcelDocument({ ...base, sheet: { ...sheet, conditionalFormats: [{ range: "B1", type: "greaterThan", style: "purple" }] } }), /conditional/);
});

test("current region, conditional rules and the new number formats", () => {
  const sheetCells = { A35: { ...EMPTY_CELL, value: "Name" }, B35: { ...EMPTY_CELL, value: "Marks" }, A36: { ...EMPTY_CELL, value: "Ram" }, B36: { ...EMPTY_CELL, value: 80 }, A37: { ...EMPTY_CELL, value: "Sita" }, B37: { ...EMPTY_CELL, value: 45 } };
  assert.deepEqual(currentRegion(sheetCells, 36, 1), { r1: 35, c1: 0, r2: 37, c2: 1 });
  assert.equal(conditionalMatches({ range: "B36:B37", type: "greaterThan", value: 50, style: "redText" }, 80, () => []), true);
  assert.equal(conditionalMatches({ range: "B36:B37", type: "between", value: 40, value2: 50, style: "redText" }, 45, () => []), true);
  assert.equal(conditionalMatches({ range: "A1:A3", type: "duplicate", style: "redText" }, "Ram", () => ["Ram", "ram", "Sita"]), true);
  assert.equal(formatCellValue(46320, "ShortDate"), "25-10-2026");
  assert.equal(formatCellValue(1500, "Accounting"), "₹ 1,500.00");
  assert.equal(formatCellValue(12, "Text"), "12");
});

test("the workspace has the Excel 2013 commands the papers use, no longer greyed out", async () => {
  const editor = await read("app/typing/excel-efficiency/[language]/[testId]/workspace/rich-sheet-editor.tsx");
  for (const label of ["Conditional Formatting", "Format as Table", "Row Height...", "Column Width...", "Hide Rows", "Unhide Columns", "Rename Sheet", "Custom Sort...", "Replace...", "Insert Column Chart", "Insert Pie or Doughnut Chart", "Print Titles", "Insert Function", "More Functions", "Show Formulas", "Remove Duplicates", "New Comment", "Protect Sheet", "Freeze Top Row", "Freeze First Column", "Zoom to Selection"]) assert.ok(editor.includes(label), label);
  assert.doesNotMatch(editor, /<Big label="Insert Function"[^>]*disabled title=\{off\}/);
  assert.doesNotMatch(editor, /<Big label="Freeze Panes"[^>]*disabled/);
  assert.match(editor, /if \(sheet\.protected && op !== "unprotectSheet"\) \{ setNotice\(PROTECTED_MESSAGE\); return; \}/, "a protected sheet refuses changes");
  const dialogs = await read("app/typing/excel-efficiency/[language]/[testId]/workspace/excel-dialogs.tsx");
  for (const name of ["InsertFunctionDialog", "SortDialog", "ConditionalDialog", "FindReplaceDialog", "PageSetupDialog", "SymbolDialog", "ZoomDialog", "FilterMenu"]) assert.match(dialogs, new RegExp(`export function ${name}`));
});
