import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("/tests/[slug] gates a non-live mode='exam' test behind the free-exam paywall, checked before the exam workspace renders", async () => {
  const page = await read("app/tests/[slug]/page.tsx");
  assert.match(page, /test\.mode==="exam"&&!test\.is_live\?supabase\.rpc\("exam_test_free_status"\)\.single\(\)/);
  assert.match(page, /if\(examFreeStatus\.data\?\.blocked\)return <FreeExamLimitPaywall used=\{examFreeStatus\.data\.used_count\} limit=\{examFreeStatus\.data\.free_limit\?\?0\}\/>;/);
});

test("the exam paywall reuses the existing Buy Now button, not a new purchase flow", async () => {
  const paywall = await read("app/typing/exams/_components/free-exam-limit-paywall.tsx");
  assert.match(paywall, /import \{ BuyNowButton \} from "\.\.\/\.\.\/\.\.\/_components\/buy-now-button";/);
  assert.match(paywall, /<BuyNowButton \/>/);
});

test("recordManagedAttempt has a server-side backstop for the free-exam limit, scoped to mode='exam' and non-live only", async () => {
  const actions = await read("app/tests/actions.ts");
  assert.match(actions, /v\.mode === "exam" && !test\.is_live \? supabase\.rpc\("assert_exam_test_allowed"\) : Promise\.resolve\(null\)/);
  assert.match(actions, /if \(v\.mode === "exam" && !test\.is_live && examLimitResult\?\.error\) return \{ status: "locked" as const \};/);
});

test("an admin can set a student's free-exam-test limit from the student detail page", async () => {
  const controls = await read("app/admin/students/student-access-controls.tsx");
  assert.match(controls, /setStudentFreeExamLimit/);
  assert.match(controls, /useActionState\(setStudentFreeExamLimit, initial\)/);
  assert.match(controls, /name="freeExamLimit"/);

  const actions = await read("app/admin/students/actions.ts");
  assert.match(actions, /export async function setStudentFreeExamLimit/);
  assert.match(actions, /admin_set_exam_free_limit/);

  const detail = await read("app/admin/students/[id]/page.tsx");
  assert.match(detail, /free_exam_test_limit/);
  assert.match(detail, /freeExamLimit=\{student\.free_exam_test_limit\}/);
});

test("a fresh migration adds the free-exam-limit column and its three RPCs, following the established is_aal2_admin/self-or-admin conventions", async () => {
  const migration = await read("supabase/migrations/202609111000_exam_test_free_limit.sql");
  assert.match(migration, /alter table public\.profiles add column if not exists free_exam_test_limit integer default 20;/);
  assert.match(migration, /create or replace function public\.exam_test_free_status\(p_student_id uuid default auth\.uid\(\)\)/);
  assert.match(migration, /if p_student_id <> auth\.uid\(\) and not public\.is_aal2_admin\(\) then raise exception 'not authorized'; end if;/);
  assert.match(migration, /and t\.mode = 'exam' and t\.is_live = false;/);
  assert.match(migration, /create or replace function public\.assert_exam_test_allowed\(p_student_id uuid default auth\.uid\(\)\)/);
  assert.match(migration, /create or replace function public\.admin_set_exam_free_limit\(p_student_id uuid, p_limit integer\)/);
  assert.match(migration, /revoke all on function public\.exam_test_free_status\(uuid\), public\.assert_exam_test_allowed\(uuid\), public\.admin_set_exam_free_limit\(uuid,integer\) from public, anon;/);
});

test("the English and Hindi hub links to Take Tests (unaffected: no per-language exam gating in the hub itself) no longer show an admin-only Kruti Dev lessons card in the Hindi path list", async () => {
  const page = await read("app/typing/learn/page.tsx");
  const kruti = page.slice(page.indexOf("const kruti"));
  assert.doesNotMatch(kruti, /Admin Lessons/);
  assert.match(kruti, /label: "Learn Typing"/);
  assert.match(kruti, /label: "Take Tests", detail: "Kruti Dev speed practice", href: "\/typing\/practice\/hindi"/);
});
