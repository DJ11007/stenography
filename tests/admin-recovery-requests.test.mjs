import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the recovery request form no longer asks students to guess an institution code, and relabels Student ID", async () => {
  const form = await read("app/recover-account/recovery-request-form.tsx");
  assert.doesNotMatch(form, /institutionCode/);
  assert.doesNotMatch(form, /Institution code/);
  assert.match(form, /Full name \(as registered with us\)/);
});

test("the server action fills a fixed institution code instead of reading one from the form", async () => {
  const actions = await read("app/recover-account/actions.ts");
  assert.match(actions, /const SINGLE_INSTITUTION_CODE = "SAMRADHI-CLASSES";/);
  assert.doesNotMatch(actions, /formData\.get\("institutionCode"\)/);
  assert.match(actions, /const institutionCode = SINGLE_INSTITUTION_CODE;/);
});

test("the admin recovery-requests page lists requests via the new RPC and is linked from the admin dashboard", async () => {
  const [page, dashboard] = await Promise.all([
    read("app/admin/recovery-requests/page.tsx"),
    read("app/admin/page.tsx"),
  ]);
  assert.match(page, /await requireAdmin\(\);/);
  assert.match(page, /supabase\.rpc\("admin_list_recovery_requests", \{ p_status: null \}\)/);
  assert.match(dashboard, /\/admin\/recovery-requests/);
});

test("reviewing a request calls review_account_recovery and is admin-gated", async () => {
  const actions = await read("app/admin/recovery-requests/actions.ts");
  assert.match(actions, /export async function reviewRecoveryRequest/);
  assert.match(actions, /await requireAdmin\(\);/);
  assert.match(actions, /supabase\.rpc\("review_account_recovery", \{ p_request_id: requestId, p_decision: decision, p_target_user_id: null \}\)/);
});

test("a fresh migration lets the standard admin role review recovery requests and list the queue, without removing the original authorization-table path", async () => {
  const migration = await read("supabase/migrations/202609010051_recovery_review_admin_access.sql");
  assert.match(migration, /public\.is_aal2_admin\(\)\s*\n\s*or exists \(/);
  assert.match(migration, /create or replace function public\.admin_list_recovery_requests\(p_status public\.recovery_status default 'pending'\)/);
  assert.match(migration, /revoke all on function public\.admin_list_recovery_requests\(public\.recovery_status\) from public, anon;/);
  assert.match(migration, /grant execute on function public\.admin_list_recovery_requests\(public\.recovery_status\) to authenticated;/);
});
