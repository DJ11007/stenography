import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migration = () => read("supabase/migrations/202609222200_published_live_efficiency_tests.sql");

// Real reported request: /live-test should group Typing/Stenography/
// Efficiency tests into categories. Word and Excel Efficiency tests live
// in tables whose select policies are ALL "for select to authenticated"
// only (unlike public.tests, which has a genuinely public policy), so a
// direct client-side query would silently return zero rows for anonymous
// visitors. This RPC is the SECURITY DEFINER escape hatch that makes
// published, live efficiency tests readable to anon too -- mirroring the
// same pattern already used by published_live_results.
async function database() {
  const db = new PGlite();
  await db.exec(`
create role anon; create role authenticated;
create table public.word_efficiency_versions(id uuid primary key, duration_options integer[]);
create table public.word_efficiency_tests(id uuid primary key, slug text, title text, language text, status text, is_live boolean, live_starts_at timestamptz, live_ends_at timestamptz, results_publish_at timestamptz, current_version_id uuid references public.word_efficiency_versions(id));
create table public.excel_efficiency_versions(id uuid primary key, duration_options integer[]);
create table public.excel_efficiency_tests(id uuid primary key, slug text, title text, language text, status text, is_live boolean, live_starts_at timestamptz, live_ends_at timestamptz, results_publish_at timestamptz, current_version_id uuid references public.excel_efficiency_versions(id));
`);
  await db.exec(await migration());
  return db;
}

test("published_live_efficiency_tests returns both word and excel rows, each tagged with its own subject", async () => {
  const db = await database();
  const wordVersion = crypto.randomUUID();
  const excelVersion = crypto.randomUUID();
  await db.query(`insert into public.word_efficiency_versions(id, duration_options) values ($1, '{600,1200}')`, [wordVersion]);
  await db.query(`insert into public.excel_efficiency_versions(id, duration_options) values ($1, '{900,1800}')`, [excelVersion]);
  await db.query(`insert into public.word_efficiency_tests(id, slug, title, language, status, is_live, current_version_id) values (gen_random_uuid(), 'word-test', 'Word Live Test', 'English', 'published', true, $1)`, [wordVersion]);
  await db.query(`insert into public.excel_efficiency_tests(id, slug, title, language, status, is_live, current_version_id) values (gen_random_uuid(), 'excel-test', 'Excel Live Test', 'Hindi', 'published', true, $1)`, [excelVersion]);

  const { rows } = await db.query("select * from public.published_live_efficiency_tests() order by subject");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].subject, "excel");
  assert.deepEqual(rows[0].duration_options, [900, 1800]);
  assert.equal(rows[1].subject, "word");
  assert.deepEqual(rows[1].duration_options, [600, 1200]);
  await db.close();
});

test("published_live_efficiency_tests excludes rows that aren't both published and live", async () => {
  const db = await database();
  const version = crypto.randomUUID();
  await db.query(`insert into public.word_efficiency_versions(id, duration_options) values ($1, '{600}')`, [version]);
  await db.query(`insert into public.word_efficiency_tests(id, slug, title, language, status, is_live, current_version_id) values
    (gen_random_uuid(), 'draft-test', 'Draft Test', 'English', 'draft', true, $1),
    (gen_random_uuid(), 'not-live-test', 'Not Live Test', 'English', 'published', false, $1)`, [version]);

  const { rows } = await db.query("select * from public.published_live_efficiency_tests()");
  assert.equal(rows.length, 0);
  await db.close();
});

test("published_live_efficiency_tests is callable by anon (the grant this public /live-test page depends on)", async () => {
  const db = await database();
  await db.query(`set role anon`);
  const { rows } = await db.query("select * from public.published_live_efficiency_tests()");
  assert.deepEqual(rows, []);
  await db.close();
});
