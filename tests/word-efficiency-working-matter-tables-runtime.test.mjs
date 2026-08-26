import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const migrationPath = new URL("../supabase/migrations/202608260027_word_efficiency_working_matter_tables.sql", import.meta.url);

async function database() {
  const db = new PGlite();
  await db.exec("create role anon;create role authenticated;");
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}

const paragraph = { id: "matter-p-1", type: "paragraph", paragraphNumber: 1, listGroup: null, runs: [{ text: "Hello", bold: false, italic: false, underline: false, strike: false, fontFamily: "Arial", fontSize: 12, color: null, highlight: null }], alignment: "left", leftIndent: 0, rightIndent: 0, lineSpacing: 1, spaceBefore: 0, spaceAfter: 0 };
function snapshotWith(paragraphs) {
  return { schemaVersion: "1", language: "English", paragraphs, formattingSummary: { paragraphs: 1, runs: 1, italicParagraphs: 0, justifiedParagraphs: 0, listItems: 0, tables: 1, fonts: ["Arial"] }, warnings: [] };
}

test("a well-formed table paragraph is accepted alongside ordinary paragraphs", async () => {
  const db = await database();
  const table = { id: "matter-table-1", type: "table", rows: [["Name", "Score"], ["Ravi", "42"]] };
  await db.query("select public.assert_word_efficiency_working_matter($1::jsonb)", [JSON.stringify(snapshotWith([paragraph, table]))]);
  await db.close();
});

test("a table with unknown fields, an out-of-range row/column count, or a malformed cell is rejected", async () => {
  const db = await database();
  const cases = [
    [{ id: "t1", type: "table", rows: [["a"]], extra: true }, /table fields are incomplete/],
    [{ id: "t1", type: "table", rows: [] }, /table row count is invalid/],
    [{ id: "t1", type: "table", rows: Array.from({ length: 51 }, () => ["a"]) }, /table row count is invalid/],
    [{ id: "t1", type: "table", rows: [Array.from({ length: 21 }, () => "a")] }, /table column count is invalid/],
    [{ id: "t1", type: "table", rows: [[123]] }, /table cell is invalid/],
    [{ id: "t1", type: "table", rows: [["a".repeat(10001)]] }, /table cell is invalid/],
  ];
  for (const [table, pattern] of cases) {
    await assert.rejects(db.query("select public.assert_word_efficiency_working_matter($1::jsonb)", [JSON.stringify(snapshotWith([paragraph, table]))]), pattern);
  }
  await db.close();
});

test("ordinary paragraph and list-item validation is unaffected by the table branch", async () => {
  const db = await database();
  const listItem = { ...paragraph, id: "matter-p-2", type: "list-item", paragraphNumber: null, listGroup: "matter-list-1" };
  await db.query("select public.assert_word_efficiency_working_matter($1::jsonb)", [JSON.stringify(snapshotWith([paragraph, listItem]))]);
  const badParagraph = { ...paragraph, alignment: "diagonal" };
  await assert.rejects(db.query("select public.assert_word_efficiency_working_matter($1::jsonb)", [JSON.stringify(snapshotWith([badParagraph]))]), /alignment is invalid/);
  await db.close();
});

test("a document combining many table cells and many paragraph runs does not let one counter starve the other", async () => {
  const db = await database();
  const manyRunParagraph = { ...paragraph, runs: Array.from({ length: 400 }, (_, i) => ({ ...paragraph.runs[0], text: `run-${i}` })) };
  const wideTable = { id: "matter-table-1", type: "table", rows: Array.from({ length: 40 }, (_, r) => Array.from({ length: 15 }, (_, c) => `r${r}c${c}`)) };
  await db.query("select public.assert_word_efficiency_working_matter($1::jsonb)", [JSON.stringify(snapshotWith([manyRunParagraph, wideTable]))]);
  await db.close();
});
