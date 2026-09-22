import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migration = () => read("supabase/migrations/202609230000_live_results_by_date.sql");

const studentA = "00000000-0000-4000-8000-000000000001";
const studentB = "00000000-0000-4000-8000-000000000002";

// Real requested feature: a result from a few days back used to scroll
// off published_live_results's latest-30-overall feed and become
// unfindable. published_live_result_dates() lists which IST calendar
// days actually have a published result, and
// published_live_results_by_date() returns a whole day's results,
// uncapped by that 30-row limit.
async function database() {
  const db = new PGlite();
  await db.exec(`
create role anon; create role authenticated;
create table public.profiles(id uuid primary key, full_name text);
create table public.tests(id uuid primary key, title text, language text, is_live boolean default true, results_publish_at timestamptz, results_delay_minutes integer);
create table public.test_attempts(id uuid primary key default gen_random_uuid(), test_id uuid references public.tests(id), student_id uuid references public.profiles(id), is_live_attempt boolean default true, result jsonb, submitted_at timestamptz default now());
insert into public.profiles values ('${studentA}','Asha Verma'), ('${studentB}','Bhanu Singh');
`);
  await db.exec(await migration());
  return db;
}

test("published_live_result_dates returns only IST calendar days with a published result, most recent first", async () => {
  const db = await database();
  await db.query(`insert into public.tests(id, title, language, results_publish_at) values (gen_random_uuid(), 'Day 1 Test', 'English', now() - interval '1 hour')`);
  await db.query(`insert into public.tests(id, title, language, results_publish_at) values (gen_random_uuid(), 'Day 2 Test', 'English', now() - interval '1 hour')`);
  await db.query(`insert into public.tests(id, title, language, results_publish_at) values (gen_random_uuid(), 'Unpublished Test', 'English', now() + interval '1 hour')`);
  const { rows: [day1] } = await db.query(`select id from public.tests where title='Day 1 Test'`);
  const { rows: [day2] } = await db.query(`select id from public.tests where title='Day 2 Test'`);
  const { rows: [unpublished] } = await db.query(`select id from public.tests where title='Unpublished Test'`);

  await db.query(`insert into public.test_attempts(test_id, student_id, result, submitted_at) values ($1,$2,'{}'::jsonb, timestamptz '2026-09-10 08:00:00+05:30')`, [day1.id, studentA]);
  await db.query(`insert into public.test_attempts(test_id, student_id, result, submitted_at) values ($1,$2,'{}'::jsonb, timestamptz '2026-09-12 08:00:00+05:30')`, [day2.id, studentA]);
  // Attempt on an unpublished test must not contribute a date.
  await db.query(`insert into public.test_attempts(test_id, student_id, result, submitted_at) values ($1,$2,'{}'::jsonb, timestamptz '2026-09-15 08:00:00+05:30')`, [unpublished.id, studentA]);

  // node-postgres (used directly by PGlite) returns `date` columns as JS
  // Date objects; over the app's real path (PostgREST/supabase-js) the
  // same column comes back as a plain "YYYY-MM-DD" string -- normalize
  // here so the assertion reflects the actual production shape.
  const { rows } = await db.query("select * from public.published_live_result_dates(90)");
  const dates = rows.map((r) => r.result_date.toISOString().slice(0, 10));
  assert.deepEqual(dates, ["2026-09-12", "2026-09-10"], "most recent day first, excluding the unpublished test's date");
  await db.close();
});

test("published_live_results_by_date returns every published result for that IST day (not capped at 30), with real names", async () => {
  const db = await database();
  await db.query(`insert into public.tests(id, title, language, results_publish_at) values (gen_random_uuid(), 'English Live Test', 'English', now() - interval '1 hour')`);
  const { rows: [englishTest] } = await db.query(`select id from public.tests where language='English'`);

  await db.query(`insert into public.test_attempts(test_id, student_id, result, submitted_at) values ($1,$2,$3::jsonb, timestamptz '2026-09-12 08:00:00+05:30')`, [englishTest.id, studentA, JSON.stringify({ netWpm: 40 })]);
  await db.query(`insert into public.test_attempts(test_id, student_id, result, submitted_at) values ($1,$2,$3::jsonb, timestamptz '2026-09-13 08:00:00+05:30')`, [englishTest.id, studentB, JSON.stringify({ netWpm: 55 })]);

  const { rows } = await db.query("select * from public.published_live_results_by_date('2026-09-12', 200)");
  assert.equal(rows.length, 1, "only the requested day's attempt, not the other day's");
  assert.equal(rows[0].student_name, "Asha Verma");
  assert.equal(Number(rows[0].net_wpm), 40);
  await db.close();
});

test("published_live_results_by_date returns an empty array (not an error) for a date with zero published results", async () => {
  const db = await database();
  const { rows } = await db.query("select * from public.published_live_results_by_date('2026-01-01', 200)");
  assert.deepEqual(rows, []);
  await db.close();
});
