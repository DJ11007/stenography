import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { diffWordDocuments } from "../lib/word-document-diff.ts";
import { validateWordEditorDocument } from "../lib/word-editor-document.ts";

// Word 2013 Table Tools: table settings and the new cell fields must be accepted
// by the server's document check (and malformed ones refused), and every one of
// them must become its own gradable change.

const cellMigration = new URL("../supabase/migrations/202610151000_word_efficiency_table_cell_formats.sql", import.meta.url);
const toolsMigration = new URL("../supabase/migrations/202610152100_word_efficiency_table_tools.sql", import.meta.url);

async function database() {
  const db = new PGlite();
  await db.exec(`
-- The oldest check, as the real one: a table may only carry rows and tableLayout.
create function public.assert_word_efficiency_document_schema(d jsonb, caps jsonb) returns void language plpgsql immutable as $$
begin if exists(select 1 from jsonb_array_elements(d->'blocks') b, jsonb_object_keys(b.value->'attrs') k where b.value->>'type'='table' and k not in('rows','tableLayout')) then raise exception 'Invalid table attributes'; end if; end $$;
create role anon; create role authenticated;`);
  await db.exec(await readFile(cellMigration, "utf8"));
  await db.exec(await readFile(toolsMigration, "utf8"));
  return db;
}

const rows = [["Name", "Amount"], ["Ravi", "1200"]];
const table = (attrs) => ({ id: "t", type: "table", alignment: "left", runs: [{ text: "Name", bold: false, italic: false, underline: false, underlineStyle: null, underlineColor: null, underlineThickness: null, underlineWordsOnly: false, strike: false, doubleStrike: false, superscript: false, subscript: false, smallCaps: false, allCaps: false, hidden: false, outline: false, emboss: false, fontFamily: null, fontSize: 12, color: null, highlight: null, charScale: null, charSpacing: null, charPosition: null, kerningEnabled: false, kerningMin: null, href: null, bookmark: null, field: null }], attrs: { rows, ...attrs } });
const doc = (blocks) => ({ schemaVersion: "2", blocks, pageLayout: { padding: null, maxWidth: null, aspectRatio: null, columnCount: null, backgroundColor: null, border: null, watermark: null }, operations: [], savedAt: "2026-10-15T00:00:00.000Z" });
const full = {
  tableLayout: "fixed", tableStyle: "grid-4-accent-1", headerRow: true, totalRow: false, bandedRows: true, firstColumn: false, lastColumn: false, bandedColumns: false,
  repeatHeader: true, tableAlign: "center", cellMarginTop: 0.1, cellMarginBottom: 0.1, cellMarginLeft: 0.3, cellMarginRight: 0.3, rowHeights: [1, null], colWidths: [null, 3.5],
  cellFormats: [[{ rowspan: 1, colspan: 2, shading: "FFFF00", borderTop: "double 1.5 FF0000", borderDiagonal: "down solid 0.5 000000" }, { merged: true }], [{ textDirection: "up", borderLeft: "none" }, {}]],
};

test("the server accepts every Table Tools field and refuses malformed ones", async () => {
  const db = await database();
  const check = (attrs) => db.query("select public.assert_word_efficiency_document_schema($1::jsonb,'{}'::jsonb)", [JSON.stringify(doc([table(attrs)]))]);
  await check(full);
  validateWordEditorDocument(doc([table(full)]));
  for (const [bad, error] of [
    [{ tableStyle: "rainbow" }, /Invalid table style/],
    [{ headerRow: "yes" }, /Invalid table setting/],
    [{ tableAlign: "middle" }, /Invalid table alignment/],
    [{ cellMarginTop: 99 }, /Invalid table cell margin/],
    [{ rowHeights: [1, 2, 3] }, /Invalid table row heights/],
    [{ colWidths: [0] }, /Invalid table column widths/],
    [{ cellFormats: [[{ borderTop: "solid 7 000000" }, {}], [{}, {}]] }, /Invalid table cell formatting/],
    [{ cellFormats: [[{ colspan: 1.5 }, {}], [{}, {}]] }, /Invalid table cell formatting/],
    [{ cellFormats: [[{ textDirection: "sideways" }, {}], [{}, {}]] }, /Invalid table cell formatting/],
  ]) {
    await assert.rejects(check(bad), error, JSON.stringify(bad));
    assert.throws(() => validateWordEditorDocument(doc([table(bad)])), JSON.stringify(bad));
  }
  // Running the migration a second time changes nothing.
  await db.exec(await readFile(toolsMigration, "utf8"));
  await check(full);
});

test("each Table Tools change is its own gradable criterion", () => {
  const before = doc([table({ cellFormats: [[{}, {}], [{}, {}]] })]);
  const after = doc([table(full)]);
  const targets = diffWordDocuments(before, after).map(change => change.target);
  for (const target of ["blocks.0.attrs.tableStyle", "blocks.0.attrs.firstColumn", "blocks.0.attrs.repeatHeader", "blocks.0.attrs.tableAlign", "blocks.0.attrs.cellMarginLeft", "blocks.0.attrs.rowHeights", "blocks.0.attrs.colWidths",
    "blocks.0.attrs.cellFormats.0.0.colspan", "blocks.0.attrs.cellFormats.0.1.merged", "blocks.0.attrs.cellFormats.0.0.shading", "blocks.0.attrs.cellFormats.0.0.borderTop", "blocks.0.attrs.cellFormats.0.0.borderDiagonal", "blocks.0.attrs.cellFormats.1.0.textDirection"]) {
    assert.ok(targets.includes(target), `${target} in ${targets.join(", ")}`);
  }
});

// Table Properties / Table Options / Cell Options (202610161000).
const propsMigration = new URL("../supabase/migrations/202610161000_word_efficiency_table_properties.sql", import.meta.url);
const props = {
  ...full, tableWidth: 80, tableWidthUnit: "pct", tableIndent: 1.27, tableWrap: "around", cellSpacing: 0.1, rowHeightRules: ["exactly", null], rowCantSplit: [true, null], tableTitle: "Fees", tableDescription: "Student fees by city",
  cellFormats: [[{ rowspan: 1, colspan: 2, padTop: 0.1, padBottom: 0.1, padLeft: 0.5, padRight: 0.5, noWrap: true }, { merged: true }], [{ fitText: true }, {}]],
};

test("the server accepts every Table Properties / Cell Options field and refuses malformed ones", async () => {
  const db = await database();
  await db.exec(await readFile(propsMigration, "utf8"));
  const check = (attrs) => db.query("select public.assert_word_efficiency_document_schema($1::jsonb,'{}'::jsonb)", [JSON.stringify(doc([table(attrs)]))]);
  await check(props);
  await check(full);
  validateWordEditorDocument(doc([table(props)]));
  for (const [bad, error] of [
    [{ tableWidth: 80, tableWidthUnit: "inch" }, /Invalid table width unit/],
    [{ tableWidth: 120, tableWidthUnit: "pct" }, /Invalid table width/],
    [{ tableIndent: 99 }, /Invalid table indent/],
    [{ tableWrap: "behind" }, /Invalid table text wrapping/],
    [{ cellSpacing: 9 }, /Invalid cell spacing/],
    [{ rowHeightRules: ["atLeast", null] }, /Invalid row height rules/],
    [{ rowCantSplit: [true, true, true] }, /Invalid row break settings/],
    [{ tableTitle: "x".repeat(300) }, /Invalid table alt text title/],
    [{ tableDescription: 5 }, /Invalid table alt text description/],
    [{ cellFormats: [[{ padLeft: 20 }, {}], [{}, {}]] }, /Invalid table cell formatting/],
    [{ cellFormats: [[{ noWrap: "yes" }, {}], [{}, {}]] }, /Invalid table cell formatting/],
  ]) {
    await assert.rejects(check(bad), error, JSON.stringify(bad));
    assert.throws(() => validateWordEditorDocument(doc([table(bad)])), JSON.stringify(bad));
  }
  await db.exec(await readFile(propsMigration, "utf8"));
  await check(props);
});

test("each Table Properties / Cell Options change is its own gradable criterion", () => {
  const targets = diffWordDocuments(doc([table({ cellFormats: [[{}, {}], [{}, {}]] })]), doc([table(props)])).map(change => change.target);
  for (const target of ["blocks.0.attrs.tableWidth", "blocks.0.attrs.tableWidthUnit", "blocks.0.attrs.tableIndent", "blocks.0.attrs.tableWrap", "blocks.0.attrs.cellSpacing", "blocks.0.attrs.rowHeightRules", "blocks.0.attrs.rowCantSplit", "blocks.0.attrs.tableTitle", "blocks.0.attrs.tableDescription",
    "blocks.0.attrs.cellFormats.0.0.padLeft", "blocks.0.attrs.cellFormats.0.0.noWrap", "blocks.0.attrs.cellFormats.1.0.fitText"]) {
    assert.ok(targets.includes(target), `${target} in ${targets.join(", ")}`);
  }
});
