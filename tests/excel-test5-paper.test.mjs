import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recomputeFormulas } from "../lib/excel-sheet-model.ts";
import { parseWorkingSheetXlsx } from "../lib/excel-sheet.ts";

// English EXCEL EFFICIENCY TEST 5 (scripts/build-excel-test5.mjs, migration 202611081500): a salary sheet of 200
// employees -- $ references, VLOOKUP + IFERROR, RANK, PROPER/TRIM, UPPER/LEFT/RIGHT/&, YEAR, SUMIF/SUMIFS,
// LARGE/SMALL, INDEX/MATCH, COUNTBLANK, Accounting, Freeze Top Row, Top 10. The live database gave the model answer
// 25/25 and the untouched sheet 0 (dry run, 8 Nov 2026); this repeats the rules with a JavaScript copy of
// excel_efficiency_criterion_matches (including the new caseSensitive value check).
const read = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const [model, matter, rules] = await Promise.all([read("excel-test5-model.json"), read("excel-test5-initial.json"), read("excel-test5-rules.json")]);
const start = { schemaVersion: "3", rows: matter.rows, cols: matter.cols, cells: matter.cells, merges: [], sheet: {}, operations: [], savedAt: "1970-01-01T00:00:00.000Z" };

const same = (actual, allowed, caseSensitive = false) => [allowed].flat().some((v) => typeof v === "number" ? typeof actual === "number" && Math.abs(v - actual) < 0.001
  : typeof v === "string" ? typeof actual === "string" && (caseSensitive ? v === actual : v.toUpperCase() === actual.toUpperCase()) : v === (actual ?? null));
const contains = (big, small) => Object.entries(small).every(([k, v]) => big?.[k] === v);
const cellsOf = (range) => { const [a, b = a] = range.split(":"); const out = []; for (let r = +a.slice(1); r <= +b.slice(1); r++) for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) out.push(String.fromCharCode(c) + r); return out; };
function matches(doc, c) {
  if (c.rule === "anyOf") return c.criteria.some((x) => matches(doc, x));
  if (c.rule === "value") { const cell = doc.cells[c.cell] ?? {}; return same(cell.value, c.equals, c.caseSensitive); }
  if (c.rule === "cells") return cellsOf(c.range).every((ref) => Object.entries(c.props).every(([k, v]) => same(doc.cells[ref]?.[k] ?? null, v)));
  if (c.rule === "sheet") {
    const actual = doc.sheet?.[c.path];
    if ("equals" in c) return same(actual, c.equals);
    if (c.includes) return Array.isArray(actual) && actual.some((item) => contains(item, c.includes));
  }
  throw new Error(`criterion ${c.rule} not copied here`);
}
const marks = (doc) => rules.map((q) => (q.criteria.every((c) => matches(doc, c)) ? q.marks : 0));
const total = (list) => list.reduce((a, b) => a + b, 0);
const solved = (change) => { const doc = structuredClone(model); change(doc.cells, doc); doc.cells = recomputeFormulas(doc.cells); return marks(doc); };

test("15 questions, 25 marks: the model answer gets every mark, the untouched sheet none", () => {
  assert.equal(rules.length, 15);
  assert.equal(total(rules.map((q) => q.marks)), 25);
  assert.deepEqual(marks(model), rules.map((q) => q.marks));
  assert.equal(total(marks(start)), 0);
});

test("the sheet: 200 employees with untidy names, dates, some missing mobile numbers, Peons and Drivers outside the allowance table", () => {
  assert.equal(matter.rows, 201);
  assert.equal(matter.cells.B2.value, "  rAMESH  kumar SHARMA ");
  assert.equal(matter.cells.E2.numberFormat, "ShortDate");
  assert.equal(matter.cells.T2.value, 0.55);
  const posts = Array.from({ length: 200 }, (_, i) => matter.cells[`D${i + 2}`].value);
  assert.ok(posts.filter((p) => p === "Peon" || p === "Driver").length >= 20);
  assert.ok(Array.from({ length: 200 }, (_, i) => matter.cells[`G${i + 2}`]).filter((c) => !c).length >= 5);
});

test("the mistakes the paper teaches about lose the marks; other correct ways keep them", () => {
  // no $ on T2: J3 onwards multiply by an empty cell
  assert.equal(solved((cells) => { for (let r = 2; r <= 201; r++) cells[`J${r}`].formula = `=ROUND(F${r}*T${r},0)`; })[2], 0);
  // VLOOKUP without IFERROR: #N/A for Peon/Driver
  assert.equal(solved((cells) => { for (let r = 2; r <= 201; r++) cells[`K${r}`].formula = `=VLOOKUP(D${r},$S$6:$T$10,2,FALSE)`; })[3], 0);
  // RANK with a relative list
  assert.equal(solved((cells) => { for (let r = 2; r <= 201; r++) cells[`M${r}`].formula = `=RANK(L${r},L${r}:L201)`; })[5], 0);
  // TRIM only (capital letters wrong) and PROPER only (extra spaces left)
  assert.equal(solved((cells) => { for (let r = 2; r <= 201; r++) cells[`H${r}`].formula = `=TRIM(B${r})`; })[0], 0);
  assert.equal(solved((cells) => { for (let r = 2; r <= 201; r++) cells[`H${r}`].formula = `=PROPER(B${r})`; })[0], 0);
  // the code without UPPER
  assert.equal(solved((cells) => { for (let r = 2; r <= 201; r++) cells[`N${r}`].formula = `=LEFT(C${r},3)&"-"&RIGHT(A${r},3)`; })[6], 0);
  // correct alternatives
  const ways = solved((cells) => { for (let r = 2; r <= 201; r++) { cells[`H${r}`].formula = `=TRIM(PROPER(B${r}))`; cells[`L${r}`].formula = `=SUM(F${r},J${r},K${r})`; cells[`N${r}`].formula = `=CONCATENATE(UPPER(LEFT(C${r},3)),"-",RIGHT(A${r},3))`; } cells.Q6.formula = "=INDEX(B2:B201,MATCH(MAX(L2:L201),L2:L201,0))"; });
  assert.equal(total(ways), 25);
});

test("Accounting with ₹ or Currency with ₹ and 2 decimals; Top 10 with the green style only", () => {
  const doc = structuredClone(model);
  for (let r = 2; r <= 201; r++) Object.assign(doc.cells[`L${r}`], { numberFormat: "Currency", currency: null, decimals: 2 });
  assert.equal(marks(doc)[12], 1);
  for (let r = 2; r <= 201; r++) doc.cells[`L${r}`].currency = "$";
  assert.equal(marks(doc)[12], 0);
  doc.sheet.conditionalFormats = [{ range: "L2:L201", type: "top", value: 10, style: "lightRedDarkRed" }];
  assert.equal(marks(doc)[14], 0);
});

test("the practice .xlsx opens with the same cells as the test sheet", async () => {
  const bytes = new Uint8Array(await readFile(new URL("../docs/excel-practice/EXCEL-TEST-5-practice-200-employees.xlsx", import.meta.url)));
  const sheet = parseWorkingSheetXlsx(bytes, "English");
  assert.deepEqual(Object.keys(matter.cells).filter((ref) => sheet.cells[ref]?.value !== matter.cells[ref].value), []);
  // (the admin .xlsx importer reads built-in date formats as Number; real Excel shows the dates)
});

test("Flash Fill, typing or Paste Values give the same marks as formulas: the answer is checked, not the method", () => {
  // Q1 (PROPER + TRIM) and Q7 (the Emp Code) are the questions Flash Fill suits: plain text, no formula in the cell
  const flash = solved((cells) => { for (let r = 2; r <= 201; r++) for (const c of ["H", "N"]) cells[`${c}${r}`].formula = null; });
  assert.equal(flash[0], 2);
  assert.equal(flash[6], 2);
  // every formula in the sheet replaced by its value
  assert.equal(total(solved((cells) => { for (const cell of Object.values(cells)) cell.formula = null; })), 25);
  // a Flash Fill that guessed one name wrong still loses the question
  assert.equal(solved((cells) => { for (let r = 2; r <= 201; r++) cells[`H${r}`].formula = null; cells.H7.value = "wrong"; })[0], 0);
});
