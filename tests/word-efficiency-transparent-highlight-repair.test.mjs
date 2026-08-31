import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const MIGRATION = new URL("../supabase/migrations/202608310048_repair_transparent_background_highlight_bug.sql", import.meta.url);

async function database() {
  const db = new PGlite();
  await db.exec(`
create role anon;create role authenticated;
create table public.word_efficiency_attempts(id uuid primary key,document_autosave jsonb,final_document_snapshot jsonb);
create table public.word_efficiency_versions(id uuid primary key,model_answer_snapshot jsonb);
`);
  return db;
}

function run(text, overrides = {}) {
  return { text, bold: false, italic: false, underline: false, strike: false, fontFamily: null, fontSize: null, color: null, highlight: null, ...overrides };
}
function doc(blocks) {
  return { schemaVersion: "2", blocks, pageLayout: {}, operations: [], savedAt: new Date().toISOString() };
}

test("a spuriously black-highlighted run (highlight 000000, color null -- the bug's exact signature) is repaired to no highlight", async () => {
  const db = await database();
  const id = "20000000-0000-0000-0000-000000000001";
  const snapshot = doc([{ id: "b1", type: "paragraph", alignment: "left", runs: [run("hi", { highlight: "000000" })], attrs: {} }]);
  await db.query("insert into public.word_efficiency_attempts(id,document_autosave)values($1,$2::jsonb)", [id, JSON.stringify(snapshot)]);
  await db.exec(await readFile(MIGRATION, "utf8"));
  const row = (await db.query("select document_autosave from public.word_efficiency_attempts where id=$1", [id])).rows[0];
  assert.equal(row.document_autosave.blocks[0].runs[0].highlight, null);
});

test("a genuinely intentional black highlight with an explicit text color (e.g. white-on-black) is left untouched", async () => {
  const db = await database();
  const id = "20000000-0000-0000-0000-000000000002";
  const snapshot = doc([{ id: "b1", type: "paragraph", alignment: "left", runs: [run("hi", { highlight: "000000", color: "FFFFFF" })], attrs: {} }]);
  await db.query("insert into public.word_efficiency_attempts(id,document_autosave)values($1,$2::jsonb)", [id, JSON.stringify(snapshot)]);
  await db.exec(await readFile(MIGRATION, "utf8"));
  const row = (await db.query("select document_autosave from public.word_efficiency_attempts where id=$1", [id])).rows[0];
  assert.equal(row.document_autosave.blocks[0].runs[0].highlight, "000000");
  assert.equal(row.document_autosave.blocks[0].runs[0].color, "FFFFFF");
});

test("a real, deliberately applied non-black highlight is left untouched", async () => {
  const db = await database();
  const id = "20000000-0000-0000-0000-000000000003";
  const snapshot = doc([{ id: "b1", type: "paragraph", alignment: "left", runs: [run("hi", { highlight: "FFFF00" })], attrs: {} }]);
  await db.query("insert into public.word_efficiency_attempts(id,document_autosave)values($1,$2::jsonb)", [id, JSON.stringify(snapshot)]);
  await db.exec(await readFile(MIGRATION, "utf8"));
  const row = (await db.query("select document_autosave from public.word_efficiency_attempts where id=$1", [id])).rows[0];
  assert.equal(row.document_autosave.blocks[0].runs[0].highlight, "FFFF00");
});

test("both document_autosave and final_document_snapshot are repaired independently on the same attempt", async () => {
  const db = await database();
  const id = "20000000-0000-0000-0000-000000000004";
  const bad = doc([{ id: "b1", type: "paragraph", alignment: "left", runs: [run("hi", { highlight: "000000" })], attrs: {} }]);
  const clean = doc([{ id: "b1", type: "paragraph", alignment: "left", runs: [run("bye", { highlight: "FFFF00" })], attrs: {} }]);
  await db.query("insert into public.word_efficiency_attempts(id,document_autosave,final_document_snapshot)values($1,$2::jsonb,$3::jsonb)", [id, JSON.stringify(bad), JSON.stringify(clean)]);
  await db.exec(await readFile(MIGRATION, "utf8"));
  const row = (await db.query("select document_autosave,final_document_snapshot from public.word_efficiency_attempts where id=$1", [id])).rows[0];
  assert.equal(row.document_autosave.blocks[0].runs[0].highlight, null);
  assert.equal(row.final_document_snapshot.blocks[0].runs[0].highlight, "FFFF00");
});

test("an admin's model_answer_snapshot is repaired the same way", async () => {
  const db = await database();
  const id = "20000000-0000-0000-0000-000000000005";
  const snapshot = doc([{ id: "b1", type: "paragraph", alignment: "left", runs: [run("hi", { highlight: "000000" })], attrs: {} }]);
  await db.query("insert into public.word_efficiency_versions(id,model_answer_snapshot)values($1,$2::jsonb)", [id, JSON.stringify(snapshot)]);
  await db.exec(await readFile(MIGRATION, "utf8"));
  const row = (await db.query("select model_answer_snapshot from public.word_efficiency_versions where id=$1", [id])).rows[0];
  assert.equal(row.model_answer_snapshot.blocks[0].runs[0].highlight, null);
});

test("a block with no runs at all (image/table/page-break) is left completely unchanged and does not crash the repair", async () => {
  const db = await database();
  const id = "20000000-0000-0000-0000-000000000006";
  const snapshot = doc([
    { id: "b1", type: "paragraph", alignment: "left", runs: [run("hi", { highlight: "000000" })], attrs: {} },
    { id: "b2", type: "image", alignment: "left", attrs: { src: "asset:samradhi-mark", alt: "", width: 10, height: 10, localAsset: true } },
  ]);
  await db.query("insert into public.word_efficiency_attempts(id,document_autosave)values($1,$2::jsonb)", [id, JSON.stringify(snapshot)]);
  await db.exec(await readFile(MIGRATION, "utf8"));
  const row = (await db.query("select document_autosave from public.word_efficiency_attempts where id=$1", [id])).rows[0];
  assert.equal(row.document_autosave.blocks[0].runs[0].highlight, null);
  assert.deepEqual(row.document_autosave.blocks[1], snapshot.blocks[1]);
});

test("a null document_autosave/final_document_snapshot/model_answer_snapshot is left null, no crash", async () => {
  const db = await database();
  const id = "20000000-0000-0000-0000-000000000007";
  await db.query("insert into public.word_efficiency_attempts(id)values($1)", [id]);
  const versionId = "20000000-0000-0000-0000-000000000008";
  await db.query("insert into public.word_efficiency_versions(id)values($1)", [versionId]);
  await assert.doesNotReject(db.exec(await readFile(MIGRATION, "utf8")));
  const attempt = (await db.query("select document_autosave,final_document_snapshot from public.word_efficiency_attempts where id=$1", [id])).rows[0];
  assert.equal(attempt.document_autosave, null);
  assert.equal(attempt.final_document_snapshot, null);
  const version = (await db.query("select model_answer_snapshot from public.word_efficiency_versions where id=$1", [versionId])).rows[0];
  assert.equal(version.model_answer_snapshot, null);
});

test("a document that is already entirely clean is not touched at all (the where-exists guard skips it)", async () => {
  const db = await database();
  const id = "20000000-0000-0000-0000-000000000009";
  const snapshot = doc([{ id: "b1", type: "paragraph", alignment: "left", runs: [run("hi", { highlight: "FFFF00" }), run("bye")], attrs: {} }]);
  await db.query("insert into public.word_efficiency_attempts(id,document_autosave)values($1,$2::jsonb)", [id, JSON.stringify(snapshot)]);
  const before = (await db.query("select document_autosave from public.word_efficiency_attempts where id=$1", [id])).rows[0].document_autosave;
  await db.exec(await readFile(MIGRATION, "utf8"));
  const after = (await db.query("select document_autosave from public.word_efficiency_attempts where id=$1", [id])).rows[0].document_autosave;
  assert.deepEqual(after, before);
});
