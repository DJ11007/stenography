import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createJiti } from "jiti";

// Practice documents can hold a paragraph's shading, double strikethrough and table cell formatting (migration
// 202611271000), so a paper can ask to remove them (Hindi Word EFFICIENCY TEST 11, Q4, Q10 and Q13). The admin applies
// them in the document designer (the exam editor); this follows them from that editor's saved document to the stored
// practice document, through the database's check of it, to the starting document an attempt is marked against --
// which must show them exactly as the student's editor saves them.

const jiti = createJiti(import.meta.url);
const { editorDocumentToMatter } = await jiti.import("../lib/word-matter-from-editor.ts");
const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

const plain = { bold: false, italic: false, underline: false, strike: false, fontFamily: "Kruti Dev 010", fontSize: 14, color: null, highlight: null };
// As the editor saves the designer's document.
const designed = {
  schemaVersion: "2",
  blocks: [
    { type: "paragraph", alignment: "justify", runs: [{ ...plain, text: "Hkkjr" }], attrs: { backgroundColor: "rgb(146, 208, 80)", marginBottom: "8pt" } },
    { type: "paragraph", alignment: "left", runs: [{ ...plain, text: "nwljk " }, { ...plain, text: "dkVk gqvk", doubleStrike: true }], attrs: {} },
    { type: "table", alignment: "left", runs: [], attrs: { rows: [["uke", "vad"], ["jke", "42"]], cellFormats: [[{ underline: true, fontFamily: "Kruti Dev 010", fontSize: 14 }, { bold: true, color: "FF0000", align: "justify" }], [{ underline: true }, null]] } },
  ],
};

let db;
async function database() {
  if (db) return db;
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role;");
  const fonts = await read("supabase/migrations/202608250012_repair_word_efficiency_fonts_clipboard_and_measurements.sql");
  const start = fonts.indexOf("create or replace function public.word_efficiency_approved_fonts()");
  await db.exec(fonts.slice(start, fonts.indexOf("$$;", fonts.indexOf("$$", fonts.indexOf(" as ", start)) + 2) + 3));
  await db.exec(await read("supabase/migrations/202611271000_word_matter_shading_double_strike_cell_formats.sql"));
  return db;
}

test("saving the designed document keeps the shading, the double strikethrough and the cell formatting", () => {
  const result = editorDocumentToMatter(designed, "Hindi");
  assert.equal(result.ok, true);
  const [first, second, table] = result.matter.paragraphs;
  assert.equal(first.shading, "92D050");
  assert.deepEqual(second.runs.map((run) => [run.text, run.strike, run.doubleStrike ?? false]), [["nwljk ", false, false], ["dkVk gqvk", false, true]]);
  assert.deepEqual(table.cellFormats, [[{ underline: true }, { bold: true, color: "FF0000", align: "justify" }], [{ underline: true }, null]]);
  assert.deepEqual(table.cellFonts, [["Kruti Dev 010", null], [null, null]]);
  assert.ok(!result.matter.warnings.some((warning) => /shading|double/i.test(warning)), result.matter.warnings.join(" "));
});

test("the database accepts it, and the starting document shows it as the student's editor saves it", async () => {
  const live = await database();
  const { matter } = editorDocumentToMatter(designed, "Hindi");
  await live.query("select public.assert_word_efficiency_working_matter($1::jsonb)", [JSON.stringify(matter)]);
  const { rows: [{ d }] } = await live.query("select public.word_efficiency_initial_editor_document($1::jsonb) d", [JSON.stringify(matter)]);
  assert.equal(d.blocks[0].attrs.backgroundColor, "rgb(146, 208, 80)");
  assert.deepEqual(d.blocks[1].runs.map((run) => [run.strike, run.doubleStrike]), [[false, false], [false, true]]);
  assert.deepEqual(d.blocks[2].attrs.cellFormats, [[{ underline: true, fontFamily: "Kruti Dev 010", fontSize: 14 }, { bold: true, color: "FF0000", align: "justify" }], [{ underline: true }, null]]);
});

test("older practice documents are unchanged: no shading, no double strike, no cell formatting", async () => {
  const live = await database();
  const old = {
    schemaVersion: "1", language: "Hindi", formattingSummary: {}, warnings: [],
    paragraphs: [
      { id: "matter-p-1", type: "paragraph", paragraphNumber: 1, listGroup: null, runs: [{ ...plain, text: "Hkkjr" }], alignment: "left", leftIndent: 0, rightIndent: 0, lineSpacing: 1, spaceBefore: 0, spaceAfter: 8 },
      { id: "matter-p-2", type: "table", rows: [["uke"]], cellFonts: [["Kruti Dev 010"]] },
    ],
  };
  await live.query("select public.assert_word_efficiency_working_matter($1::jsonb)", [JSON.stringify(old)]);
  const { rows: [{ d }] } = await live.query("select public.word_efficiency_initial_editor_document($1::jsonb) d", [JSON.stringify(old)]);
  assert.equal("backgroundColor" in d.blocks[0].attrs, false);
  assert.equal(d.blocks[0].runs[0].doubleStrike, false);
  assert.deepEqual(d.blocks[1].attrs, { rows: [["uke"]] });
});

test("malformed new fields are refused", async () => {
  const live = await database();
  const base = (paragraph) => JSON.stringify({ schemaVersion: "1", language: "Hindi", paragraphs: [paragraph] });
  const text = { id: "p", type: "paragraph", paragraphNumber: 1, listGroup: null, runs: [{ ...plain, text: "a" }], alignment: "left", leftIndent: 0, rightIndent: 0, lineSpacing: 1, spaceBefore: 0, spaceAfter: 0 };
  for (const [paragraph, pattern] of [
    [{ ...text, shading: "green" }, /shading is invalid/],
    [{ ...text, runs: [{ ...plain, text: "a", strike: true, doubleStrike: true }] }, /double strikethrough is invalid/],
    [{ id: "t", type: "table", rows: [["a"]], cellFormats: [[{ underline: "yes" }]] }, /cell formatting is invalid/],
    [{ id: "t", type: "table", rows: [["a"]], cellFormats: [[{ fontSize: 9 }]] }, /cell formatting is invalid/],
    [{ id: "t", type: "table", rows: [["a", "b"]], cellFormats: [[null]] }, /cell formatting is invalid/],
  ]) await assert.rejects(live.query("select public.assert_word_efficiency_working_matter($1::jsonb)", [base(paragraph)]), pattern);
});
