import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migrationPath = new URL("../supabase/migrations/202609111000_exam_test_free_limit.sql", import.meta.url);

const adminId = "00000000-0000-4000-8000-000000000009";
const studentId = "00000000-0000-4000-8000-000000000001";
const otherStudentId = "00000000-0000-4000-8000-000000000002";

async function database() {
  const db = new PGlite();
  await db.exec(`
create role anon;create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.current_uid',true),'')::uuid$$;
create table public.profiles(id uuid primary key,email text,full_name text,role text not null default 'student');
create function public.is_aal2_admin() returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
create table public.tests(id uuid primary key,mode text not null,language text not null default 'English',is_live boolean not null default false);
create table public.test_attempts(id uuid primary key,student_id uuid,test_id uuid);
insert into public.profiles(id,email,full_name,role)values('${adminId}','admin@example.com','Admin','admin');
insert into public.profiles(id,email,full_name,role)values('${studentId}','student@example.com','Student One','student');
insert into public.profiles(id,email,full_name,role)values('${otherStudentId}','other@example.com','Student Two','student');
`);
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}
const asUser = (db, id) => db.query("select set_config('app.current_uid',$1,false)", [id]);

async function seedAttempt(db, { studentId: sid, mode, language = "English", isLive = false }) {
  const testId = crypto.randomUUID();
  await db.query("insert into public.tests(id,mode,language,is_live)values($1,$2,$3,$4)", [testId, mode, language, isLive]);
  await db.query("insert into public.test_attempts(id,student_id,test_id)values($1,$2,$3)", [crypto.randomUUID(), sid, testId]);
}

test("a fresh student defaults to a 20-test free exam limit, unblocked", async () => {
  const db = await database();
  await asUser(db, studentId);
  const { rows: [status] } = await db.query("select * from public.exam_test_free_status()");
  assert.equal(status.free_limit, 20);
  assert.equal(status.used_count, 0);
  assert.equal(status.remaining, 20);
  assert.equal(status.blocked, false);
  await db.query("select public.assert_exam_test_allowed()");
  await db.close();
});

test("only mode='exam' attempts count toward the limit, combined across English and Hindi -- practice/stenography/learn attempts don't, and neither does a live scheduled exam", async () => {
  const db = await database();
  for (let i = 0; i < 6; i++) await seedAttempt(db, { studentId, mode: "exam", language: "English" });
  for (let i = 0; i < 5; i++) await seedAttempt(db, { studentId, mode: "exam", language: "Hindi" });
  for (let i = 0; i < 3; i++) await seedAttempt(db, { studentId, mode: "practice" });
  await seedAttempt(db, { studentId, mode: "stenography" });
  await seedAttempt(db, { studentId, mode: "learn" });
  await seedAttempt(db, { studentId, mode: "exam", isLive: true });
  await asUser(db, studentId);
  const { rows: [status] } = await db.query("select * from public.exam_test_free_status()");
  assert.equal(status.used_count, 11);
  assert.equal(status.remaining, 9);
  await db.close();
});

test("hitting the limit blocks further exam attempts (21st and beyond), and assert_exam_test_allowed raises", async () => {
  const db = await database();
  await db.query("update public.profiles set free_exam_test_limit=20 where id=$1", [studentId]);
  for (let i = 0; i < 20; i++) await seedAttempt(db, { studentId, mode: "exam" });
  await asUser(db, studentId);
  const { rows: [status] } = await db.query("select * from public.exam_test_free_status()");
  assert.equal(status.blocked, true);
  assert.equal(status.remaining, 0);
  await assert.rejects(db.query("select public.assert_exam_test_allowed()"), /Free exam test limit reached/);
  await db.close();
});

test("a null free_exam_test_limit means unlimited, never blocked", async () => {
  const db = await database();
  await db.query("update public.profiles set free_exam_test_limit=null where id=$1", [studentId]);
  for (let i = 0; i < 100; i++) await seedAttempt(db, { studentId, mode: "exam" });
  await asUser(db, studentId);
  const { rows: [status] } = await db.query("select * from public.exam_test_free_status()");
  assert.equal(status.free_limit, null);
  assert.equal(status.remaining, null);
  assert.equal(status.blocked, false);
  await db.query("select public.assert_exam_test_allowed()");
  await db.close();
});

test("a student cannot read or change another student's limit; an admin can read anyone's and set it", async () => {
  const db = await database();
  await asUser(db, studentId);
  await assert.rejects(db.query("select * from public.exam_test_free_status($1::uuid)", [otherStudentId]), /not authorized/);
  await assert.rejects(db.query("select public.admin_set_exam_free_limit($1::uuid,$2::integer)", [otherStudentId, 10]), /not authorized/);
  await asUser(db, adminId);
  await db.query("select public.admin_set_exam_free_limit($1::uuid,$2::integer)", [otherStudentId, 5]);
  const { rows: [status] } = await db.query("select * from public.exam_test_free_status($1::uuid)", [otherStudentId]);
  assert.equal(status.free_limit, 5);
  await db.close();
});
