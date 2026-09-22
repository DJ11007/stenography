import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migration = () => read("supabase/migrations/202609222100_live_results_language_and_top_rankers.sql");

const studentA = "00000000-0000-4000-8000-000000000001";
const studentB = "00000000-0000-4000-8000-000000000002";
const studentC = "00000000-0000-4000-8000-000000000003";

// Minimal fixture: only the columns published_live_results /
// published_live_test_top_rankers actually reference. auth.uid() isn't
// needed -- neither function calls it -- but the migration's own grant
// statements name the anon/authenticated roles, so they must exist.
async function database() {
  const db = new PGlite();
  await db.exec(`
create role anon; create role authenticated;
create table public.profiles(id uuid primary key, full_name text);
create table public.tests(id uuid primary key, title text, language text, is_live boolean default true, results_publish_at timestamptz, results_delay_minutes integer);
create table public.test_attempts(id uuid primary key default gen_random_uuid(), test_id uuid references public.tests(id), student_id uuid references public.profiles(id), is_live_attempt boolean default true, result jsonb, submitted_at timestamptz default now());
insert into public.profiles values
  ('${studentA}','Asha Verma'),
  ('${studentB}','Bhanu Singh'),
  ('${studentC}','Chetan Roy');
`);
  await db.exec(await migration());
  return db;
}

const PAST = "now() - interval '1 hour'";
const FUTURE = "now() + interval '1 hour'";

test("published_live_results now returns a language column, still excludes unpublished rows, and keeps the X••• anonymized name format unchanged", async () => {
  const db = await database();
  await db.query(`insert into public.tests(id, title, language, results_publish_at) values
    (gen_random_uuid(), 'English Live Test', 'English', ${PAST})`);
  const { rows: [englishTest] } = await db.query(`select id from public.tests where language='English'`);
  await db.query(`insert into public.tests(id, title, language, results_publish_at) values ($1, 'Not Yet Published', 'English', ${FUTURE})`, [crypto.randomUUID()]);
  await db.query(
    `insert into public.test_attempts(test_id, student_id, result, submitted_at) values ($1, $2, $3::jsonb, now())`,
    [englishTest.id, studentA, JSON.stringify({ netWpm: 42, accuracy: 96 })],
  );

  const { rows } = await db.query("select * from public.published_live_results(30)");
  assert.equal(rows.length, 1, "the not-yet-published test's attempt must not appear");
  assert.equal(rows[0].language, "English");
  assert.equal(Number(rows[0].net_wpm), 42);
  assert.match(rows[0].student_name, /^A•••$/);
  await db.close();
});

test("published_live_test_top_rankers dedupes to each student's single best net_wpm, ranked descending, with the REAL name (not anonymized)", async () => {
  const db = await database();
  await db.query(`insert into public.tests(id, title, language, results_publish_at) values (gen_random_uuid(), 'English Live Test', 'English', ${PAST})`);
  const { rows: [englishTest] } = await db.query(`select id from public.tests where language='English'`);

  // Student A: two published attempts (40, 60) -- best is 60.
  await db.query(`insert into public.test_attempts(test_id, student_id, result) values ($1,$2,$3::jsonb),($1,$2,$4::jsonb)`, [englishTest.id, studentA, JSON.stringify({ netWpm: 40 }), JSON.stringify({ netWpm: 60 })]);
  // Student B: one published attempt (55).
  await db.query(`insert into public.test_attempts(test_id, student_id, result) values ($1,$2,$3::jsonb)`, [englishTest.id, studentB, JSON.stringify({ netWpm: 55 })]);

  const { rows } = await db.query("select * from public.published_live_test_top_rankers('English', 3)");
  assert.equal(rows.length, 2, "one deduplicated row per student, not one per attempt");
  assert.deepEqual(rows.map((r) => Number(r.net_wpm)), [60, 55], "ordered by each student's best score descending");
  assert.equal(rows[0].student_name, "Asha Verma", "real name, not anonymized");
  assert.equal(rows[1].student_name, "Bhanu Singh");
  await db.close();
});

test("published_live_test_top_rankers is scoped by language -- a Hindi-only high scorer never appears in an English query, and does appear in a Hindi one", async () => {
  const db = await database();
  await db.query(`insert into public.tests(id, title, language, results_publish_at) values (gen_random_uuid(), 'English Live Test', 'English', ${PAST})`);
  await db.query(`insert into public.tests(id, title, language, results_publish_at) values (gen_random_uuid(), 'Hindi Live Test', 'Hindi', ${PAST})`);
  const { rows: [englishTest] } = await db.query(`select id from public.tests where language='English'`);
  const { rows: [hindiTest] } = await db.query(`select id from public.tests where language='Hindi'`);

  await db.query(`insert into public.test_attempts(test_id, student_id, result) values ($1,$2,$3::jsonb)`, [englishTest.id, studentA, JSON.stringify({ netWpm: 30 })]);
  await db.query(`insert into public.test_attempts(test_id, student_id, result) values ($1,$2,$3::jsonb)`, [hindiTest.id, studentC, JSON.stringify({ netWpm: 99 })]);

  const englishRankers = await db.query("select * from public.published_live_test_top_rankers('English', 3)");
  assert.ok(!englishRankers.rows.some((r) => r.student_name === "Chetan Roy"), "the Hindi-only high scorer must not leak into the English ranking");

  const hindiRankers = await db.query("select * from public.published_live_test_top_rankers('Hindi', 3)");
  assert.ok(hindiRankers.rows.some((r) => r.student_name === "Chetan Roy"), "and must appear in the Hindi ranking");
  await db.close();
});

test("published_live_test_top_rankers returns an empty array (not an error) for a language with zero published rows", async () => {
  const db = await database();
  const { rows } = await db.query("select * from public.published_live_test_top_rankers('French', 3)");
  assert.deepEqual(rows, []);
  await db.close();
});
