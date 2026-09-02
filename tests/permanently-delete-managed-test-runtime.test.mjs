import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migrationPath = new URL("../supabase/migrations/202609010053_permanently_delete_managed_test.sql", import.meta.url);
const pdfMigrationPath = new URL("../supabase/migrations/202609020056_permanent_delete_pdf_cleanup.sql", import.meta.url);

const adminId = "00000000-0000-4000-8000-000000000009";
const studentId = "00000000-0000-4000-8000-000000000001";

async function database() {
  const db = new PGlite();
  await db.exec(`
create role anon;create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.current_uid',true),'')::uuid$$;
create table public.profiles(id uuid primary key,email text,full_name text,role text not null default 'student');
create function public.is_aal2_admin() returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
create type public.test_mode as enum ('learn','practice','exam','stenography');
create table public.tests(id uuid primary key,title text not null,mode public.test_mode not null,current_version_id uuid);
create table public.test_versions(id uuid primary key,test_id uuid not null references public.tests(id) on delete restrict,configuration jsonb);
alter table public.tests add constraint tests_current_version_fk foreign key(current_version_id) references public.test_versions(id);
create table public.test_attempts(id uuid primary key,test_id uuid not null references public.tests(id) on delete restrict,test_version_id uuid references public.test_versions(id) on delete restrict);
create table public.admin_test_audit_log(id bigint generated always as identity primary key,actor_user_id uuid not null references public.profiles(id) on delete restrict,test_id uuid references public.tests(id) on delete set null,test_version_id uuid references public.test_versions(id) on delete set null,action text not null,metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
insert into public.profiles(id,email,full_name,role)values('${adminId}','admin@example.com','Admin','admin');
insert into public.profiles(id,email,full_name,role)values('${studentId}','student@example.com','Student One','student');
`);
  await db.exec(await readFile(migrationPath, "utf8"));
  await db.exec(await readFile(pdfMigrationPath, "utf8"));
  return db;
}
const asUser = (db, id) => db.query("select set_config('app.current_uid',$1,false)", [id]);

async function seedTest(db, { title = "भारत वैश्विक मंच पर", mode = "practice", audioPath = null, pdfPath = null, attempts = 2 } = {}) {
  const testId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const configuration = { ...(audioPath ? { audio_path: audioPath } : {}), ...(pdfPath ? { pdf_path: pdfPath } : {}) };
  await db.query("insert into public.tests(id,title,mode)values($1,$2,$3)", [testId, title, mode]);
  await db.query("insert into public.test_versions(id,test_id,configuration)values($1,$2,$3)", [versionId, testId, configuration]);
  await db.query("update public.tests set current_version_id=$1 where id=$2", [versionId, testId]);
  for (let i = 0; i < attempts; i++) await db.query("insert into public.test_attempts(id,test_id,test_version_id)values($1,$2,$3)", [crypto.randomUUID(), testId, versionId]);
  return { testId, versionId };
}

test("a non-admin cannot permanently delete a test", async () => {
  const db = await database();
  const { testId } = await seedTest(db);
  await asUser(db, studentId);
  await assert.rejects(db.query("select public.permanently_delete_managed_test($1::uuid,$2,true,$3::uuid)", [testId, "भारत वैश्विक मंच पर", crypto.randomUUID()]), /AAL2 administrator required/);
  await db.close();
});

test("a mistyped title is rejected even for an admin", async () => {
  const db = await database();
  const { testId } = await seedTest(db);
  await asUser(db, adminId);
  await assert.rejects(db.query("select public.permanently_delete_managed_test($1::uuid,$2,true,$3::uuid)", [testId, "wrong title", crypto.randomUUID()]), /typed title does not match/);
  await db.close();
});

test("missing the destruction acknowledgement is rejected even with the exact title", async () => {
  const db = await database();
  const { testId } = await seedTest(db, { title: "TEST-1" });
  await asUser(db, adminId);
  await assert.rejects(db.query("select public.permanently_delete_managed_test($1::uuid,$2,false,$3::uuid)", [testId, "TEST-1", crypto.randomUUID()]), /destruction acknowledgement required/);
  await db.close();
});

test("a correct admin request permanently deletes the test, its version, and its attempts, and logs an audit event", async () => {
  const db = await database();
  const { testId, versionId } = await seedTest(db, { title: "TEST-1", attempts: 3 });
  await asUser(db, adminId);
  const { rows: [result] } = await db.query("select public.permanently_delete_managed_test($1::uuid,$2,true,$3::uuid) as result", [testId, "TEST-1", crypto.randomUUID()]);
  const payload = result.result;
  assert.equal(payload.already_deleted, false);
  assert.equal(payload.title, "TEST-1");
  assert.equal(payload.version_count, 1);
  assert.equal(payload.attempt_count, 3);
  const { rows: remainingTests } = await db.query("select id from public.tests where id=$1", [testId]);
  const { rows: remainingVersions } = await db.query("select id from public.test_versions where id=$1", [versionId]);
  const { rows: remainingAttempts } = await db.query("select id from public.test_attempts where test_id=$1", [testId]);
  assert.equal(remainingTests.length, 0);
  assert.equal(remainingVersions.length, 0);
  assert.equal(remainingAttempts.length, 0);
  const { rows: [audit] } = await db.query("select action, test_id from public.admin_test_audit_log where action='test_permanently_deleted'");
  assert.equal(audit.action, "test_permanently_deleted");
  assert.equal(audit.test_id, null); // ON DELETE SET NULL once the test row itself is gone
  await db.close();
});

test("retrying with the same request_id after the test is gone returns the same result instead of erroring", async () => {
  const db = await database();
  const { testId } = await seedTest(db, { title: "TEST-1" });
  const requestId = crypto.randomUUID();
  await asUser(db, adminId);
  await db.query("select public.permanently_delete_managed_test($1::uuid,$2,true,$3::uuid)", [testId, "TEST-1", requestId]);
  const { rows: [again] } = await db.query("select public.permanently_delete_managed_test($1::uuid,$2,true,$3::uuid) as result", [testId, "TEST-1", requestId]);
  assert.equal(again.result.already_deleted, true);
  const { rows: audits } = await db.query("select id from public.admin_test_audit_log where action='test_permanently_deleted'");
  assert.equal(audits.length, 1); // not double-logged
  await db.close();
});

test("dictation audio still referenced by another surviving test's version is marked retained_shared, not queued for removal", async () => {
  const db = await database();
  const { testId } = await seedTest(db, { title: "TEST-1", audioPath: "shared/clip.mp3", attempts: 1 });
  await seedTest(db, { title: "TEST-2 (survives)", audioPath: "shared/clip.mp3", attempts: 0 });
  await asUser(db, adminId);
  const { rows: [result] } = await db.query("select public.permanently_delete_managed_test($1::uuid,$2,true,$3::uuid) as result", [testId, "TEST-1", crypto.randomUUID()]);
  const jobs = result.result.cleanup_jobs;
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].status, "retained_shared");
  await db.close();
});

test("dictation audio used only by the deleted test is queued pending cleanup", async () => {
  const db = await database();
  const { testId } = await seedTest(db, { title: "TEST-1", audioPath: "solo/clip.mp3", attempts: 0 });
  await asUser(db, adminId);
  const { rows: [result] } = await db.query("select public.permanently_delete_managed_test($1::uuid,$2,true,$3::uuid) as result", [testId, "TEST-1", crypto.randomUUID()]);
  const jobs = result.result.cleanup_jobs;
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].status, "pending");
  assert.equal(jobs[0].bucket, "stenography-audio");
  assert.equal(jobs[0].path, "solo/clip.mp3");
  await db.close();
});

test("a question-paper PDF used only by the deleted test is counted and queued for cleanup in the managed-test-pdfs bucket", async () => {
  const db = await database();
  const { testId } = await seedTest(db, { title: "TEST-1", pdfPath: "solo/paper.pdf", attempts: 1 });
  await asUser(db, adminId);
  const { rows: [result] } = await db.query("select public.permanently_delete_managed_test($1::uuid,$2,true,$3::uuid) as result", [testId, "TEST-1", crypto.randomUUID()]);
  assert.equal(result.result.pdf_file_count, 1);
  const jobs = result.result.cleanup_jobs;
  const pdfJob = jobs.find((job) => job.bucket === "managed-test-pdfs");
  assert.ok(pdfJob);
  assert.equal(pdfJob.status, "pending");
  assert.equal(pdfJob.path, "solo/paper.pdf");
  await db.close();
});

test("a question-paper PDF still referenced by another surviving test is retained, not queued for removal", async () => {
  const db = await database();
  const { testId } = await seedTest(db, { title: "TEST-1", pdfPath: "shared/paper.pdf", attempts: 0 });
  await seedTest(db, { title: "TEST-2 (survives)", pdfPath: "shared/paper.pdf", attempts: 0 });
  await asUser(db, adminId);
  const { rows: [result] } = await db.query("select public.permanently_delete_managed_test($1::uuid,$2,true,$3::uuid) as result", [testId, "TEST-1", crypto.randomUUID()]);
  const pdfJob = result.result.cleanup_jobs.find((job) => job.bucket === "managed-test-pdfs");
  assert.ok(pdfJob);
  assert.equal(pdfJob.status, "retained_shared");
  await db.close();
});

test("a test with both audio and a PDF queues one cleanup job per bucket", async () => {
  const db = await database();
  const { testId } = await seedTest(db, { title: "TEST-1", audioPath: "solo/clip.mp3", pdfPath: "solo/paper.pdf", attempts: 0 });
  await asUser(db, adminId);
  const { rows: [result] } = await db.query("select public.permanently_delete_managed_test($1::uuid,$2,true,$3::uuid) as result", [testId, "TEST-1", crypto.randomUUID()]);
  assert.equal(result.result.audio_file_count, 1);
  assert.equal(result.result.pdf_file_count, 1);
  const buckets = result.result.cleanup_jobs.map((job) => job.bucket).sort();
  assert.deepEqual(buckets, ["managed-test-pdfs", "stenography-audio"]);
  await db.close();
});
