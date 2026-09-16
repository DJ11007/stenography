import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Real requested feature: Word/Excel Efficiency tests get the same live-
// scheduling (start/end join window, delayed results, one attempt per
// student, anonymized ticker) Typing/Stenography already have via
// supabase/migrations/202608190001_scheduled_live_tests.sql. Efficiency's
// own grading is manual per-attempt (evaluation_status draft->published),
// so a live attempt's result additionally waits on that publish action,
// not just the clock -- results_publish_at only ever brings the reveal
// forward relative to when grading is actually published.

const wordSql = readFileSync(new URL("../supabase/migrations/202609160001_word_efficiency_live_scheduling.sql", import.meta.url), "utf8");
const excelSql = readFileSync(new URL("../supabase/migrations/202609160002_excel_efficiency_live_scheduling.sql", import.meta.url), "utf8");

for (const [label, sql, table, prepareFn, resultFn, tickerFn, scheduleFn] of [
  ["Word Efficiency", wordSql, "word_efficiency", "prepare_word_efficiency_attempt", "get_word_efficiency_attempt_result", "published_word_efficiency_live_results", "set_word_efficiency_live_schedule"],
  ["Excel Efficiency", excelSql, "excel_efficiency", "prepare_excel_efficiency_attempt", "get_excel_efficiency_attempt_result", "published_excel_efficiency_live_results", "set_excel_efficiency_live_schedule"],
]) {
  test(`${label} live-scheduling migration adds the same schedule columns, one-attempt index, and check constraint as Typing/Stenography's`, () => {
    assert.match(sql, new RegExp(`alter table public\\.${table}_tests add column if not exists is_live boolean not null default false;`));
    assert.match(sql, new RegExp(`alter table public\\.${table}_tests add column if not exists live_starts_at timestamptz;`));
    assert.match(sql, new RegExp(`alter table public\\.${table}_tests add column if not exists live_ends_at timestamptz;`));
    assert.match(sql, new RegExp(`alter table public\\.${table}_tests add column if not exists results_publish_at timestamptz;`));
    assert.match(sql, /live_ends_at > live_starts_at and results_publish_at >= live_ends_at/);
    assert.match(sql, new RegExp(`alter table public\\.${table}_attempts add column if not exists is_live_attempt boolean not null default false;`));
    assert.match(sql, new RegExp(`unique index[^;]*\\(test_id,student_id\\) where is_live_attempt`, "i"));
  });

  test(`${label}'s ${scheduleFn} RPC is admin-only and validates the schedule the same way validateLiveSchedule does`, () => {
    assert.match(sql, new RegExp(`create or replace function public\\.${scheduleFn}\\(`));
    assert.match(sql, /if not public\.is_aal2_admin\(\) then raise exception 'not authorized'; end if;/);
    assert.match(sql, /p_ends_at<=p_starts_at or p_results_publish_at<p_ends_at/);
    assert.match(sql, new RegExp(`grant execute on function public\\.${scheduleFn}\\(uuid,boolean,timestamptz,timestamptz,timestamptz\\) to authenticated;`));
  });

  test(`${label}'s ${prepareFn} enforces the live join window and one attempt per student, with a friendly duplicate-attempt message`, () => {
    assert.match(sql, new RegExp(`create or replace function public\\.${prepareFn}\\(`));
    assert.match(sql, /if now\(\)<t?\.?(?:est_record)?\.live_starts_at or now\(\)>t?\.?(?:est_record)?\.live_ends_at then raise exception 'This live test is not currently open\.';/);
    assert.match(sql, /raise exception 'You have already attempted this live test\.';/);
  });

  test(`${label}'s ${resultFn} withholds a live attempt's result until BOTH grading is published AND results_publish_at has passed`, () => {
    assert.match(sql, new RegExp(`create or replace function public\\.${resultFn}\\(`));
    assert.match(sql, /and\(not attempt_record\.is_live_attempt or test_record\.results_publish_at is null or now\(\)>=test_record\.results_publish_at\)/);
  });

  test(`${label}'s ${tickerFn} is anonymized and only surfaces published live results`, () => {
    assert.match(sql, new RegExp(`create or replace function public\\.${tickerFn}\\(`));
    assert.match(sql, /left\(coalesce\(nullif\(p\.full_name,''\),'Student'\),1\) \|\| '•••'/);
    assert.match(sql, /a\.is_live_attempt and t\.is_live and t\.results_publish_at <= now\(\) and a\.evaluation_status='published'/);
    assert.doesNotMatch(sql, /email|phone|final_document_snapshot|typedText/i);
    assert.match(sql, new RegExp(`grant execute on function public\\.${tickerFn}\\(integer\\) to anon,authenticated;`));
  });
}
