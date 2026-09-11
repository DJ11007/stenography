import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("PracticeNavigator gates only mode='practice' (not stenography) behind the free-test paywall, checked before resolving any specific test", async () => {
  const navigator = await read("app/typing/practice/_components/practice-navigator.tsx");
  assert.match(navigator, /if \(mode === "practice"\) \{/);
  assert.match(navigator, /supabase\.rpc\("practice_test_free_status"\)\.single\(\)/);
  assert.match(navigator, /if \(freeStatus\?\.blocked\) return <FreePracticeLimitPaywall used=\{freeStatus\.used_count\} limit=\{freeStatus\.free_limit \?\? 0\} \/>;/);
  // Checked ahead of getPracticeSelector, i.e. before resolving which test to show.
  assert.match(navigator, /if \(mode === "practice"\)[\s\S]*getPracticeSelector/);
});

test("the paywall reuses the existing Buy Now button (which already links to /courses), not a new purchase flow", async () => {
  const paywall = await read("app/typing/practice/_components/free-limit-paywall.tsx");
  assert.match(paywall, /import \{ BuyNowButton \} from "\.\.\/\.\.\/\.\.\/_components\/buy-now-button";/);
  assert.match(paywall, /<BuyNowButton \/>/);
});

test("recordManagedAttempt has a server-side backstop for the free-practice limit, scoped to mode='practice' only", async () => {
  const actions = await read("app/tests/actions.ts");
  assert.match(actions, /v\.mode === "practice" \? supabase\.rpc\("assert_practice_test_allowed"\) : Promise\.resolve\(null\)/);
  assert.match(actions, /if \(v\.mode === "practice" && practiceLimitResult\?\.error\) return \{ status: "locked" as const \};/);
});

test("an admin can set a student's free-practice-test limit from the student detail page", async () => {
  const controls = await read("app/admin/students/student-access-controls.tsx");
  assert.match(controls, /import \{ clearStudentAccessPackage, setStudentAccessLocked, setStudentAccessPackage, setStudentClassInfo, setStudentFreeExamLimit, setStudentFreePracticeLimit, setStudentPassword, type StudentActionState \} from "\.\/actions"/);
  assert.match(controls, /useActionState\(setStudentFreePracticeLimit, initial\)/);
  assert.match(controls, /name="freePracticeLimit"/);

  const actions = await read("app/admin/students/actions.ts");
  assert.match(actions, /export async function setStudentFreePracticeLimit/);
  assert.match(actions, /admin_set_practice_free_limit/);

  const detail = await read("app/admin/students/[id]/page.tsx");
  assert.match(detail, /select\("id,email,full_name,phone,role,is_active,approved,created_at,class_info,free_practice_test_limit,free_exam_test_limit"\)/);
  assert.match(detail, /freePracticeLimit=\{student\.free_practice_test_limit\}/);
});

test("a fresh migration adds the free-practice-limit column and its three RPCs, following the established is_aal2_admin/self-or-admin conventions", async () => {
  const migration = await read("supabase/migrations/202609010052_practice_free_test_limit.sql");
  assert.match(migration, /alter table public\.profiles add column if not exists free_practice_test_limit integer default 50;/);
  assert.match(migration, /create or replace function public\.practice_test_free_status\(p_student_id uuid default auth\.uid\(\)\)/);
  assert.match(migration, /if p_student_id <> auth\.uid\(\) and not public\.is_aal2_admin\(\) then raise exception 'not authorized'; end if;/);
  assert.match(migration, /create or replace function public\.assert_practice_test_allowed\(p_student_id uuid default auth\.uid\(\)\)/);
  assert.match(migration, /create or replace function public\.admin_set_practice_free_limit\(p_student_id uuid, p_limit integer\)/);
  assert.match(migration, /revoke all on function public\.practice_test_free_status\(uuid\), public\.assert_practice_test_allowed\(uuid\), public\.admin_set_practice_free_limit\(uuid,integer\) from public, anon;/);
});
