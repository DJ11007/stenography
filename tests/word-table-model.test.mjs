import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { applyBorders, autoFit, cycleTextDirection, deleteColumn, deleteRow, evaluateFormula, insertColumn, insertRow, mergeCells, paragraphsToTable, readTableAttrs, renderTableAttrs, setCellMargins, setColumnWidth, setRowHeight, setShading, setStyleOption, setTableAlign, setTableStyle, sortTable, splitCell, splitTable, tableGrid, tableToParagraphs } from "../lib/word-table-model.ts";
import { validCellFormats } from "../lib/word-table-format.ts";

function table(rows) {
  const window = new Window(), document = window.document;
  document.body.innerHTML = `<div id="editor"><table data-block-type="table"><tbody>${rows.map(row => `<tr>${row.map(text => `<td>${text}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  return { document, table: document.querySelector("table") };
}
const texts = (t) => readTableAttrs(t).rows;
const cell = (t, r, c) => tableGrid(t).at[r][c].cell;

test("merge cells keeps a full grid: covered positions are saved as merged, text joins in the top-left cell", () => {
  const { table: t } = table([["A", "B", "C"], ["D", "E", "F"]]);
  assert.equal(mergeCells(t, [cell(t, 0, 0), cell(t, 0, 1), cell(t, 1, 0), cell(t, 1, 1)]), null);
  const attrs = readTableAttrs(t);
  assert.deepEqual(attrs.rows, [["A B D E", "", "C"], ["", "", "F"]]);
  assert.equal(attrs.cellFormats[0][0].rowspan, 2);
  assert.equal(attrs.cellFormats[0][0].colspan, 2);
  assert.deepEqual([attrs.cellFormats[0][1], attrs.cellFormats[1][0], attrs.cellFormats[1][1]].map(f => f.merged), [true, true, true]);
  assert.ok(validCellFormats(attrs.cellFormats, attrs.rows));
  assert.equal(mergeCells(t, [cell(t, 0, 2)]), "Select two or more cells to merge.");
});

test("a merge that is not a rectangle is refused", () => {
  const { table: t } = table([["A", "B"], ["C", "D"]]);
  mergeCells(t, [cell(t, 0, 0), cell(t, 1, 0)]);
  assert.equal(mergeCells(t, [cell(t, 0, 0), cell(t, 0, 1)]), "The selected cells must form a rectangle.");
});

test("split cells divides a cell into columns and rows, widening the grid around it", () => {
  const { table: t } = table([["A", "B"], ["C", "D"]]);
  assert.equal(splitCell(t, cell(t, 0, 0), 2, 1), null);
  let grid = tableGrid(t);
  assert.equal(grid.cols, 3);
  assert.equal(cell(t, 1, 0).colSpan, 2, "the cell below stretches across the new column");
  assert.deepEqual(texts(t), [["A", "", "B"], ["C", "", "D"]]);
  assert.equal(splitCell(t, cell(t, 1, 2), 1, 2), null);
  grid = tableGrid(t);
  assert.equal(grid.rows, 3);
  // Splitting a merged cell back gives the original cells.
  const { table: m } = table([["A", "B"], ["C", "D"]]);
  mergeCells(m, [cell(m, 0, 0), cell(m, 0, 1)]);
  splitCell(m, cell(m, 0, 0), 2, 1);
  assert.equal(tableGrid(m).cols, 2);
  assert.deepEqual(readTableAttrs(m).cellFormats[0].map(f => f.merged ?? false), [false, false]);
});

test("insert and delete rows and columns keep merged cells intact", () => {
  const { table: t } = table([["A", "B", "C"], ["D", "E", "F"], ["G", "H", "I"]]);
  mergeCells(t, [cell(t, 0, 1), cell(t, 1, 1)]);
  insertRow(t, 0, "below");
  assert.equal(cell(t, 0, 1).rowSpan, 3, "a row inserted inside a vertical merge extends it");
  assert.equal(tableGrid(t).rows, 4);
  deleteRow(t, 0);
  assert.equal(tableGrid(t).rows, 3);
  assert.equal(tableGrid(t).at[0][1].cell.rowSpan, 2, "deleting the merge's top row moves the cell down");
  insertColumn(t, 0, "right");
  assert.equal(tableGrid(t).cols, 4);
  deleteColumn(t, 1);
  assert.equal(tableGrid(t).cols, 3);
  assert.ok(validCellFormats(readTableAttrs(t).cellFormats, readTableAttrs(t).rows));
});

test("split table moves the rows from the cursor down into a second table", () => {
  const { document, table: t } = table([["A"], ["B"], ["C"]]);
  const second = splitTable(t, 1);
  assert.deepEqual(texts(t), [["A"]]);
  assert.deepEqual(texts(second), [["B"], ["C"]]);
  assert.equal(document.querySelectorAll("table").length, 2);
});

test("table settings and cell formatting are saved as separate fields and come back after reload", () => {
  const { document, table: t } = table([["Name", "Amount"], ["Ravi", "1200"], ["Neha", "2100"]]);
  setTableStyle(t, "grid-4-accent-1");
  setStyleOption(t, "firstColumn", false);
  setStyleOption(t, "totalRow", true);
  setTableAlign(t, "center");
  setCellMargins(t, { top: 0.1, bottom: 0.1, left: 0.3, right: 0.3 });
  setRowHeight(t, [0], 1);
  setColumnWidth(t, [1], 3.5);
  t.dataset.repeatHeader = "true";
  setShading(cell(t, 0, 0), "FFFF00");
  applyBorders(t, [cell(t, 1, 0), cell(t, 1, 1), cell(t, 2, 0), cell(t, 2, 1)], "outside", { style: "double", width: 1.5, color: "FF0000" });
  cycleTextDirection(cell(t, 0, 1));
  const attrs = readTableAttrs(t);
  assert.equal(attrs.tableStyle, "grid-4-accent-1");
  assert.deepEqual([attrs.headerRow, attrs.firstColumn, attrs.totalRow, attrs.bandedRows], [true, false, true, true]);
  assert.equal(attrs.tableAlign, "center");
  assert.deepEqual([attrs.cellMarginTop, attrs.cellMarginLeft], [0.1, 0.3]);
  assert.deepEqual(attrs.rowHeights, [1, null, null]);
  assert.deepEqual(attrs.colWidths, [null, 3.5]);
  assert.equal(attrs.repeatHeader, true);
  assert.equal(attrs.cellFormats[0][0].shading, "FFFF00");
  assert.equal(attrs.cellFormats[0][1].textDirection, "down");
  assert.equal(attrs.cellFormats[1][0].borderTop, "double 1.5 FF0000");
  assert.equal(attrs.cellFormats[1][0].borderLeft, "double 1.5 FF0000");
  assert.equal(attrs.cellFormats[1][0].borderRight, undefined, "outside borders leave the inside line alone");
  assert.ok(validCellFormats(attrs.cellFormats, attrs.rows));
  // Round trip.
  const copy = document.createElement("table");
  document.querySelector("#editor").append(copy);
  renderTableAttrs(copy, attrs);
  assert.deepEqual(readTableAttrs(copy), attrs);
});

test("merged cells survive a save and reload", () => {
  const { document, table: t } = table([["A", "B"], ["C", "D"]]);
  mergeCells(t, [cell(t, 0, 0), cell(t, 1, 0)]);
  const attrs = readTableAttrs(t);
  const copy = document.createElement("table");
  document.querySelector("#editor").append(copy);
  renderTableAttrs(copy, attrs);
  assert.equal(copy.rows[0].cells[0].rowSpan, 2);
  assert.deepEqual(readTableAttrs(copy).rows, attrs.rows);
});

test("sort, formula, convert to text and convert text to table", () => {
  const { table: t } = table([["Name", "Amount"], ["Ravi", "1200"], ["Neha", "2100"], ["Ajay", "1800"]]);
  assert.equal(sortTable(t, 1, "descending", "number", true), null);
  assert.deepEqual(texts(t).map(row => row[0]), ["Name", "Neha", "Ajay", "Ravi"]);
  sortTable(t, 0, "ascending", "text", true);
  assert.deepEqual(texts(t).map(row => row[0]), ["Name", "Ajay", "Neha", "Ravi"]);
  insertRow(t, 3, "below");
  assert.deepEqual(evaluateFormula(t, cell(t, 4, 1), "=SUM(ABOVE)"), { value: 5100 });
  assert.deepEqual(evaluateFormula(t, cell(t, 4, 1), "=average(above)"), { value: 1700 });
  assert.ok("error" in evaluateFormula(t, cell(t, 4, 1), "=SQRT(ABOVE)"));
  const paragraphs = tableToParagraphs(t, "\t");
  assert.equal(paragraphs[1].textContent, "Ajay\t1800");
  const back = paragraphsToTable(paragraphs, "\t", null);
  assert.deepEqual(texts(back)[1], ["Ajay", "1800"]);
});

test("AutoFit window / contents / fixed set the saved layout", () => {
  const { table: t } = table([["A", "B"]]);
  autoFit(t, "window");
  assert.equal(readTableAttrs(t).tableLayout, "window");
  autoFit(t, "fixed");
  assert.equal(readTableAttrs(t).tableLayout, "fixed");
  assert.equal(readTableAttrs(t).colWidths.length, 2);
  autoFit(t, "auto");
  assert.equal(readTableAttrs(t).colWidths, undefined);
});
