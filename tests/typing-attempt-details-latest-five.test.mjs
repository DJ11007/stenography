import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// The user's choice: keep full details for each student's latest 5 tests and every live test; older attempts
// keep their row and score line only (rows are still counted by free-test limits and live results).
test("only the latest 5 non-live attempts and all live attempts keep their full details", async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create table public.test_attempts (id uuid primary key default gen_random_uuid(), test_id uuid, test_version_id uuid, student_id uuid not null, snapshot jsonb not null, result jsonb not null, result_summary jsonb, started_at timestamptz not null, submitted_at timestamptz, is_live_attempt boolean not null default false);
    create table public.practice_attempts (id uuid primary key default gen_random_uuid(), student_id uuid not null, preset_id text not null default 'p', title text not null default 't', mode text not null default 'exam', snapshot jsonb not null, result jsonb not null, result_summary jsonb, started_at timestamptz not null, submitted_at timestamptz);`);
  const summary = (await read("supabase/migrations/202610251800_typing_attempt_result_summary.sql")).replace(/^begin;|^commit;/gm, "");
  await db.exec(summary);
  const student = "11111111-1111-1111-1111-111111111111", other = "22222222-2222-2222-2222-222222222222";
  const full = (wpm) => JSON.stringify({ netWpm: wpm, accuracy: 95, fullErrors: 2, typedText: "x".repeat(500), resolvedPassage: "p".repeat(500), comparisonText: "c", score: { mistakes: [1, 2] }, examCategorySlug: "ssc-cgl" });
  const snapshot = JSON.stringify({ id: "v", title: "Test", passage: "p".repeat(500), configuration: { audio_path: null, exam_category: "ssc", big: "z".repeat(300) } });
  const insert = (who, minute, live = false) => db.query(`insert into public.test_attempts (student_id, snapshot, result, started_at, submitted_at, is_live_attempt) values ($1, $2, $3, $4, $4, $5)`, [who, snapshot, full(minute), new Date(Date.UTC(2026, 9, 1, 10, minute)).toISOString(), live]);
  // Existing data before the migration: 7 attempts, one of them live and old.
  for (let minute = 1; minute <= 7; minute++) await insert(student, minute, minute === 1);
  await insert(other, 1);
  await db.exec((await read("supabase/migrations/202610251900_typing_attempt_details_latest_five.sql")).replace(/^begin;|^commit;/gm, ""));

  const rows = async (who) => (await db.query(`select (result->>'netWpm')::int wpm, is_live_attempt live, result ? 'typedText' details, result->>'detailsRemoved' removed, snapshot ? 'passage' passage, snapshot->'configuration' cfg, result_summary->>'netWpm' summary, result->>'examCategorySlug' slug from public.test_attempts where student_id = $1 order by started_at`, [who])).rows;
  let mine = await rows(student);
  assert.deepEqual(mine.map(r => [r.wpm, r.details]), [[1, true], [2, false], [3, true], [4, true], [5, true], [6, true], [7, true]], "live attempt 1 kept, attempt 2 trimmed, latest 5 kept");
  assert.equal(mine[1].removed, "true");
  assert.equal(mine[1].passage, false);
  assert.deepEqual(mine[1].cfg, { exam_category: "ssc" });
  assert.equal(mine[1].summary, "2", "the score line survives");
  assert.equal(mine[1].slug, "ssc-cgl", "short texts survive");
  assert.equal((await rows(other))[0].details, true, "another student's attempts are untouched");

  // A new attempt trims the sixth-newest one automatically.
  await insert(student, 8);
  mine = await rows(student);
  assert.deepEqual(mine.map(r => r.details), [true, false, false, true, true, true, true, true]);
  // Built-in tests share the same latest 5.
  await db.query(`insert into public.practice_attempts (student_id, snapshot, result, started_at, submitted_at) values ($1, $2, $3, $4, $4)`, [student, JSON.stringify({ preset: { big: "y".repeat(400) }, inputSystemId: "english" }), full(9), new Date(Date.UTC(2026, 9, 1, 10, 9)).toISOString()]);
  mine = await rows(student);
  assert.deepEqual(mine.map(r => r.details), [true, false, false, false, true, true, true, true]);
  const practice = (await db.query(`select snapshot, result ? 'typedText' details from public.practice_attempts`)).rows[0];
  assert.equal(practice.details, true);
  assert.equal((await db.query(`select count(*)::int n from public.test_attempts`)).rows[0].n, 9, "no row is ever deleted");
});

test("the attempt review pages say the details were removed instead of failing", async () => {
  for (const path of ["app/typing/attempts/[attemptId]/page.tsx", "app/admin/students/attempts/[attemptId]/page.tsx", "app/typing/attempts/practice-attempt-review.tsx"]) {
    assert.match(await read(path), /detailsRemoved/, path);
  }
});
