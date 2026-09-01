import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const baseMigrationPath = new URL("../supabase/migrations/202608160001_account_recovery.sql", import.meta.url);
const migrationPath = new URL("../supabase/migrations/202609010051_recovery_review_admin_access.sql", import.meta.url);

const adminId = "00000000-0000-4000-8000-000000000009";
const ownerAuthorityId = "00000000-0000-4000-8000-000000000010";
const studentId = "00000000-0000-4000-8000-000000000001";

async function database() {
  const db = new PGlite();
  await db.exec(`
create role anon;create role authenticated;create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.current_uid',true),'')::uuid$$;
create table public.profiles(id uuid primary key,email text,full_name text,role text not null default 'student');
create function public.is_aal2_admin() returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
insert into public.profiles(id,email,full_name,role)values('${adminId}','admin@example.com','Admin','admin');
insert into public.profiles(id,email,full_name,role)values('${ownerAuthorityId}','owner@example.com','Legacy Owner','student');
insert into public.profiles(id,email,full_name,role)values('${studentId}','student@example.com','Student','student');
`);
  await db.exec(await readFile(baseMigrationPath, "utf8"));
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}
const asUser = (db, id) => db.query("select set_config('app.current_uid',$1,false)", [id]);

async function insertRequest(db, { status = "pending", expiresInHours = 24 } = {}) {
  const { rows: [row] } = await db.query(
    `insert into public.account_recovery_requests(request_type,student_id_hint,institution_code,identifiers_hash,fingerprint_hash,status,expires_at)
     values('student','abcd','SAMRADHI-CLASSES','hash','fingerprint',$1,now()+make_interval(hours=>$2)) returning id`,
    [status, expiresInHours],
  );
  return row.id;
}

test("an ordinary student cannot review requests or list the queue", async () => {
  const db = await database();
  const id = await insertRequest(db);
  await asUser(db, studentId);
  await assert.rejects(db.query("select public.review_account_recovery($1::uuid,'approved'::public.recovery_status)", [id]), /not authorized/);
  await assert.rejects(db.query("select * from public.admin_list_recovery_requests()"), /not authorized/);
  await db.close();
});

test("the standard admin role (is_aal2_admin) can list and approve/reject, with no recovery_review_authorizations row needed", async () => {
  const db = await database();
  const id = await insertRequest(db);
  await asUser(db, adminId);
  const { rows: pending } = await db.query("select * from public.admin_list_recovery_requests()");
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, id);
  await db.query("select public.review_account_recovery($1::uuid,'approved'::public.recovery_status)", [id]);
  const { rows: [row] } = await db.query("select status,reviewed_by from public.account_recovery_requests where id=$1", [id]);
  assert.equal(row.status, "approved");
  assert.equal(row.reviewed_by, adminId);
  const { rows: audit } = await db.query("select action from public.recovery_audit_log where recovery_request_id=$1", [id]);
  assert.equal(audit[0].action, "recovery_approved");
  await db.close();
});

test("admin_list_recovery_requests defaults to pending only, and null returns every status", async () => {
  const db = await database();
  const pendingId = await insertRequest(db);
  const approvedId = await insertRequest(db, { status: "approved" });
  await asUser(db, adminId);
  const { rows: defaultRows } = await db.query("select id from public.admin_list_recovery_requests()");
  assert.deepEqual(defaultRows.map((r) => r.id), [pendingId]);
  const { rows: allRows } = await db.query("select id from public.admin_list_recovery_requests(null)");
  assert.equal(allRows.length, 2);
  assert.ok(allRows.some((r) => r.id === approvedId));
  await db.close();
});

test("the original recovery_review_authorizations path still works unchanged, for a caller who is not an admin", async () => {
  const db = await database();
  const id = await insertRequest(db);
  await db.query("insert into public.recovery_review_authorizations(user_id,authority)values($1,'institution_owner')", [ownerAuthorityId]);
  await asUser(db, ownerAuthorityId);
  await db.query("select public.review_account_recovery($1::uuid,'rejected'::public.recovery_status)", [id]);
  const { rows: [row] } = await db.query("select status from public.account_recovery_requests where id=$1", [id]);
  assert.equal(row.status, "rejected");
  await db.close();
});

test("an admin cannot approve a pending request that has already expired", async () => {
  const db = await database();
  const id = await insertRequest(db, { expiresInHours: -1 });
  await asUser(db, adminId);
  await assert.rejects(db.query("select public.review_account_recovery($1::uuid,'approved'::public.recovery_status)", [id]), /request unavailable/);
  await db.close();
});

test("a non-pending request cannot be reviewed again", async () => {
  const db = await database();
  const id = await insertRequest(db, { status: "rejected" });
  await asUser(db, adminId);
  await assert.rejects(db.query("select public.review_account_recovery($1::uuid,'approved'::public.recovery_status)", [id]), /request unavailable/);
  await db.close();
});
