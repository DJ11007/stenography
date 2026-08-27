import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const accessMigration = new URL("../supabase/migrations/202608260028_student_access_control.sql", import.meta.url);
const gateMigration = new URL("../supabase/migrations/202608260029_word_efficiency_access_control_gate.sql", import.meta.url);

const studentId = "00000000-0000-4000-8000-000000000001";
const adminId = "00000000-0000-4000-8000-000000000009";
const fakeTestId = "00000000-0000-4000-8000-000000000099";

async function database() {
  const db = new PGlite();
  // Minimal stand-in for the real (much larger) word-efficiency schema: only what
  // prepare_word_efficiency_attempt actually touches before the access-control
  // check would fire is stubbed, since that check is placed first in the function
  // body -- a locked student must never even reach the real test/version lookup.
  await db.exec(`
create role anon;create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.current_uid',true),'')::uuid$$;
create table public.profiles(id uuid primary key,email text,full_name text,role text not null default 'student',is_active boolean not null default true,updated_at timestamptz not null default now());
create function public.is_aal2_admin() returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
create table public.test_attempts(id uuid primary key,student_id uuid,started_at timestamptz,result jsonb);
create table public.word_efficiency_attempts(id uuid primary key,test_id uuid,version_id uuid,student_id uuid,delivery_method text,selected_duration_seconds integer,snapshot jsonb,started_at timestamptz,result jsonb);
create function public.is_active_word_efficiency_student() returns boolean language sql stable as $$select true$$;
create function public.assert_word_efficiency_working_matter(jsonb) returns void language sql immutable as $$select null::void$$;
create function public.assert_word_efficiency_editor_capabilities(jsonb) returns void language sql immutable as $$select null::void$$;
create table public.word_efficiency_tests(id uuid primary key,current_version_id uuid,status text);
create table public.word_efficiency_versions(id uuid primary key,test_id uuid,duration_options integer[],delivery_onscreen boolean,delivery_pdf boolean,working_matter_snapshot jsonb,editor_capabilities jsonb,question_count integer,maximum_marks numeric,title text,language text,instructions_markdown text,pdf_path text,pdf_file_name text,pdf_size_bytes bigint,pdf_page_count integer,pdf_uploaded_at timestamptz);
create table public.word_efficiency_questions(id uuid primary key,version_id uuid,question_number integer,display_order integer,instruction text,marks numeric,section text,is_visible boolean);
create table public.word_efficiency_question_scores(id uuid primary key,attempt_id uuid,question_id uuid,question_number integer,maximum_marks numeric);
insert into public.profiles(id,email,full_name,role)values('${adminId}','admin@example.com','Admin','admin');
insert into public.profiles(id,email,full_name,role)values('${studentId}','student@example.com','Student','student');
`);
  await db.exec(await readFile(accessMigration, "utf8"));
  await db.exec(await readFile(gateMigration, "utf8"));
  return db;
}
const asUser = (db, id) => db.query("select set_config('app.current_uid',$1,false)", [id]);

test("a locked student is rejected by prepare_word_efficiency_attempt before the real test lookup runs", async () => {
  const db = await database();
  await asUser(db, adminId);
  await db.query("select public.admin_set_student_locked($1::uuid,true)", [studentId]);
  await asUser(db, studentId);
  await assert.rejects(db.query("select public.prepare_word_efficiency_attempt($1::uuid,600,'onscreen')", [fakeTestId]), /locked/);
  await db.close();
});

test("an active student reaches the real word-efficiency check (a nonexistent test correctly reports 'test unavailable', not 'locked')", async () => {
  const db = await database();
  await asUser(db, studentId);
  await assert.rejects(db.query("select public.prepare_word_efficiency_attempt($1::uuid,600,'onscreen')", [fakeTestId]), /test unavailable/);
  await db.close();
});

test("a student who has exhausted their test limit is rejected the same way a locked student is", async () => {
  const db = await database();
  await asUser(db, adminId);
  await db.query("select public.admin_set_student_access($1::uuid,0,10,0,false)", [studentId]);
  await asUser(db, studentId);
  await assert.rejects(db.query("select public.prepare_word_efficiency_attempt($1::uuid,600,'onscreen')", [fakeTestId]), /locked/);
  await db.close();
});
