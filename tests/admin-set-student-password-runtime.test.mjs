import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migrationPath = new URL("../supabase/migrations/202609101445_admin_set_student_password.sql", import.meta.url);

const studentId = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
const adminId = "00000000-0000-4000-8000-000000000009";

async function database() {
  const db = new PGlite();
  await db.exec(`
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.current_uid', true), '')::uuid $$;
create table auth.users(id uuid primary key, encrypted_password text, updated_at timestamptz default now());
create table auth.sessions(id uuid primary key default gen_random_uuid(), user_id uuid);
create table auth.refresh_tokens(id bigserial primary key, user_id text);
create table public.profiles(id uuid primary key, role text not null default 'student');
create function public.is_aal2_admin() returns boolean language sql stable as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;
-- pgcrypto stand-ins: the real project has extensions.crypt / extensions.gen_salt.
create function public.gen_salt(text, integer) returns text language sql as $$ select 'salt' $$;
create function public.crypt(text, text) returns text language sql as $$ select 'bcrypt(' || $1 || ',' || $2 || ')' $$;
insert into public.profiles(id, role) values ('${adminId}', 'admin'), ('${studentId}', 'student'), ('${otherId}', 'student');
insert into auth.users(id, encrypted_password) values ('${studentId}', 'old-hash'), ('${otherId}', 'other-old'), ('${adminId}', 'admin-hash');
insert into auth.sessions(id, user_id) values (gen_random_uuid(), '${studentId}'), (gen_random_uuid(), '${otherId}');
insert into auth.refresh_tokens(user_id) values ('${studentId}'), ('${otherId}');
`);
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}
const asUser = (db, id) => db.query("select set_config('app.current_uid', $1, false)", [id]);

test("admin_set_student_password writes a fresh hash and clears only that user's sessions/tokens", async () => {
  const db = await database();
  await asUser(db, adminId);
  await db.query("select public.admin_set_student_password($1::uuid, $2)", [studentId, "brand-new-pass"]);

  const { rows: [target] } = await db.query("select encrypted_password from auth.users where id = $1", [studentId]);
  assert.equal(target.encrypted_password, "bcrypt(brand-new-pass,salt)");

  const { rows: [other] } = await db.query("select encrypted_password from auth.users where id = $1", [otherId]);
  assert.equal(other.encrypted_password, "other-old");

  const { rows: sessions } = await db.query("select user_id from auth.sessions");
  assert.deepEqual(sessions.map((r) => r.user_id), [otherId]);
  const { rows: tokens } = await db.query("select user_id from auth.refresh_tokens");
  assert.deepEqual(tokens.map((r) => r.user_id), [otherId]);
  await db.close();
});

test("admin_set_student_password refuses a non-admin caller", async () => {
  const db = await database();
  await asUser(db, studentId);
  await assert.rejects(
    () => db.query("select public.admin_set_student_password($1::uuid, $2)", [otherId, "brand-new-pass"]),
    /not authorized/,
  );
  const { rows: [row] } = await db.query("select encrypted_password from auth.users where id = $1", [otherId]);
  assert.equal(row.encrypted_password, "other-old");
  await db.close();
});

test("admin_set_student_password enforces the 8-character minimum", async () => {
  const db = await database();
  await asUser(db, adminId);
  await assert.rejects(
    () => db.query("select public.admin_set_student_password($1::uuid, $2)", [studentId, "short"]),
    /at least 8 characters/,
  );
  await db.close();
});

test("admin_set_student_password raises when the user id does not exist", async () => {
  const db = await database();
  await asUser(db, adminId);
  await assert.rejects(
    () => db.query("select public.admin_set_student_password($1::uuid, $2)", ["00000000-0000-4000-8000-0000000000ff", "brand-new-pass"]),
    /user not found/,
  );
  await db.close();
});

test("admin_set_student_password is executable by authenticated but not anon", async () => {
  const db = await database();
  const { rows } = await db.query(`
    select has_function_privilege('authenticated', 'public.admin_set_student_password(uuid, text)', 'execute') as auth_ok,
           has_function_privilege('anon', 'public.admin_set_student_password(uuid, text)', 'execute') as anon_ok
  `);
  assert.equal(rows[0].auth_ok, true);
  assert.equal(rows[0].anon_ok, false);
  await db.close();
});
