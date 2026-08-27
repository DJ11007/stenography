import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const migrationPath = new URL("../supabase/migrations/202608260028_student_access_control.sql", import.meta.url);

const studentId = "00000000-0000-4000-8000-000000000001";
const otherStudentId = "00000000-0000-4000-8000-000000000002";
const adminId = "00000000-0000-4000-8000-000000000009";

async function database() {
  const db = new PGlite();
  await db.exec(`
create role anon;create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.current_uid',true),'')::uuid$$;
create table public.profiles(id uuid primary key,email text,full_name text,role text not null default 'student',is_active boolean not null default true,updated_at timestamptz not null default now());
create function public.is_aal2_admin() returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
create table public.test_attempts(id uuid primary key,student_id uuid,started_at timestamptz,result jsonb);
create table public.word_efficiency_attempts(id uuid primary key,student_id uuid,started_at timestamptz,result jsonb);
insert into public.profiles(id,email,full_name,role)values('${adminId}','admin@example.com','Admin','admin');
insert into public.profiles(id,email,full_name,role)values('${studentId}','student@example.com','Student One','student');
insert into public.profiles(id,email,full_name,role)values('${otherStudentId}','other@example.com','Student Two','student');
`);
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}
const asUser = (db, id) => db.query("select set_config('app.current_uid',$1,false)", [id]);

test("a fresh student defaults to unlimited, unlocked, active access", async () => {
  const db = await database();
  await asUser(db, studentId);
  const { rows: [status] } = await db.query("select * from public.student_access_status()");
  assert.equal(status.status, "active");
  assert.equal(status.test_limit, null);
  assert.equal(status.tests_remaining, null);
  assert.equal(status.access_locked, false);
  await db.query("select public.assert_student_access_allowed()");
  await db.close();
});

test("admin_set_student_access sets a limit and validity window, and the student hits locked once the limit is reached", async () => {
  const db = await database();
  await asUser(db, adminId);
  await db.query("select public.admin_set_student_access($1::uuid,$2::integer,$3::integer,$4::integer,$5::boolean)", [studentId, 2, 10, 0, false]);
  await asUser(db, studentId);
  const insertAttempt = (id, daysAgo) => db.query("insert into public.test_attempts(id,student_id,started_at,result)values($1,$2,now()-make_interval(days=>$3),'{\"accuracy\":90}'::jsonb)", [id, studentId, daysAgo]);
  await insertAttempt("00000000-0000-4000-8000-000000000101", 0);
  let { rows: [status] } = await db.query("select * from public.student_access_status()");
  assert.equal(status.status, "active"); assert.equal(status.tests_remaining, 1);
  await insertAttempt("00000000-0000-4000-8000-000000000102", 0);
  ({ rows: [status] } = await db.query("select * from public.student_access_status()"));
  assert.equal(status.status, "locked"); assert.equal(status.tests_remaining, 0);
  await assert.rejects(db.query("select public.assert_student_access_allowed()"), /locked/);
  await db.close();
});

test("renewing access resets the usage window so old attempts no longer count against the new limit", async () => {
  const db = await database();
  await asUser(db, adminId);
  await db.query("select public.admin_set_student_access($1::uuid,$2::integer,$3::integer,$4::integer,$5::boolean)", [studentId, 1, 10, 0, false]);
  await asUser(db, studentId);
  await db.query("insert into public.test_attempts(id,student_id,started_at,result)values($1,$2,now(),'{}'::jsonb)", ["00000000-0000-4000-8000-000000000201", studentId]);
  let { rows: [status] } = await db.query("select * from public.student_access_status()");
  assert.equal(status.status, "locked");
  await asUser(db, adminId);
  await db.query("select public.admin_set_student_access($1::uuid,$2::integer,$3::integer,$4::integer,$5::boolean)", [studentId, 1, 10, 0, false]);
  await asUser(db, studentId);
  ({ rows: [status] } = await db.query("select * from public.student_access_status()"));
  assert.equal(status.status, "active"); assert.equal(status.tests_remaining, 1);
  await db.close();
});

test("an expired validity date without grace is locked, but within the grace window it is merely 'grace' and still allowed", async () => {
  const db = await database();
  await asUser(db, adminId);
  await db.query("update public.profiles set validity_expires_at=now()-interval '1 day',grace_days=3 where id=$1", [studentId]);
  await asUser(db, studentId);
  let { rows: [status] } = await db.query("select * from public.student_access_status()");
  assert.equal(status.status, "grace");
  await db.query("select public.assert_student_access_allowed()");
  await asUser(db, adminId);
  await db.query("update public.profiles set validity_expires_at=now()-interval '10 days',grace_days=3 where id=$1", [studentId]);
  await asUser(db, studentId);
  ({ rows: [status] } = await db.query("select * from public.student_access_status()"));
  assert.equal(status.status, "locked");
  await assert.rejects(db.query("select public.assert_student_access_allowed()"), /locked/);
  await db.close();
});

test("admin_set_student_locked toggles an explicit lock independent of limit/validity", async () => {
  const db = await database();
  await asUser(db, adminId);
  await db.query("select public.admin_set_student_locked($1::uuid,true)", [studentId]);
  await asUser(db, studentId);
  let { rows: [status] } = await db.query("select * from public.student_access_status()");
  assert.equal(status.status, "locked");
  await asUser(db, adminId);
  await db.query("select public.admin_set_student_locked($1::uuid,false)", [studentId]);
  await asUser(db, studentId);
  ({ rows: [status] } = await db.query("select * from public.student_access_status()"));
  assert.equal(status.status, "active");
  await db.close();
});

test("a student cannot read or change another student's access status, only their own", async () => {
  const db = await database();
  await asUser(db, studentId);
  await assert.rejects(db.query("select * from public.student_access_status($1::uuid)", [otherStudentId]), /not authorized/);
  await assert.rejects(db.query("select public.admin_set_student_access($1::uuid,5,10,0,false)", [otherStudentId]), /not authorized/);
  await assert.rejects(db.query("select public.admin_list_student_access()"), /not authorized/);
  await db.close();
});

test("admin_list_student_access aggregates tests_today, tests_total, and avg_score across both test_attempts and word_efficiency_attempts", async () => {
  const db = await database();
  await asUser(db, studentId);
  await db.query("insert into public.test_attempts(id,student_id,started_at,result)values($1,$2,now(),'{\"accuracy\":80}'::jsonb)", ["00000000-0000-4000-8000-000000000301", studentId]);
  await db.query("insert into public.word_efficiency_attempts(id,student_id,started_at,result)values($1,$2,now(),'{\"percentage\":60}'::jsonb)", ["00000000-0000-4000-8000-000000000302", studentId]);
  await asUser(db, adminId);
  const { rows } = await db.query("select * from public.admin_list_student_access() where student_id=$1", [studentId]);
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].tests_today), 2);
  assert.equal(Number(rows[0].tests_total), 2);
  assert.equal(Number(rows[0].avg_score), 70);
  await db.close();
});
