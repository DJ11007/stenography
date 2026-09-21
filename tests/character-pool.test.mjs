import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrationPath = new URL("../supabase/migrations/202609211600_character_pool_config.sql", import.meta.url);
const adminId = "00000000-0000-4000-8000-000000000009";
const studentId = "00000000-0000-4000-8000-000000000001";

async function database() {
  const db = new PGlite();
  await db.exec(`
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.current_uid', true), '')::uuid $$;
create table auth.users(id uuid primary key);
create table public.profiles(id uuid primary key, role text default 'student', full_name text);
create function public.is_aal2_admin() returns boolean language sql stable as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
insert into auth.users values ('${adminId}'), ('${studentId}');
insert into public.profiles values ('${adminId}','admin','Admin'), ('${studentId}','student','Student');
`);
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}
const asUser = (db, id) => db.query("select set_config('app.current_uid', $1, false)", [id]);

test("an unconfigured language returns null (not an empty array), so callers fall back to the default full keyboard", async () => {
  const db = await database();
  const { rows } = await db.query("select public.get_character_pool_config('hindi') c");
  assert.equal(rows[0].c, null);
  await db.close();
});

test("an admin can narrow a language's enabled keys, and get_character_pool_config then returns exactly that set", async () => {
  const db = await database();
  await asUser(db, adminId);
  await db.query("select public.admin_save_character_pool_config('english', array['a','s','d','f'])");
  const { rows } = await db.query("select public.get_character_pool_config('english') c");
  assert.deepEqual(rows[0].c, ["a", "s", "d", "f"]);
  await db.close();
});

test("clearing a language's enabled keys back to an empty array reverts get_character_pool_config to null (the default fallback)", async () => {
  const db = await database();
  await asUser(db, adminId);
  await db.query("select public.admin_save_character_pool_config('english', array['a','s'])");
  await db.query("select public.admin_save_character_pool_config('english', array[]::text[])");
  const { rows } = await db.query("select public.get_character_pool_config('english') c");
  assert.equal(rows[0].c, null);
  await db.close();
});

test("saving twice for the same language updates the row in place (one row per language), not a duplicate", async () => {
  const db = await database();
  await asUser(db, adminId);
  await db.query("select public.admin_save_character_pool_config('hindi', array['d','j'])");
  await db.query("select public.admin_save_character_pool_config('hindi', array['d','j','k'])");
  const { rows } = await db.query("select count(*)::int c from public.character_pool_config where language='hindi'");
  assert.equal(rows[0].c, 1);
  const { rows: [current] } = await db.query("select public.get_character_pool_config('hindi') c");
  assert.deepEqual(current.c, ["d", "j", "k"]);
  await db.close();
});

test("a student cannot save or list the config; only an admin can", async () => {
  const db = await database();
  await asUser(db, studentId);
  await assert.rejects(() => db.query("select public.admin_save_character_pool_config('english', array['a'])"));
  await assert.rejects(() => db.query("select public.admin_list_character_pool_config()"));
  await db.close();
});

test("an invalid language is rejected", async () => {
  const db = await database();
  await asUser(db, adminId);
  await assert.rejects(() => db.query("select public.admin_save_character_pool_config('french', array['a'])"));
  await db.close();
});

test("the migration is idempotent -- re-running it does not error and keeps existing config intact", async () => {
  const db = await database();
  await asUser(db, adminId);
  await db.query("select public.admin_save_character_pool_config('english', array['a','s'])");
  await db.exec(await readFile(migrationPath, "utf8"));
  const { rows } = await db.query("select public.get_character_pool_config('english') c");
  assert.deepEqual(rows[0].c, ["a", "s"]);
  await db.close();
});
