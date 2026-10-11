import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const BASE = "app/admin/word-efficiency-tests";

test("the Auto-grading page runs the model-answer self-test, gates the ON switch on it, and offers re-grade", async () => {
  const page = await read(`${BASE}/[testId]/auto-grading/page.tsx`);
  assert.match(page, /rpc\("check_word_efficiency_auto_grading", \{ p_test_id: testId \}\)/);
  assert.match(page, /disabled=\{!enabled && !check\?\.ready\}/);
  assert.match(page, /Step 1/);
  assert.match(page, /Step 2/);
  assert.match(page, /regradeWordEfficiencyAttempts/);
  assert.match(page, /No AI is involved/);
  const actions = await read(`${BASE}/[testId]/auto-grading/actions.ts`);
  assert.match(actions, /rpc\("set_word_efficiency_auto_publish", \{ p_test_id: testId, p_enabled: enabled \}\)/);
  assert.match(actions, /rpc\("regrade_word_efficiency_version", \{ p_version_id: versionId \}\)/);
  assert.equal((actions.match(/await requireAdmin\(\)/g) ?? []).length, 2, "both actions require an admin");
});

test("the test list links to the Auto-grading page next to Model Answer", async () => {
  const list = await read(`${BASE}/page.tsx`);
  assert.match(list, /href=\{`\/admin\/word-efficiency-tests\/\$\{test\.id\}\/auto-grading`\}/);
});

test("a published result can be adjusted question by question, with a required reason and a visible history", async () => {
  const actions = await read(`${BASE}/attempts/[attemptId]/actions.ts`);
  assert.match(actions, /export async function overrideWordEfficiencyMarks/);
  assert.match(actions, /rpc\("override_word_efficiency_question_marks"/);
  assert.match(actions, /await requireAdmin\(\)/);
  const page = await read(`${BASE}/attempts/[attemptId]/page.tsx`);
  assert.match(page, /rpc\("list_word_efficiency_grade_changes"/);
  assert.match(page, /<form action=\{overrideWordEfficiencyMarks\}/);
  assert.match(page, /name="reason" required minLength=\{3\}/);
  assert.match(page, /Scored automatically/);
  assert.doesNotMatch(page, /Published results are locked\. No silent revision is available\./);
});

test("the overhaul migration is intact: no leftover shell expansion, every new function is granted deliberately", async () => {
  const sql = await read("supabase/migrations/202610111200_word_efficiency_auto_grading_overhaul.sql");
  assert.doesNotMatch(sql, /\bas \d{3,}\b|\bend \d{3,};/, "a '$$' must never be replaced by a number");
  assert.equal((sql.match(/\$\$/g) ?? []).length % 2, 0, "dollar-quote delimiters are balanced");
  for (const fn of ["regrade_word_efficiency_version", "override_word_efficiency_question_marks", "check_word_efficiency_auto_grading", "set_word_efficiency_auto_publish", "list_word_efficiency_grade_changes"]) {
    assert.match(sql, new RegExp(`grant execute on function[^;]*public\\.${fn}\\(`), `${fn} is granted to signed-in users (admin-checked inside)`);
  }
  for (const fn of ["word_efficiency_refresh_published_result", "word_efficiency_auto_publish_attempt"]) {
    assert.match(sql, new RegExp(`revoke all on function[^;]*public\\.${fn}\\(uuid\\)[^;]*from public,anon,authenticated`), `${fn} is internal only`);
  }
  assert.match(sql, /revoke all on table public\.word_efficiency_grade_changes from public,anon,authenticated;/);
});
