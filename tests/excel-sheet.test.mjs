import test from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { parseWorkingSheetXlsx, validateWorkingSheetFile } from "../lib/excel-sheet.ts";

function buildXlsx({ sheetXml, sharedStrings = "<sst/>", styles = "<styleSheet/>", extra = {} }) {
  return zipSync({
    "[Content_Types].xml": strToU8("<Types/>"),
    "xl/workbook.xml": strToU8('<workbook><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    "xl/worksheets/sheet1.xml": strToU8(sheetXml),
    "xl/sharedStrings.xml": strToU8(sharedStrings),
    "xl/styles.xml": strToU8(styles),
    ...extra,
  });
}

test("parses cell values, a shared string, and a formula with its style-resolved bold and fill color", () => {
  const sheetXml = `<worksheet><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>10</v></c></row>
    <row r="2"><c r="B2"><v>20</v></c></row>
    <row r="3"><c r="B3"><v>30</v></c></row>
    <row r="4"><c r="B4" s="1"><f>SUM(B1:B3)</f><v>60</v></c></row>
  </sheetData></worksheet>`;
  const sharedStrings = "<sst><si><t>Item</t></si></sst>";
  const styles = `<styleSheet>
    <fonts><font><sz val="11"/></font><font><b/><sz val="11"/></font></fonts>
    <fills><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/></patternFill></fill></fills>
    <cellXfs><xf fontId="0" fillId="0"/><xf fontId="1" fillId="1"/></cellXfs>
  </styleSheet>`;
  const bytes = buildXlsx({ sheetXml, sharedStrings, styles });
  const snapshot = parseWorkingSheetXlsx(bytes, "English");
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.cells.A1.value, "Item");
  assert.equal(snapshot.cells.B1.value, 10);
  assert.equal(snapshot.cells.B4.formula, "=SUM(B1:B3)");
  assert.equal(snapshot.cells.B4.value, 60);
  assert.equal(snapshot.cells.B4.bold, true);
  assert.equal(snapshot.cells.B4.fillColor, "FFFF00");
  assert.equal(snapshot.cells.B1.bold, false);
  assert.ok(snapshot.rows >= 4);
});

test("rejects files with an unsafe external relationship or embedded macro content", () => {
  const sheetXml = '<worksheet><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData></worksheet>';
  const withExternalRel = buildXlsx({ sheetXml, extra: { "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship TargetMode="External" Target="https://evil.example"/></Relationships>') } });
  assert.throws(() => parseWorkingSheetXlsx(withExternalRel, "English"), /external relationships/);
  const withMacro = buildXlsx({ sheetXml, extra: { "xl/vbaProject.bin": new Uint8Array([1, 2, 3]) } });
  assert.throws(() => parseWorkingSheetXlsx(withMacro, "English"), /executable/);
});

test("rejects a non-zip blob and a workbook with no worksheets", () => {
  assert.throws(() => parseWorkingSheetXlsx(strToU8("not a zip"), "English"));
  const missingWorksheet = zipSync({ "[Content_Types].xml": strToU8("<Types/>"), "xl/workbook.xml": strToU8("<workbook/>") });
  assert.throws(() => parseWorkingSheetXlsx(missingWorksheet, "English"), /no worksheets/);
});

test("validateWorkingSheetFile enforces extension, MIME type, and size bounds", () => {
  assert.ok(validateWorkingSheetFile({ name: "matter.xlsm", type: "application/vnd.ms-excel.sheet.macroEnabled.12", size: 100 }).length);
  assert.ok(validateWorkingSheetFile({ name: "matter.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 0 }).length);
  assert.deepEqual(validateWorkingSheetFile({ name: "matter.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 100 }), []);
});
