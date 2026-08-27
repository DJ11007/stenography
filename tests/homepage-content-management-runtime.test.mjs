import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const migrationPath = new URL("../supabase/migrations/202608260030_homepage_content_management.sql", import.meta.url);
const richDetailsMigrationPath = new URL("../supabase/migrations/202608260031_vacancy_notice_rich_details.sql", import.meta.url);
const documentsMigrationPath = new URL("../supabase/migrations/202608260033_vacancy_notice_documents.sql", import.meta.url);

const adminId = "00000000-0000-4000-8000-000000000009";
const studentId = "00000000-0000-4000-8000-000000000001";
const otherStudentId = "00000000-0000-4000-8000-000000000002";

async function database() {
  const db = new PGlite();
  await db.exec(`
create role anon;create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.current_uid',true),'')::uuid$$;
create table public.profiles(id uuid primary key,email text,full_name text,role text not null default 'student');
create function public.is_aal2_admin() returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
insert into auth.users(id) values ('${adminId}'),('${studentId}'),('${otherStudentId}');
insert into public.profiles(id,email,full_name,role)values('${adminId}','admin@example.com','Admin','admin');
insert into public.profiles(id,email,full_name,role)values('${studentId}','student@example.com','Student One','student');
insert into public.profiles(id,email,full_name,role)values('${otherStudentId}','other@example.com','Student Two','student');
-- Minimal stand-ins for the storage schema that already exists in a real Supabase project
-- before any app migration runs.
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
`);
  await db.exec(await readFile(migrationPath, "utf8"));
  await db.exec(await readFile(richDetailsMigrationPath, "utf8"));
  await db.exec(await readFile(documentsMigrationPath, "utf8"));
  return db;
}
const asUser = (db, id) => db.query("select set_config('app.current_uid',$1,false)", [id ?? ""]);

test("public visitors can list published course packages and vacancy notices without authentication", async () => {
  const db = await database();
  await asUser(db, adminId);
  await db.query("select public.admin_save_course_package(null,'Samradhi Complete Course','6 Months','₹599',null,array['Typing','Efficiency','Stenography'],'SAVE100','Flat ₹100 off',true,true,0)");
  await db.query(`select public.admin_save_vacancy_notice(null,'jobs','Sample Clerk Recruitment','RSSB','Summary text','Open',array['Notification: TBD'],array['General: TBD'],array['Graduate'],array['18-40'],'https://example.com/notice','https://example.com/apply',true,0,null)`);
  await asUser(db, null);
  const { rows: packages } = await db.query("select * from public.list_published_course_packages()");
  assert.equal(packages.length, 1);
  assert.equal(packages[0].coupon_code, "SAVE100");
  const { rows: vacancies } = await db.query("select * from public.list_published_vacancy_notices('jobs',null)");
  assert.equal(vacancies.length, 1);
  assert.equal(vacancies[0].slug, "sample-clerk-recruitment");
  await db.close();
});

test("only aal2 admins can save or delete course packages and vacancy notices", async () => {
  const db = await database();
  await asUser(db, studentId);
  await assert.rejects(db.query("select public.admin_save_course_package(null,'X','1 Month','₹99',null,'{}','','',false,true,0)"), /not authorized/);
  await assert.rejects(db.query(`select public.admin_save_vacancy_notice(null,'jobs','X','','','',array[]::text[],array[]::text[],array[]::text[],array[]::text[],null,null,true,0,null)`), /not authorized/);
  await db.close();
});

test("vacancy notice slugs auto-generate from title and de-duplicate on collision", async () => {
  const db = await database();
  await asUser(db, adminId);
  const insert = () => db.query(`select (public.admin_save_vacancy_notice(null,'results','Typing Test Result','','','',array[]::text[],array[]::text[],array[]::text[],array[]::text[],null,null,true,0,null)).slug`);
  const first = await insert();
  const second = await insert();
  assert.equal(first.rows[0].slug, "typing-test-result");
  assert.equal(second.rows[0].slug, "typing-test-result-1");
  await db.close();
});

test("unpublished vacancy notices and packages are invisible to public reads but visible to admin listings", async () => {
  const db = await database();
  await asUser(db, adminId);
  const { rows: [saved] } = await db.query(`select * from public.admin_save_vacancy_notice(null,'admit-cards','Draft Notice','','','',array[]::text[],array[]::text[],array[]::text[],array[]::text[],null,null,false,0,null)`);
  await asUser(db, null);
  const { rows: publicRows } = await db.query("select * from public.list_published_vacancy_notices('admit-cards',null)");
  assert.equal(publicRows.length, 0);
  await asUser(db, adminId);
  const { rows: adminRows } = await db.query("select * from public.admin_list_vacancy_notices()");
  assert.equal(adminRows.length, 1);
  assert.equal(adminRows[0].id, saved.id);
  await db.close();
});

test("students can submit feedback but it stays hidden until an admin approves it", async () => {
  const db = await database();
  await asUser(db, studentId);
  await db.query("select public.submit_student_feedback($1,$2)", ["This course really helped my typing speed a lot, thank you!", 5]);
  const { rows: publicFeedback } = await db.query("select * from public.list_approved_feedback(20)");
  assert.equal(publicFeedback.length, 0);
  await asUser(db, adminId);
  const { rows: [pending] } = await db.query("select * from public.admin_list_feedback()");
  assert.equal(pending.is_approved, false);
  assert.equal(pending.display_name, "Student One");
  await db.query("select public.admin_set_feedback_approved($1,true)", [pending.id]);
  await asUser(db, null);
  const { rows: approved } = await db.query("select * from public.list_approved_feedback(20)");
  assert.equal(approved.length, 1);
  await db.close();
});

test("feedback is rejected outside the length bounds, with an invalid rating, or without authentication", async () => {
  const db = await database();
  await asUser(db, studentId);
  await assert.rejects(db.query("select public.submit_student_feedback('too short',null)"), /between 10 and 1000/);
  await assert.rejects(db.query("select public.submit_student_feedback($1,6)", ["A perfectly valid length message here."]), /Rating must be between/);
  await asUser(db, null);
  await assert.rejects(db.query("select public.submit_student_feedback($1,null)", ["A perfectly valid length message here."]), /not authorized/);
  await db.close();
});

test("vacancy notices accept a post-wise vacancy breakdown and a useful-links table, and reject malformed shapes", async () => {
  const db = await database();
  await asUser(db, adminId);
  const breakdown = JSON.stringify([{ postName: "Commercial Cum Ticket Clerk", totalPosts: "2424", eligibility: "12th pass" }]);
  const links = JSON.stringify([{ label: "Download RRB Ajmer Result", url: "https://example.com/ajmer-result" }]);
  const { rows: [saved] } = await db.query(
    `select * from public.admin_save_vacancy_notice(null,'jobs','RRB NTPC','RRB','Summary','Open',array[]::text[],array[]::text[],array[]::text[],array[]::text[],null,null,true,0,null,$1::jsonb,$2::jsonb)`,
    [breakdown, links]
  );
  assert.equal(saved.vacancy_breakdown[0].postName, "Commercial Cum Ticket Clerk");
  assert.equal(saved.useful_links[0].url, "https://example.com/ajmer-result");

  await assert.rejects(db.query(
    `select public.admin_save_vacancy_notice(null,'jobs','Bad','','','',array[]::text[],array[]::text[],array[]::text[],array[]::text[],null,null,true,0,null,$1::jsonb,'[]'::jsonb)`,
    [JSON.stringify([{ postName: "X" }])]
  ));
  await assert.rejects(db.query(
    `select public.admin_save_vacancy_notice(null,'jobs','Bad','','','',array[]::text[],array[]::text[],array[]::text[],array[]::text[],null,null,true,0,null,'[]'::jsonb,$1::jsonb)`,
    [JSON.stringify([{ label: "X", url: "javascript:alert(1)" }])]
  ));
  await db.close();
});

test("saving a vacancy notice without the rich-detail arguments still works and defaults to empty tables", async () => {
  const db = await database();
  await asUser(db, adminId);
  const { rows: [saved] } = await db.query(
    `select * from public.admin_save_vacancy_notice(null,'results','Plain Result','','','',array[]::text[],array[]::text[],array[]::text[],array[]::text[],null,null,true,0,null)`
  );
  assert.deepEqual(saved.vacancy_breakdown, []);
  assert.deepEqual(saved.useful_links, []);
  await db.close();
});

test("vacancy notices accept any number of labeled document downloads and reject malformed entries", async () => {
  const db = await database();
  await asUser(db, adminId);
  const documents = JSON.stringify([
    { label: "Notification PDF", url: "https://example.com/notification.pdf" },
    { label: "Syllabus PDF", url: "https://example.com/syllabus.pdf" },
    { label: "Answer Key PDF", url: "https://example.com/answer-key.pdf" },
  ]);
  const { rows: [saved] } = await db.query(
    `select * from public.admin_save_vacancy_notice(null,'jobs','X','','','',array[]::text[],array[]::text[],array[]::text[],array[]::text[],null,null,true,0,null,'[]'::jsonb,'[]'::jsonb,$1::jsonb)`,
    [documents]
  );
  assert.equal(saved.notice_documents.length, 3);
  assert.equal(saved.notice_documents[1].label, "Syllabus PDF");

  await assert.rejects(db.query(
    `select public.admin_save_vacancy_notice(null,'jobs','Bad','','','',array[]::text[],array[]::text[],array[]::text[],array[]::text[],null,null,true,0,null,'[]'::jsonb,'[]'::jsonb,$1::jsonb)`,
    [JSON.stringify([{ label: "No URL" }])]
  ));
  await db.close();
});

test("saving a vacancy notice without any document arguments still works and defaults to an empty document list", async () => {
  const db = await database();
  await asUser(db, adminId);
  const { rows: [saved] } = await db.query(
    `select * from public.admin_save_vacancy_notice(null,'results','Plain','','','',array[]::text[],array[]::text[],array[]::text[],array[]::text[],null,null,true,0,null)`
  );
  assert.deepEqual(saved.notice_documents, []);
  await db.close();
});

test("the vacancy-notice-documents storage bucket is public for downloads, and only AAL2 admins may write to it", async () => {
  const db = await database();
  const { rows: [bucket] } = await db.query("select * from storage.buckets where id='vacancy-notice-documents'");
  assert.equal(bucket.public, true);
  assert.deepEqual(bucket.allowed_mime_types, ["application/pdf"]);
  const { rows: policies } = await db.query("select cmd,qual,with_check from pg_policies where tablename='objects' and schemaname='storage'");
  assert.ok(policies.some((policy) => policy.qual?.includes("is_aal2_admin") && policy.qual?.includes("vacancy-notice-documents")));
  await db.close();
});

test("a non-admin cannot moderate or delete feedback, and admin deletion permanently removes a row", async () => {
  const db = await database();
  await asUser(db, studentId);
  await db.query("select public.submit_student_feedback($1,null)", ["This is a perfectly fine piece of feedback text."]);
  await assert.rejects(db.query("select public.admin_set_feedback_approved(gen_random_uuid(),true)"), /not authorized/);
  await asUser(db, adminId);
  const { rows: [row] } = await db.query("select * from public.admin_list_feedback()");
  await db.query("select public.admin_delete_feedback($1)", [row.id]);
  const { rows: remaining } = await db.query("select * from public.admin_list_feedback()");
  assert.equal(remaining.length, 0);
  await db.close();
});
