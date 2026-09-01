import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const migrationPath = new URL("../supabase/migrations/202608310050_student_class_info.sql", import.meta.url);

const studentId = "00000000-0000-4000-8000-000000000001";
const adminId = "00000000-0000-4000-8000-000000000009";

async function database() {
  const db = new PGlite();
  await db.exec(`
create role anon;create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.current_uid',true),'')::uuid$$;
create table public.profiles(id uuid primary key,email text,full_name text,role text not null default 'student',is_active boolean not null default true,updated_at timestamptz not null default now());
create function public.is_aal2_admin() returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
insert into public.profiles(id,email,full_name,role)values('${adminId}','admin@example.com','Admin','admin');
insert into public.profiles(id,email,full_name,role)values('${studentId}','student@example.com','Student One','student');
`);
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}
const asUser = (db, id) => db.query("select set_config('app.current_uid',$1,false)", [id]);

test("class_info is null by default", async () => {
  const db = await database();
  const { rows: [row] } = await db.query("select class_info from public.profiles where id=$1", [studentId]);
  assert.equal(row.class_info, null);
  await db.close();
});

test("an admin can set a student's class info label", async () => {
  const db = await database();
  await asUser(db, adminId);
  await db.query("select public.admin_set_student_class_info($1::uuid,$2::text)", [studentId, "LDC Batch 2"]);
  const { rows: [row] } = await db.query("select class_info from public.profiles where id=$1", [studentId]);
  assert.equal(row.class_info, "LDC Batch 2");
  await db.close();
});

test("a blank/whitespace-only value clears the label to null", async () => {
  const db = await database();
  await asUser(db, adminId);
  await db.query("select public.admin_set_student_class_info($1::uuid,$2::text)", [studentId, "LDC"]);
  await db.query("select public.admin_set_student_class_info($1::uuid,$2::text)", [studentId, "   "]);
  const { rows: [row] } = await db.query("select class_info from public.profiles where id=$1", [studentId]);
  assert.equal(row.class_info, null);
  await db.close();
});

test("leading/trailing whitespace in a real label is trimmed", async () => {
  const db = await database();
  await asUser(db, adminId);
  await db.query("select public.admin_set_student_class_info($1::uuid,$2::text)", [studentId, "  RHC  "]);
  const { rows: [row] } = await db.query("select class_info from public.profiles where id=$1", [studentId]);
  assert.equal(row.class_info, "RHC");
  await db.close();
});

test("a non-admin cannot set another student's class info", async () => {
  const db = await database();
  await asUser(db, studentId);
  await assert.rejects(db.query("select public.admin_set_student_class_info($1::uuid,$2::text)", [studentId, "LDC"]), /not authorized/);
  await db.close();
});

test("setting class info for a non-existent student raises", async () => {
  const db = await database();
  await asUser(db, adminId);
  await assert.rejects(db.query("select public.admin_set_student_class_info($1::uuid,$2::text)", ["00000000-0000-4000-8000-000000009999", "LDC"]), /student not found/);
  await db.close();
});
