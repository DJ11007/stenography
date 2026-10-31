import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Live Exam Center step 1 (migration 202611011000): an RSMSSB LDC exam — Hindi typing 10 → gap 2 → English typing 10
// → gap 5 → Word 10 → gap 2 → Excel 10 — runs on the server clock; each section links the student's own attempt once,
// inside its time, and the results sheet adds the sections up. Runs the real SQL on a small scaffold.

const ADMIN = "00000000-0000-0000-0000-0000000000a1", STUDENT = "00000000-0000-0000-0000-0000000000b1", OTHER = "00000000-0000-0000-0000-0000000000b2";
const T = { hindi: "10000000-0000-0000-0000-000000000001", english: "10000000-0000-0000-0000-000000000002", word: "10000000-0000-0000-0000-000000000003", excel: "10000000-0000-0000-0000-000000000004" };
let db;
async function database() {
  if (db) return db;
  db = new PGlite();
  await db.exec(`
create schema auth;
create table auth.users(id uuid primary key);
create table auth.state(uid uuid, admin boolean default false);
create function auth.uid() returns uuid language sql stable as $$select uid from auth.state limit 1$$;
create role anon; create role authenticated;
create function public.is_aal2_admin() returns boolean language sql stable as $$select coalesce((select admin from auth.state limit 1), false)$$;
create function public.is_active_word_efficiency_student() returns boolean language sql stable as $$select true$$;
create table public.profiles(id uuid primary key, full_name text, email text);
create table public.tests(id uuid primary key);
create table public.word_efficiency_tests(id uuid primary key);
create table public.excel_efficiency_tests(id uuid primary key);
create table public.test_attempts(id uuid primary key default gen_random_uuid(), test_id uuid, student_id uuid, result jsonb);
create table public.word_efficiency_attempts(id uuid primary key default gen_random_uuid(), test_id uuid, student_id uuid, result jsonb);
create table public.excel_efficiency_attempts(id uuid primary key default gen_random_uuid(), test_id uuid, student_id uuid, result jsonb);
insert into auth.users values ('${ADMIN}'), ('${STUDENT}'), ('${OTHER}');
insert into public.profiles values ('${STUDENT}', 'Rupendra', 'r@example.com'), ('${OTHER}', 'Lokesh', 'l@example.com');
insert into public.tests values ('${T.hindi}'), ('${T.english}');
insert into public.word_efficiency_tests values ('${T.word}');
insert into public.excel_efficiency_tests values ('${T.excel}');
insert into auth.state values ('${ADMIN}', true);
`);
  await db.exec(await readFile(new URL("../supabase/migrations/202611011000_live_exam_center.sql", import.meta.url), "utf8"));
  return db;
}
const as = async (uid, admin = false) => (await database()).query("update auth.state set uid = $1, admin = $2", [uid, admin]);
const one = async (sql, params = []) => (await (await database()).query(sql, params)).rows[0];

const LDC = (startsAt) => ({
  title: "RSMSSB LDC Live Exam", pattern: "rsmssb-ldc", startsAt, resultsAt: null, status: "published",
  sections: [
    { kind: "typing", language: "Hindi", label: "Hindi Typing", testId: T.hindi, durationSeconds: 600, gapAfterSeconds: 120, maxMarks: 25 },
    { kind: "typing", language: "English", label: "English Typing", testId: T.english, durationSeconds: 600, gapAfterSeconds: 300, maxMarks: 25 },
    { kind: "word", language: "English", label: "Word Efficiency", testId: T.word, durationSeconds: 600, gapAfterSeconds: 120, maxMarks: 25 },
    { kind: "excel", language: "English", label: "Excel Efficiency", testId: T.excel, durationSeconds: 600, gapAfterSeconds: 0, maxMarks: 25 },
  ],
});
const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

test("the RSMSSB LDC timeline: 10 + 2 + 10 + 5 + 10 + 2 + 10 minutes from the start time", async () => {
  await as(ADMIN, true);
  const { id } = await one("select public.save_live_exam(null, $1::jsonb) as id", [JSON.stringify(LDC("2026-11-02T04:30:00Z"))]);
  const rows = (await (await database()).query("select seq as position, to_char(starts_at at time zone 'UTC','HH24:MI') s, to_char(ends_at at time zone 'UTC','HH24:MI') e, to_char(gap_ends_at at time zone 'UTC','HH24:MI') g from public.live_exam_timeline($1)", [id])).rows;
  assert.deepEqual(rows.map((r) => `${r.position} ${r.s}-${r.e} gap to ${r.g}`), ["1 04:30-04:40 gap to 04:42", "2 04:42-04:52 gap to 04:57", "3 04:57-05:07 gap to 05:09", "4 05:09-05:19 gap to 05:19"]);
});

test("the server clock decides the phase: waiting, a section, a gap, finished", async () => {
  await as(ADMIN, true);
  const phaseAt = async (startedMinutesAgo) => {
    const { id } = await one("select public.save_live_exam(null, $1::jsonb) as id", [JSON.stringify(LDC(minutesAgo(startedMinutesAgo)))]);
    const state = (await one("select public.live_exam_state($1) as s", [id])).s;
    return `${state.phase}${state.current ? ` ${state.current.position}` : ""}`;
  };
  assert.equal(await phaseAt(-5), "waiting");
  assert.equal(await phaseAt(3), "section 1");
  assert.equal(await phaseAt(11), "gap 1");
  assert.equal(await phaseAt(13), "section 2");
  assert.equal(await phaseAt(25), "gap 2");
  assert.equal(await phaseAt(45), "section 4");
  assert.equal(await phaseAt(50), "finished");
});

test("a section links the student's own attempt once, only while it is open, with its marks", async () => {
  await as(ADMIN, true);
  const { id } = await one("select public.save_live_exam(null, $1::jsonb) as id", [JSON.stringify(LDC(minutesAgo(3)))]);
  const sections = (await (await database()).query("select id, seq as position from public.live_exam_sections where exam_id = $1 order by seq", [id])).rows;
  const typing = await one("insert into public.test_attempts(test_id, student_id, result) values ($1, $2, '{\"marksObtained\": 21.5}') returning id", [T.hindi, STUDENT]);
  const others = await one("insert into public.test_attempts(test_id, student_id, result) values ($1, $2, '{\"marksObtained\": 20}') returning id", [T.hindi, OTHER]);
  await as(STUDENT);
  await assert.rejects((await database()).query("select public.record_live_exam_section($1, $2)", [sections[0].id, others.id]), /does not belong/);
  assert.equal(Number((await one("select public.record_live_exam_section($1, $2) as m", [sections[0].id, typing.id])).m), 21.5);
  await assert.rejects((await database()).query("select public.record_live_exam_section($1, $2)", [sections[0].id, typing.id]), /already submitted/);
  await assert.rejects((await database()).query("select public.record_live_exam_section($1, $2)", [sections[1].id, typing.id]), /not open now/, "English typing has not started yet");
  const state = (await one("select public.live_exam_state($1) as s", [id])).s;
  assert.deepEqual(state.sections.map((s) => s.submitted), [true, false, false, false]);
});

test("the results sheet: one row per student, every section's marks in order, and the total out of 100", async () => {
  await as(ADMIN, true);
  const { id } = await one("select public.save_live_exam(null, $1::jsonb) as id", [JSON.stringify(LDC(minutesAgo(3)))]);
  const [first] = (await (await database()).query("select id from public.live_exam_sections where exam_id = $1 order by seq", [id])).rows;
  const attempt = await one("insert into public.test_attempts(test_id, student_id, result) values ($1, $2, '{\"marksObtained\": 30}') returning id", [T.hindi, STUDENT]);
  await as(STUDENT);
  assert.equal(Number((await one("select public.record_live_exam_section($1, $2) as m", [first.id, attempt.id])).m), 25, "marks are capped at the section's maximum");
  await as(ADMIN, true);
  const rows = (await (await database()).query("select student_name, section_marks, total from public.admin_live_exam_results($1)", [id])).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].student_name, "Rupendra");
  assert.deepEqual(rows[0].section_marks.map((s) => [s.label, Number(s.maxMarks), s.marks === null ? null : Number(s.marks)]), [["Hindi Typing", 25, 25], ["English Typing", 25, null], ["Word Efficiency", 25, null], ["Excel Efficiency", 25, null]]);
  assert.equal(Number(rows[0].total), 25);
});

test("only an admin saves exams, and an exam's sections cannot change after it started", async () => {
  await as(STUDENT);
  await assert.rejects((await database()).query("select public.save_live_exam(null, $1::jsonb)", [JSON.stringify(LDC(minutesAgo(-60)))]), /not authorized/);
  await as(ADMIN, true);
  const { id } = await one("select public.save_live_exam(null, $1::jsonb) as id", [JSON.stringify(LDC(minutesAgo(1)))]);
  await assert.rejects((await database()).query("select public.save_live_exam($1, $2::jsonb)", [id, JSON.stringify(LDC(minutesAgo(1)))]), /already started/);
  const bad = LDC(minutesAgo(-60)); bad.sections[2].testId = T.excel;
  await assert.rejects((await database()).query("select public.save_live_exam(null, $1::jsonb)", [JSON.stringify(bad)]), /Word test not found/);
});

test("the migration can run twice", async () => {
  await (await database()).exec(await readFile(new URL("../supabase/migrations/202611011000_live_exam_center.sql", import.meta.url), "utf8"));
});
