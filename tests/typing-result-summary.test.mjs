import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { TYPING_RESULT_SUMMARY, withResultSummary } from "../lib/typing-result-summary.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real report: admin Track showed "No typing attempts yet" for a student with 903 typing attempts. Loading
// every full result (11 MB) ran past the database's 8-second limit. Lists now read result_summary only.
test("attempt lists read the small result_summary, put back as result", async () => {
  assert.equal(TYPING_RESULT_SUMMARY, "result_summary");
  assert.deepEqual(withResultSummary({ id: "a", result_summary: { netWpm: 32.5, accuracy: 96 } }), { id: "a", result: { netWpm: 32.5, accuracy: 96 } });
  assert.deepEqual(withResultSummary({ id: "b", result_summary: null }), { id: "b", result: {} });
  for (const path of ["app/admin/track/[id]/page.tsx", "app/admin/tests/[testId]/results/page.tsx", "app/student/results/page.tsx", "lib/student-attempt-history.ts", "lib/practice-navigator-server.ts"]) {
    const source = await read(path);
    assert.match(source, /TYPING_RESULT_SUMMARY/, path);
    assert.doesNotMatch(source, /from\("(test|practice)_attempts"\)\.select\("[^"]*\bresult\b[^"]*"\)/, `${path} must not load full results in a list`);
  }
  const sql = await read("supabase/migrations/202610251800_typing_attempt_result_summary.sql");
  assert.match(sql, /create trigger set_typing_result_summary before insert or update of result on public\.test_attempts/);
  assert.match(sql, /update public\.test_attempts set result_summary = public\.typing_result_summary\(result\)/);
});
