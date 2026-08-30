import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migrationPath = new URL("../supabase/migrations/202608290041_efficiency_working_matter_original_files.sql", import.meta.url);

async function database() {
  const db = new PGlite();
  await db.exec(`
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create role anon;create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
create function public.is_aal2_admin() returns boolean language sql stable as $$select false$$;
create table public.word_efficiency_versions(id uuid primary key,working_matter_snapshot jsonb);
create table public.word_efficiency_attempts(student_id uuid,version_id uuid);
create table public.excel_efficiency_versions(id uuid primary key,working_matter_snapshot jsonb);
create table public.excel_efficiency_attempts(student_id uuid,version_id uuid);
`);
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}

test("both working-matter buckets are created private, 10MB, with the correct single allowed MIME type each", async () => {
  const db = await database();
  const { rows } = await db.query("select id,public,file_size_limit,allowed_mime_types from storage.buckets order by id");
  assert.equal(rows.length, 2);
  const word = rows.find((row) => row.id === "word-efficiency-working-matter");
  const excel = rows.find((row) => row.id === "excel-efficiency-working-matter");
  assert.ok(word && excel);
  for (const bucket of [word, excel]) {
    assert.equal(bucket.public, false);
    assert.equal(Number(bucket.file_size_limit), 10485760);
  }
  assert.deepEqual(word.allowed_mime_types, ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
  assert.deepEqual(excel.allowed_mime_types, ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
  await db.close();
});

test("admin-manage policies exist and are scoped to their own bucket, for both Word and Excel", async () => {
  const db = await database();
  const { rows } = await db.query("select policyname,cmd,qual from pg_policies where tablename='objects' and schemaname='storage' order by policyname");
  const names = rows.map((row) => row.policyname);
  assert.ok(names.includes("AAL2 admins manage Word working matter files"));
  assert.ok(names.includes("AAL2 admins manage Excel working matter files"));
  const wordAdmin = rows.find((row) => row.policyname === "AAL2 admins manage Word working matter files");
  assert.match(wordAdmin.qual, /word-efficiency-working-matter/);
  assert.match(wordAdmin.qual, /is_aal2_admin/);
  await db.close();
});

test("student read policies exist for both subjects and reference the matching attempts/version tables", async () => {
  const db = await database();
  const { rows } = await db.query("select policyname,cmd,qual from pg_policies where tablename='objects' and schemaname='storage' order by policyname");
  const wordRead = rows.find((row) => row.policyname === "Students read their assigned Word working matter file");
  const excelRead = rows.find((row) => row.policyname === "Students read their assigned Excel working matter file");
  assert.ok(wordRead && excelRead);
  assert.equal(wordRead.cmd, "SELECT");
  assert.match(wordRead.qual, /word_efficiency_attempts/);
  assert.match(wordRead.qual, /word_efficiency_versions/);
  assert.match(excelRead.qual, /excel_efficiency_attempts/);
  assert.match(excelRead.qual, /excel_efficiency_versions/);
  await db.close();
});

test("re-applying just the bucket upsert (the idempotent on-conflict part of the migration) does not create duplicate rows", async () => {
  const db = await database();
  await db.exec(`
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('word-efficiency-working-matter','word-efficiency-working-matter',false,10485760,array['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
`);
  const { rows } = await db.query("select count(*)::int as count from storage.buckets");
  assert.equal(rows[0].count, 2);
  await db.close();
});
