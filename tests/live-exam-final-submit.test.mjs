import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Live Exam Final Submit (migration 202611011600): after the last part a part the server never received can still be
// linked, but only an attempt STARTED during its own part, and only until 15 minutes after the exam's last part.
// Runs the real SQL of both migrations on a small scaffold.
const ADMIN = "00000000-0000-0000-0000-0000000000a1", STUDENT = "00000000-0000-0000-0000-0000000000b1";
const T = { hindi: "10000000-0000-0000-0000-000000000001", english: "10000000-0000-0000-0000-000000000002", word: "10000000-0000-0000-0000-000000000003", excel: "10000000-0000-0000-0000-000000000004" };
const read = (name) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
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
create table public.test_attempts(id uuid primary key default gen_random_uuid(), test_id uuid, student_id uuid, started_at timestamptz, result jsonb);
create table public.word_efficiency_attempts(id uuid primary key default gen_random_uuid(), test_id uuid, student_id uuid, started_at timestamptz, result jsonb);
create table public.excel_efficiency_attempts(id uuid primary key default gen_random_uuid(), test_id uuid, student_id uuid, started_at timestamptz, result jsonb);
insert into auth.users values ('${ADMIN}'), ('${STUDENT}');
insert into public.profiles values ('${STUDENT}', 'Rupendra', 'r@example.com');
insert into public.tests values ('${T.hindi}'), ('${T.english}');
insert into public.word_efficiency_tests values ('${T.word}');
insert into public.excel_efficiency_tests values ('${T.excel}');
insert into auth.state values ('${ADMIN}', true);
`);
  await db.exec(await read("202611011000_live_exam_center.sql"));
  await db.exec(await read("202611011600_live_exam_final_submit.sql"));
  return db;
}
const as = async (uid, admin = false) => (await database()).query("update auth.state set uid = $1, admin = $2", [uid, admin]);
const one = async (sql, params = []) => (await (await database()).query(sql, params)).rows[0];
const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
const ldc = (startsAt) => ({ title: "RSMSSB LDC", pattern: "rsmssb-ldc", startsAt, resultsAt: null, status: "published", sections: [
  { kind: "typing", language: "Hindi", label: "Hindi Typing", testId: T.hindi, durationSeconds: 600, gapAfterSeconds: 120, maxMarks: 25 },
  { kind: "typing", language: "English", label: "English Typing", testId: T.english, durationSeconds: 600, gapAfterSeconds: 300, maxMarks: 25 },
  { kind: "word", language: "English", label: "Word", testId: T.word, durationSeconds: 600, gapAfterSeconds: 120, maxMarks: 25 },
  { kind: "excel", language: "English", label: "Excel", testId: T.excel, durationSeconds: 600, gapAfterSeconds: 0, maxMarks: 25 },
] });
async function exam(startedMinutesAgo) {
  await as(ADMIN, true);
  const { id } = await one("select public.save_live_exam(null, $1::jsonb) as id", [JSON.stringify(ldc(minutesAgo(startedMinutesAgo)))]);
  const sections = (await (await database()).query("select id, seq from public.live_exam_sections where exam_id = $1 order by seq", [id])).rows.map((row) => row.id);
  await as(STUDENT);
  return sections;
}
const link = (section, attempt) => one("select public.record_live_exam_section($1, $2) as marks", [section, attempt]);
const typingAttempt = async (testId, startedMinutesAgo, marks) => (await one("insert into public.test_attempts(test_id, student_id, started_at, result) values ($1, $2, $3, $4) returning id", [testId, STUDENT, minutesAgo(startedMinutesAgo), { marksObtained: marks }])).id;

test("Final Submit after the exam: an attempt started during its part is linked, with its marks", async () => {
  // The exam (49 minutes) started 55 minutes ago: it ended 6 minutes ago. Hindi ran from 55 to 45 minutes ago.
  const [hindi] = await exam(55);
  const attempt = await typingAttempt(T.hindi, 54, 17.06);
  assert.equal(Number((await link(hindi, attempt)).marks), 17.06);
});

test("an attempt started after its part ended is refused, even within the 15 minutes", async () => {
  const [, english] = await exam(56);
  // English ran from 44 to 34 minutes ago; this attempt claims to have started 20 minutes ago.
  const attempt = await typingAttempt(T.english, 20, 25);
  await assert.rejects(link(english, attempt), /not open now/);
});

test("nothing is linked more than 15 minutes after the exam's last part", async () => {
  // Started 70 minutes ago: ended 21 minutes ago.
  const [hindi] = await exam(70);
  const attempt = await typingAttempt(T.hindi, 69, 20);
  await assert.rejects(link(hindi, attempt), /not open now/);
});

test("during the part nothing changed: the attempt links at once, and only once", async () => {
  const [hindi] = await exam(3);
  const attempt = await typingAttempt(T.hindi, 2, 12.5);
  assert.equal(Number((await link(hindi, attempt)).marks), 12.5);
  await assert.rejects(link(hindi, attempt), /already submitted/);
});

test("the Final Submit screen: each part's status, the agreement, and resending what the server has not received", async () => {
  const room = (await readFile(new URL("../app/live-exam/[examId]/live-exam-room.tsx", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  assert.match(room, /\{!active && phase\.kind === "finished" && !preview && !finalDone && finalOpen && \(\n\s+<FinalSubmit /);
  // Offered only while it can still hand an answer in; an exam opened later goes straight to the result.
  assert.ok(room.includes("const finalOpen = now < lastEnd + 15 * 60000;"));
  assert.ok(room.includes("(preview || finalDone || !finalOpen)"));
  assert.match(room, /I agree that I have attempted this test myself, and I want to submit it\./);
  assert.match(room, /disabled=\{!agreed \|\| busy\}/);
  assert.match(room, /const job = readLiveExamDraft<TypingJob>\(section\.id\) \?\? \(pending\?\.payload\.liveExamSectionId === section\.id \? pending : null\);/);
  assert.match(room, /await finalizeLiveExamEfficiency\(examId\)/);
  // The running copy of a typing answer is kept separately and cleared once the server has the answer.
  const exam = (await readFile(new URL("../app/typing/_components/configurable-typing-exam.tsx", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  assert.match(exam, /saveLiveExamDraft\(liveExam\.sectionId,\{kind:"managed"/);
  assert.match(exam, /if\(result&&liveExam\)clearLiveExamDraft\(liveExam\.sectionId\);/);
  // The Peripheral Check fills the screen.
  assert.match(room, /aria-label="Peripheral check" className="fixed inset-0 z-50 flex flex-col bg-white"/);
});
