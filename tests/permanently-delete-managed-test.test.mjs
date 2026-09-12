import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the migration creates an AAL2-only idempotent permanent-delete RPC for the general tests table, with dedicated audit + storage-cleanup tables", async () => {
  const migration = await read("supabase/migrations/202609010053_permanently_delete_managed_test.sql");
  assert.match(migration, /create or replace function public\.permanently_delete_managed_test/);
  assert.match(migration, /if not public\.is_aal2_admin\(\) then raise exception 'AAL2 administrator required'/);
  assert.match(migration, /request_id uuid not null unique/);
  assert.match(migration, /deleted_test_id uuid not null unique/);
  assert.match(migration, /already_deleted', true/);
  assert.match(migration, /for update/);
  assert.match(migration, /security definer set search_path = pg_catalog, public/);
  assert.match(migration, /p_typed_title is distinct from t\.title/);
  assert.match(migration, /p_acknowledged is distinct from true/);
  assert.match(migration, /revoke all on function public\.permanently_delete_managed_test\(uuid,text,boolean,uuid\) from public, anon/);
});

test("deletion happens in FK-safe order: attempts, then null current_version_id, then versions, then the test itself", async () => {
  const migration = await read("supabase/migrations/202609010053_permanently_delete_managed_test.sql");
  const ordered = ["delete from public.test_attempts where test_id = t.id", "update public.tests set current_version_id = null where id = t.id", "delete from public.test_versions where test_id = t.id", "delete from public.tests where id = t.id"];
  let cursor = -1;
  for (const statement of ordered) { const next = migration.indexOf(statement); assert.ok(next > cursor, `${statement} must follow FK order`); cursor = next; }
});

test("dictation audio storage cleanup is scoped to the stenography-audio bucket only, and shared references are retained not deleted", async () => {
  const migration = await read("supabase/migrations/202609010053_permanently_delete_managed_test.sql");
  assert.match(migration, /bucket_id in\('stenography-audio'\)/);
  assert.match(migration, /surviving\.test_id <> t\.id/);
  assert.match(migration, /then 'retained_shared' else 'pending' end/);
  assert.doesNotMatch(migration, /delete from storage\.objects/);
});

test("a unified admin_test_audit_log row is written for the permanent deletion, matching this table's existing lifecycle-event pattern", async () => {
  const migration = await read("supabase/migrations/202609010053_permanently_delete_managed_test.sql");
  assert.match(migration, /insert into public\.admin_test_audit_log\(actor_user_id, test_id, action, metadata\) values \(auth\.uid\(\), t\.id, 'test_permanently_deleted'/);
});

test("the server action requires the typed title and acknowledgement, and cleans up dictation audio best-effort after deletion", async () => {
  const actions = await read("app/admin/tests/actions.ts");
  assert.match(actions, /export async function permanentlyDeleteManagedTest/);
  assert.match(actions, /formData\.get\("destroyAcknowledged"\) !== "on"/);
  assert.match(actions, /permanently_delete_managed_test/);
  assert.match(actions, /processTestCleanupJob/);
  assert.match(actions, /safeBucket = job\.bucket === "stenography-audio"/);
});

test("the danger zone requires typing the exact title and ticking the acknowledgement before the destructive button is enabled", async () => {
  const danger = await read("app/admin/tests/permanent-delete-danger-zone.tsx");
  assert.match(danger, /const valid = typed === title && acknowledged;/);
  assert.match(danger, /disabled=\{!valid \|\| pending\}/);
  assert.match(danger, /permanentlyDeleteManagedTest/);
});

test("TestRow keeps the quick Delete button disabled for a test with attempts, and offers the permanent-delete danger zone instead", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /<button disabled=\{test\.attempts>0\} title=\{test\.attempts>0\?"Has attempts -- use Permanently delete below instead":"Delete"\}[\s\S]*?>🗑<\/button>/);
  assert.match(manager, /\{test\.attempts>0 && <PermanentDeleteDangerZone testId=\{test\.id\} title=\{test\.title\} attemptCount=\{test\.attempts\}\/>\}/);
});
