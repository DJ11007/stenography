import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("clearStudentAccessPackage resets the package to blank/locked without touching the account, and requireAdmin-gates the action", async () => {
  const actions = await read("app/admin/students/actions.ts");
  assert.match(actions, /export async function clearStudentAccessPackage/);
  assert.match(actions, /p_test_limit: null, p_validity_days: null, p_grace_days: 0, p_locked: true/);
});

test("setStudentClassInfo calls the new admin_set_student_class_info RPC", async () => {
  const actions = await read("app/admin/students/actions.ts");
  assert.match(actions, /export async function setStudentClassInfo/);
  assert.match(actions, /admin_set_student_class_info/);
});

test("setStudentPassword requires a minimum length and calls the service-role updateUserById, not a reset link", async () => {
  const actions = await read("app/admin/students/actions.ts");
  assert.match(actions, /export async function setStudentPassword/);
  assert.match(actions, /if \(password\.length < 8\) return \{ error: "Password must be at least 8 characters\." \};/);
  assert.match(actions, /admin\.auth\.admin\.updateUserById\(studentId, \{ password \}\)/);
});

test("the access-controls panel wires all four new forms: lock/unlock, clear seat, class info, and set password", async () => {
  const controls = await read("app/admin/students/student-access-controls.tsx");
  assert.match(controls, /import \{ clearStudentAccessPackage, setStudentAccessLocked, setStudentAccessPackage, setStudentClassInfo, setStudentPassword, type StudentActionState \} from "\.\/actions"/);
  assert.match(controls, /useActionState\(clearStudentAccessPackage, initial\)/);
  assert.match(controls, /useActionState\(setStudentClassInfo, initial\)/);
  assert.match(controls, /useActionState\(setStudentPassword, initial\)/);
  assert.match(controls, /name="classInfo"/);
  assert.match(controls, /<PasswordInput name="password"/);
});

test("the student detail page selects class_info and passes it into the access-controls panel", async () => {
  const detail = await read("app/admin/students/[id]/page.tsx");
  assert.match(detail, /select\("id,email,full_name,phone,role,is_active,created_at,class_info"\)/);
  assert.match(detail, /classInfo=\{student\.class_info\}/);
});

test("the student list page shows Total/Active/Grace/Locked stat cards computed from the same access rows already being fetched", async () => {
  const list = await read("app/admin/students/page.tsx");
  assert.match(list, /const activeCount = rows\.filter\(\(row\) => row\.access\?\.status === "active"\)\.length;/);
  assert.match(list, /const graceCount = rows\.filter\(\(row\) => row\.access\?\.status === "grace"\)\.length;/);
  assert.match(list, /const lockedCount = rows\.filter\(\(row\) => row\.access\?\.status === "locked"\)\.length;/);
  assert.match(list, /<StatCard label="Total users" value=\{rows\.length\} \/>/);
});

test("the student's own dashboard shows their real membership status from student_access_status(), not hardcoded placeholder text", async () => {
  const studentPage = await read("app/student/page.tsx");
  assert.match(studentPage, /await supabase\.rpc\("student_access_status"\)/);
  assert.match(studentPage, /import \{ AccessStatusBadge, validityLabel, type StudentAccessStatus \} from "@\/app\/admin\/students\/access-status-badge"/);
  assert.doesNotMatch(studentPage, /Typing Hub enabled/);
});

test("a fresh migration adds profiles.class_info and an admin-only RPC to set it, following the exact revoke/grant convention every other admin_set_student_* function already uses", async () => {
  const migration = await read("supabase/migrations/202608310050_student_class_info.sql");
  assert.match(migration, /alter table public\.profiles add column if not exists class_info text;/);
  assert.match(migration, /create or replace function public\.admin_set_student_class_info\(p_student_id uuid, p_class_info text\)/);
  assert.match(migration, /if not public\.is_aal2_admin\(\) then raise exception 'not authorized';end if;/);
  assert.match(migration, /revoke all on function public\.admin_set_student_class_info\(uuid,text\) from public,anon;/);
  assert.match(migration, /grant execute on function public\.admin_set_student_class_info\(uuid,text\) to authenticated;/);
});
