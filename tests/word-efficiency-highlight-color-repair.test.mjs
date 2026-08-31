import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const MIGRATION = new URL("../supabase/migrations/202608310046_repair_working_matter_highlight_colors.sql", import.meta.url);

async function database() {
  const db = new PGlite();
  await db.exec(`
create table public.word_efficiency_versions(id uuid primary key,working_matter_snapshot jsonb);
`);
  return db;
}

function run(text, highlight) {
  return { text, bold: false, italic: false, underline: false, strike: false, fontFamily: null, fontSize: null, color: null, highlight };
}
function paragraph(id, runs) {
  return { id, type: "paragraph", paragraphNumber: 1, listGroup: null, runs, alignment: "left", leftIndent: 0, rightIndent: 0, lineSpacing: 1, spaceBefore: 0, spaceAfter: 0 };
}

test("raw OOXML highlight enum names (black, red, darkGreen, ...) are converted to real hex", async () => {
  const db = await database();
  const id = "10000000-0000-0000-0000-000000000001";
  const snapshot = { schemaVersion: 1, language: "English", paragraphs: [paragraph("p1", [run("hi", "black"), run("there", "red"), run("world", "darkGreen")])], formattingSummary: {}, warnings: [] };
  await db.query("insert into public.word_efficiency_versions(id,working_matter_snapshot) values($1,$2::jsonb)", [id, JSON.stringify(snapshot)]);
  await db.exec(await readFile(MIGRATION, "utf8"));
  const row = (await db.query("select working_matter_snapshot from public.word_efficiency_versions where id=$1", [id])).rows[0];
  const runs = row.working_matter_snapshot.paragraphs[0].runs;
  assert.equal(runs[0].highlight, "000000");
  assert.equal(runs[1].highlight, "FF0000");
  assert.equal(runs[2].highlight, "006400");
  await db.close();
});

test("an already-correct hex highlight is left untouched", async () => {
  const db = await database();
  const id = "10000000-0000-0000-0000-000000000002";
  const snapshot = { schemaVersion: 1, language: "English", paragraphs: [paragraph("p1", [run("hi", "FFFF00")])], formattingSummary: {}, warnings: [] };
  await db.query("insert into public.word_efficiency_versions(id,working_matter_snapshot) values($1,$2::jsonb)", [id, JSON.stringify(snapshot)]);
  await db.exec(await readFile(MIGRATION, "utf8"));
  const row = (await db.query("select working_matter_snapshot from public.word_efficiency_versions where id=$1", [id])).rows[0];
  assert.equal(row.working_matter_snapshot.paragraphs[0].runs[0].highlight, "FFFF00");
  await db.close();
});

test("an unrecognized highlight value (garbage, or a name outside the 16-entry OOXML enum) becomes null instead of an unpredictable raw string", async () => {
  const db = await database();
  const id = "10000000-0000-0000-0000-000000000003";
  const snapshot = { schemaVersion: 1, language: "English", paragraphs: [paragraph("p1", [run("hi", "notAColor")])], formattingSummary: {}, warnings: [] };
  await db.query("insert into public.word_efficiency_versions(id,working_matter_snapshot) values($1,$2::jsonb)", [id, JSON.stringify(snapshot)]);
  await db.exec(await readFile(MIGRATION, "utf8"));
  const row = (await db.query("select working_matter_snapshot from public.word_efficiency_versions where id=$1", [id])).rows[0];
  assert.equal(row.working_matter_snapshot.paragraphs[0].runs[0].highlight, null);
  await db.close();
});

test("a run with no highlight at all, and a table paragraph, are both left completely unchanged", async () => {
  const db = await database();
  const id = "10000000-0000-0000-0000-000000000004";
  const snapshot = { schemaVersion: 1, language: "English", paragraphs: [paragraph("p1", [run("hi", null)]), { id: "t1", type: "table", rows: [["a", "b"]] }], formattingSummary: {}, warnings: [] };
  await db.query("insert into public.word_efficiency_versions(id,working_matter_snapshot) values($1,$2::jsonb)", [id, JSON.stringify(snapshot)]);
  await db.exec(await readFile(MIGRATION, "utf8"));
  const row = (await db.query("select working_matter_snapshot from public.word_efficiency_versions where id=$1", [id])).rows[0];
  assert.equal(row.working_matter_snapshot.paragraphs[0].runs[0].highlight, null);
  assert.deepEqual(row.working_matter_snapshot.paragraphs[1], { id: "t1", type: "table", rows: [["a", "b"]] });
  await db.close();
});

test("a version whose snapshot is already entirely clean is not touched at all (the where-exists guard skips it)", async () => {
  const db = await database();
  const id = "10000000-0000-0000-0000-000000000005";
  const snapshot = { schemaVersion: 1, language: "English", paragraphs: [paragraph("p1", [run("hi", "FFFF00"), run("bye", null)])], formattingSummary: {}, warnings: [] };
  await db.query("insert into public.word_efficiency_versions(id,working_matter_snapshot) values($1,$2::jsonb)", [id, JSON.stringify(snapshot)]);
  const before = (await db.query("select working_matter_snapshot from public.word_efficiency_versions where id=$1", [id])).rows[0].working_matter_snapshot;
  await db.exec(await readFile(MIGRATION, "utf8"));
  const after = (await db.query("select working_matter_snapshot from public.word_efficiency_versions where id=$1", [id])).rows[0].working_matter_snapshot;
  assert.deepEqual(after, before);
  await db.close();
});
