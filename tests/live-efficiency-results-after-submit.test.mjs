import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Requested: every efficiency test's live result shows 15 minutes after the student submits,
// not at one shared publication time.
test("live efficiency results unlock results_delay_minutes (default 15) after each student's own submission", async () => {
  const sql = await read("supabase/migrations/202610251200_live_efficiency_results_after_submit.sql");
  assert.match(sql, /alter table public\.word_efficiency_tests add column if not exists results_delay_minutes integer default 15;/);
  assert.match(sql, /alter table public\.excel_efficiency_tests add column if not exists results_delay_minutes integer default 15;/);
  assert.match(sql, /now\(\)>=attempt_record\.submitted_at\+make_interval\(mins=>test_record\.results_delay_minutes\)/, "the student's own result page");
  assert.match(sql, /a\.submitted_at\+make_interval\(mins=>t\.results_delay_minutes\) else t\.results_publish_at end\) <= now\(\)/, "the public leaderboard");
  assert.match(sql, /''resultsAt''/, "the pending result page says when it unlocks");
  assert.match(sql, /duration_options integer\[\], results_delay_minutes integer\)/);
});

test("the live-test card and the result pages show the after-submit time", async () => {
  const [page, list, word, excel] = await Promise.all([
    read("app/live-test/page.tsx"), read("app/live-test/live-test-list.tsx"),
    read("app/typing/word-efficiency/results/[attemptId]/page.tsx"), read("app/typing/excel-efficiency/results/[attemptId]/page.tsx"),
  ]);
  assert.match(page, /results_after_submit_minutes: test\.results_delay_minutes \?\? null/);
  assert.match(list, /`\$\{test\.results_after_submit_minutes\} minutes after you submit`/);
  for (const source of [word, excel]) assert.match(source, /Your result will be shown at \$\{formatIST\(result\.resultsAt\)\}/);
});
