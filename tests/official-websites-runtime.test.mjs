import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const migrationPath = new URL("../supabase/migrations/202608260032_official_websites.sql", import.meta.url);

const adminId = "00000000-0000-4000-8000-000000000009";
const studentId = "00000000-0000-4000-8000-000000000001";

async function database() {
  const db = new PGlite();
  await db.exec(`
create role anon;create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.current_uid',true),'')::uuid$$;
create table public.profiles(id uuid primary key,role text not null default 'student');
create function public.is_aal2_admin() returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
insert into auth.users(id) values ('${adminId}'),('${studentId}');
insert into public.profiles(id,role)values('${adminId}','admin'),('${studentId}','student');
`);
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}
const asUser = (db, id) => db.query("select set_config('app.current_uid',$1,false)", [id ?? ""]);

test("admin can add an official website and the public listing shows only published ones", async () => {
  const db = await database();
  await asUser(db, adminId);
  await db.query("select public.admin_save_official_website(null,'RSSB','https://rssb.rajasthan.gov.in','Rajasthan Staff Selection Board',true,0)");
  await db.query("select public.admin_save_official_website(null,'Draft Board','https://example.com','',false,1)");
  await asUser(db, null);
  const { rows } = await db.query("select * from public.list_published_official_websites()");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "RSSB");
  await db.close();
});

test("a non-admin cannot add, edit, or delete an official website", async () => {
  const db = await database();
  await asUser(db, studentId);
  await assert.rejects(db.query("select public.admin_save_official_website(null,'X','https://example.com','',true,0)"), /not authorized/);
  await assert.rejects(db.query("select public.admin_delete_official_website(gen_random_uuid())"), /not authorized/);
  await db.close();
});

test("a website link must start with http:// or https://", async () => {
  const db = await database();
  await asUser(db, adminId);
  await assert.rejects(db.query("select public.admin_save_official_website(null,'X','javascript:alert(1)','',true,0)"), /must start with/);
  await assert.rejects(db.query("select public.admin_save_official_website(null,'','https://example.com','',true,0)"), /Name is required/);
  await db.close();
});

test("admin can edit and delete an existing official website", async () => {
  const db = await database();
  await asUser(db, adminId);
  const { rows: [saved] } = await db.query("select * from public.admin_save_official_website(null,'SSC','https://ssc.nic.in','',true,0)");
  await db.query("select public.admin_save_official_website($1,'SSC (updated)','https://ssc.nic.in','Staff Selection Commission',true,0)", [saved.id]);
  const { rows: [updated] } = await db.query("select * from public.admin_list_official_websites()");
  assert.equal(updated.name, "SSC (updated)");
  await db.query("select public.admin_delete_official_website($1)", [saved.id]);
  const { rows: remaining } = await db.query("select * from public.admin_list_official_websites()");
  assert.equal(remaining.length, 0);
  await db.close();
});
