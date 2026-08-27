import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const migrationPath = new URL("../supabase/migrations/202608270034_stenography_dictation_audio.sql", import.meta.url);

async function database() {
  const db = new PGlite();
  await db.exec(`
create role anon;create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.current_uid',true),'')::uuid$$;
create table public.profiles(id uuid primary key,role text not null default 'student');
create function public.is_aal2_admin() returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
create table public.tests(id uuid primary key,mode text,status text,visibility text,current_version_id uuid);
create table public.test_versions(id uuid primary key,test_id uuid,configuration jsonb not null default '{}'::jsonb);
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
`);
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}

test("the stenography-audio bucket is private, audio-only, and capped at 50MB", async () => {
  const db = await database();
  const { rows: [bucket] } = await db.query("select * from storage.buckets where id='stenography-audio'");
  assert.equal(bucket.public, false);
  assert.equal(bucket.file_size_limit, 52428800);
  assert.ok(bucket.allowed_mime_types.includes("audio/mpeg"));
  await db.close();
});

test("only AAL2 admins may write to the stenography-audio bucket, per the stored policy definition", async () => {
  const db = await database();
  const { rows } = await db.query("select cmd,qual,with_check from pg_policies where tablename='objects' and schemaname='storage' and policyname=$1", ["AAL2 admins manage stenography audio"]);
  assert.equal(rows.length, 1);
  assert.match(rows[0].qual, /is_aal2_admin/);
  assert.match(rows[0].qual, /stenography-audio/);
  assert.match(rows[0].with_check, /is_aal2_admin/);
  await db.close();
});

test("students may only read audio linked to a currently published, public stenography test version, per the stored policy definition", async () => {
  const db = await database();
  const { rows } = await db.query("select cmd,qual from pg_policies where tablename='objects' and schemaname='storage' and policyname=$1", ["Students read published stenography audio"]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cmd, "SELECT");
  assert.match(rows[0].qual, /status = 'published'/);
  assert.match(rows[0].qual, /visibility = 'public'/);
  assert.match(rows[0].qual, /mode = 'stenography'/);
  assert.match(rows[0].qual, /audio_path/);
  await db.close();
});

test("the migration is idempotent — re-running it does not error and keeps the bucket settings intact", async () => {
  const db = await database();
  await db.exec(await readFile(migrationPath, "utf8"));
  const { rows: [bucket] } = await db.query("select * from storage.buckets where id='stenography-audio'");
  assert.equal(bucket.public, false);
  await db.close();
});
