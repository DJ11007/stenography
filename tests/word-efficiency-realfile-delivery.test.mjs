import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migrationPath = new URL("../supabase/migrations/202608290042_word_efficiency_realfile_delivery.sql", import.meta.url);
const admin = "81000000-0000-0000-0000-000000000001";
const student = "81000000-0000-0000-0000-000000000002";
const testId = "81000000-0000-0000-0000-000000000003";
const validMatter = { schemaVersion: "1", language: "English", paragraphs: [{ id: "p1", type: "paragraph", alignment: "left", paragraphNumber: 1, runs: [{ text: "Hello", bold: false, italic: false, underline: false }] }], formattingSummary: { paragraphs: 1, runs: 1, italicParagraphs: 0, justifiedParagraphs: 0, listItems: 0, tables: 0, fonts: [] }, warnings: [], source: { fileName: "matter.docx", sizeBytes: 100, bucket: "word-efficiency-working-matter", storagePath: "abc/matter.docx" } };
const capabilities = { schemaVersion: "2", tabs: {}, fonts: ["Calibri"], fontSizeMin: 8, fontSizeMax: 72 };

async function database() {
  const db = new PGlite();
  await db.exec(`
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create role anon;create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create table auth.state(uid uuid);
insert into auth.state values('${student}');
create function auth.uid()returns uuid language sql stable as $$select uid from auth.state limit 1$$;
create table public.profiles(id uuid primary key,role text,is_active boolean);
insert into public.profiles values('${admin}','admin',true),('${student}','student',true);
insert into auth.users(id) values('${admin}'),('${student}');
create function public.is_aal2_admin()returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
create function public.is_active_word_efficiency_student()returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='student' and is_active)$$;
create function public.assert_student_access_allowed()returns void language plpgsql as $$begin end $$;
create function public.assert_word_efficiency_working_matter(m jsonb)returns void language plpgsql as $$begin end $$;
create function public.assert_word_efficiency_editor_capabilities(c jsonb)returns void language plpgsql as $$begin end $$;
create table public.word_efficiency_tests(id uuid primary key default gen_random_uuid(),slug text,title text,language text,status text default'draft',current_version_id uuid,current_version_number int default 0,created_by uuid,published_at timestamptz);
create table public.word_efficiency_versions(id uuid primary key default gen_random_uuid(),test_id uuid,version_number int,title text,language text,description text default'',instructions_markdown text,delivery_onscreen boolean not null,delivery_pdf boolean not null,question_count int,maximum_marks numeric,duration_options int[],passing_marks numeric,pdf_path text,pdf_file_name text,pdf_size_bytes bigint,pdf_page_count int,pdf_uploaded_at timestamptz,working_matter_snapshot jsonb,editor_capabilities jsonb,created_by uuid,
  check(delivery_onscreen or delivery_pdf),
  check(not delivery_pdf or(pdf_path is not null and pdf_file_name is not null and pdf_size_bytes>0)));
create table public.word_efficiency_questions(id uuid primary key default gen_random_uuid(),version_id uuid,question_number int,instruction text,marks numeric,sample_text text,section text,display_order int,is_visible boolean default true,grading_note text);
create table public.word_efficiency_attempts(id uuid primary key default gen_random_uuid(),test_id uuid,version_id uuid,student_id uuid,delivery_method text not null check(delivery_method in('onscreen','pdf')),selected_duration_seconds int,snapshot jsonb,status text default'prepared',started_at timestamptz,original_document_snapshot jsonb);
create table public.word_efficiency_question_scores(id uuid primary key default gen_random_uuid(),attempt_id uuid,question_id uuid,question_number int,maximum_marks numeric,grading_note_snapshot text);
insert into public.word_efficiency_tests(id,slug,title,language,status,created_by) values('${testId}','sample-test','Sample Test','English','published','${admin}');
`);
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}
const asUser = (db, id) => db.query("update auth.state set uid=$1", [id]);

async function publishRealfileVersion(db) {
  await asUser(db, admin);
  const payload = { title: "Sample Test", slug: "sample-test", language: "English", description: "", instructions_markdown: "Solve the questions.", delivery_onscreen: false, delivery_pdf: false, delivery_realfile: true, question_count: 1, maximum_marks: 5, duration_options: [600], passing_marks: "", questions: [{ number: 1, instruction: "Bold paragraph 1.", marks: 5, display_order: 1, is_visible: true }], publish: true, working_matter_snapshot: validMatter, editor_capabilities: capabilities };
  const { rows } = await db.query("select public.save_word_efficiency_test(null,$1::jsonb) as id", [JSON.stringify(payload)]);
  const savedTestId = rows[0].id;
  const version = (await db.query("select id from public.word_efficiency_versions where test_id=$1", [savedTestId])).rows[0];
  return { savedTestId, versionId: version.id };
}

test("the old two-value delivery_method check and the old onscreen-or-pdf check are both actually replaced, not left in place alongside the new ones", async () => {
  const db = await database();
  const { rows: versionChecks } = await db.query("select pg_get_constraintdef(oid) as def from pg_constraint where conrelid='public.word_efficiency_versions'::regclass and contype='c'");
  assert.ok(versionChecks.some((row) => row.def.includes("delivery_realfile")), "expected a check constraint mentioning delivery_realfile");
  assert.ok(!versionChecks.some((row) => row.def.includes("delivery_onscreen") && !row.def.includes("delivery_realfile")), "the old, more restrictive check must be gone, not just superseded");
  const { rows: attemptChecks } = await db.query("select pg_get_constraintdef(oid) as def from pg_constraint where conrelid='public.word_efficiency_attempts'::regclass and contype='c' and conname like '%delivery_method%'");
  assert.ok(attemptChecks.some((row) => row.def.includes("realfile")));
  assert.ok(!attemptChecks.some((row) => !row.def.includes("realfile")), "the old 2-value delivery_method check must be gone");
  await db.close();
});

test("a test can be published with only delivery_realfile enabled, and requires the working matter to be a real uploaded .docx", async () => {
  const db = await database();
  await asUser(db, admin);
  const { versionId } = await publishRealfileVersion(db);
  const version = (await db.query("select delivery_realfile,delivery_onscreen,delivery_pdf from public.word_efficiency_versions where id=$1", [versionId])).rows[0];
  assert.equal(version.delivery_realfile, true);
  assert.equal(version.delivery_onscreen, false);
  const noSourceMatter = { ...validMatter, source: { fileName: "x.docx", sizeBytes: 10 } };
  const payload = { title: "T2", slug: "t2", language: "English", description: "", instructions_markdown: "Solve it.", delivery_onscreen: false, delivery_pdf: false, delivery_realfile: true, question_count: 1, maximum_marks: 5, duration_options: [600], passing_marks: "", questions: [{ number: 1, instruction: "Q1", marks: 5, display_order: 1, is_visible: true }], publish: true, working_matter_snapshot: noSourceMatter, editor_capabilities: capabilities };
  await assert.rejects(db.query("select public.save_word_efficiency_test(null,$1::jsonb) as id", [JSON.stringify(payload)]), /uploaded as a real \.docx/);
  await db.close();
});

test("a student can prepare a realfile attempt, and get_word_efficiency_realfile_source returns exactly where to download the original file from", async () => {
  const db = await database();
  const { savedTestId } = await publishRealfileVersion(db);
  await asUser(db, student);
  const { rows: prepared } = await db.query("select public.prepare_word_efficiency_attempt($1,600,'realfile') as id", [savedTestId]);
  const attemptId = prepared[0].id;
  const attempt = (await db.query("select delivery_method,snapshot from public.word_efficiency_attempts where id=$1", [attemptId])).rows[0];
  assert.equal(attempt.delivery_method, "realfile");
  assert.equal(attempt.snapshot.questions[0].instruction, "Bold paragraph 1.");
  const source = (await db.query("select public.get_word_efficiency_realfile_source($1) as source", [attemptId])).rows[0].source;
  assert.equal(source.bucket, "word-efficiency-working-matter");
  assert.equal(source.storagePath, "abc/matter.docx");
  await db.close();
});

test("preparing a realfile attempt on a test that never enabled real-file delivery is rejected", async () => {
  const db = await database();
  await asUser(db, admin);
  const payload = { title: "OnscreenOnly", slug: "onscreen-only", language: "English", description: "", instructions_markdown: "Solve it.", delivery_onscreen: true, delivery_pdf: false, delivery_realfile: false, question_count: 1, maximum_marks: 5, duration_options: [600], passing_marks: "", questions: [{ number: 1, instruction: "Q1", marks: 5, display_order: 1, is_visible: true }], publish: true, working_matter_snapshot: validMatter, editor_capabilities: capabilities };
  const { rows } = await db.query("select public.save_word_efficiency_test(null,$1::jsonb) as id", [JSON.stringify(payload)]);
  await asUser(db, student);
  await assert.rejects(db.query("select public.prepare_word_efficiency_attempt($1,600,'realfile')", [rows[0].id]), /delivery unavailable/);
  await db.close();
});

test("get_word_efficiency_realfile_source refuses an onscreen attempt (not realfile) and refuses another student's attempt", async () => {
  const db = await database();
  await asUser(db, admin);
  const payload = { title: "Onscreen", slug: "onscreen", language: "English", description: "", instructions_markdown: "Solve it.", delivery_onscreen: true, delivery_pdf: false, delivery_realfile: false, question_count: 1, maximum_marks: 5, duration_options: [600], passing_marks: "", questions: [{ number: 1, instruction: "Q1", marks: 5, display_order: 1, is_visible: true }], publish: true, working_matter_snapshot: validMatter, editor_capabilities: capabilities };
  const { rows } = await db.query("select public.save_word_efficiency_test(null,$1::jsonb) as id", [JSON.stringify(payload)]);
  await asUser(db, student);
  const { rows: prepared } = await db.query("select public.prepare_word_efficiency_attempt($1,600,'onscreen') as id", [rows[0].id]);
  await assert.rejects(db.query("select public.get_word_efficiency_realfile_source($1)", [prepared[0].id]), /attempt unavailable/);
  const otherStudent = "81000000-0000-0000-0000-000000000009";
  await db.query("insert into public.profiles values($1,'student',true)", [otherStudent]);
  await db.query("insert into auth.users(id) values($1)", [otherStudent]);
  await asUser(db, otherStudent);
  await assert.rejects(db.query("select public.get_word_efficiency_realfile_source($1)", [prepared[0].id]), /attempt unavailable/);
  await db.close();
});
