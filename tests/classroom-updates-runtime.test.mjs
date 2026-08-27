import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const migrationPath = new URL("../supabase/migrations/202608270035_classroom_updates.sql", import.meta.url);

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

test("a fresh database starts with an inactive, empty live class row and no updates", async () => {
  const db = await database();
  const { rows: [link] } = await db.query("select * from public.get_live_class_link()");
  assert.equal(link.is_active, false);
  assert.equal(link.url, null);
  const { rows } = await db.query("select * from public.list_published_classroom_updates(20)");
  assert.equal(rows.length, 0);
  await db.close();
});

test("only aal2 admins can post, edit, or delete classroom updates, and unpublished ones stay hidden from students", async () => {
  const db = await database();
  await asUser(db, studentId);
  await assert.rejects(db.query("select public.admin_save_classroom_update(null,'X','',true,0)"), /not authorized/);
  await asUser(db, adminId);
  const { rows: [saved] } = await db.query("select * from public.admin_save_classroom_update(null,'Welcome','Class starts Monday',true,0)");
  const { rows: [draft] } = await db.query("select * from public.admin_save_classroom_update(null,'Draft','shh',false,1)");
  await asUser(db, null);
  const { rows: publicRows } = await db.query("select * from public.list_published_classroom_updates(20)");
  assert.equal(publicRows.length, 1);
  assert.equal(publicRows[0].id, saved.id);
  await asUser(db, adminId);
  const { rows: adminRows } = await db.query("select * from public.admin_list_classroom_updates()");
  assert.equal(adminRows.length, 2);
  await db.query("select public.admin_delete_classroom_update($1)", [draft.id]);
  const { rows: afterDelete } = await db.query("select * from public.admin_list_classroom_updates()");
  assert.equal(afterDelete.length, 1);
  await db.close();
});

test("only aal2 admins can set the live class link, and activating it requires a valid http(s) URL", async () => {
  const db = await database();
  await asUser(db, studentId);
  await assert.rejects(db.query("select public.admin_set_live_class_link('https://meet.example.com/class',true)"), /not authorized/);
  await asUser(db, adminId);
  await assert.rejects(db.query("select public.admin_set_live_class_link(null,true)"), /valid http/);
  await assert.rejects(db.query("select public.admin_set_live_class_link('javascript:alert(1)',true)"), /valid http/);
  const { rows: [set] } = await db.query("select * from public.admin_set_live_class_link('https://meet.example.com/class',true)");
  assert.equal(set.is_active, true);
  assert.equal(set.url, "https://meet.example.com/class");
  await asUser(db, null);
  const { rows: [link] } = await db.query("select * from public.get_live_class_link()");
  assert.equal(link.is_active, true);
  assert.equal(link.url, "https://meet.example.com/class");
  await db.close();
});

test("deactivating the live class can clear the URL without requiring a valid link", async () => {
  const db = await database();
  await asUser(db, adminId);
  await db.query("select public.admin_set_live_class_link('https://meet.example.com/class',true)");
  const { rows: [cleared] } = await db.query("select * from public.admin_set_live_class_link(null,false)");
  assert.equal(cleared.is_active, false);
  assert.equal(cleared.url, null);
  await db.close();
});
