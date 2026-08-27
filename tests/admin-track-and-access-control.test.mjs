import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Track dashboard shows daily stats, search, and per-student status/validity", async () => {
  const track = await read("app/admin/track/page.tsx");
  assert.match(track, /admin_list_student_access/);
  assert.match(track, /Test given today/);
  assert.match(track, /No test today/);
  assert.match(track, /Tracking date/);
  assert.match(track, /<AccessStatusBadge access={row}/);
  assert.match(track, /validityLabel\(row\)/);
});

test("Students pages surface test access status, validity, and a management control form, not just profile/auth info", async () => {
  const [listPage, detailPage, controls, actions] = await Promise.all([
    read("app/admin/students/page.tsx"),
    read("app/admin/students/[id]/page.tsx"),
    read("app/admin/students/student-access-controls.tsx"),
    read("app/admin/students/actions.ts"),
  ]);
  assert.match(listPage, /admin_list_student_access/);
  assert.match(listPage, /Test access/);
  assert.match(detailPage, /student_access_status/);
  assert.match(detailPage, /<StudentAccessControls/);
  assert.match(controls, /Test limit/);
  assert.match(controls, /Validity \(days from now\)/);
  assert.match(controls, /Grace period/);
  assert.match(controls, /Lock test access|Unlock test access/);
  assert.match(actions, /admin_set_student_access/);
  assert.match(actions, /admin_set_student_locked/);
});

test("recordManagedAttempt and prepare_word_efficiency_attempt both enforce the shared access-control gate", async () => {
  const [testsActions, gateMigration] = await Promise.all([
    read("app/tests/actions.ts"),
    read("supabase/migrations/202608260029_word_efficiency_access_control_gate.sql"),
  ]);
  assert.match(testsActions, /assert_student_access_allowed/);
  assert.match(testsActions, /status: "locked" as const/);
  assert.match(gateMigration, /perform public\.assert_student_access_allowed\(\);/);
});

test("new students default to unlimited and unlocked access -- the access-control migration never bulk-restricts existing students by default", async () => {
  const migration = await read("supabase/migrations/202608260028_student_access_control.sql");
  assert.match(migration, /add column if not exists test_limit integer;/);
  assert.match(migration, /add column if not exists validity_expires_at timestamptz;/);
  assert.match(migration, /access_locked boolean not null default false/);
  assert.match(migration, /grace_days integer not null default 0/);
  // The only two places that ever write test_limit/access_locked are the admin-invoked,
  // is_aal2_admin()-gated functions -- there is no unconditional backfill UPDATE run as
  // part of applying this migration that would restrict students who already exist.
  const withoutFunctionBodies = migration.replace(/\$\$[\s\S]*?\$\$/g, "");
  assert.doesNotMatch(withoutFunctionBodies, /update\s+public\.profiles/i);
});
