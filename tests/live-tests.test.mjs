import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { anonymizeStudentName, liveTestState, validateLiveSchedule } from "../lib/live-tests.ts";

const schedule={isLive:true,startsAt:"2026-08-19T04:00:00.000Z",endsAt:"2026-08-19T05:00:00.000Z",resultsPublishAt:"2026-08-20T04:00:00.000Z"};

test("live-test states follow the scheduled window and delayed publication",()=>{
  assert.equal(liveTestState(schedule,new Date("2026-08-19T03:59:00.000Z")),"upcoming");
  assert.equal(liveTestState(schedule,new Date("2026-08-19T04:30:00.000Z")),"open");
  assert.equal(liveTestState(schedule,new Date("2026-08-19T06:00:00.000Z")),"closed");
  assert.equal(liveTestState(schedule,new Date("2026-08-20T04:00:00.000Z")),"results-published");
});

test("live schedules require an ordered start, end and result time",()=>{
  assert.deepEqual(validateLiveSchedule(schedule),[]);
  assert.match(validateLiveSchedule({...schedule,resultsPublishAt:"2026-08-19T04:30:00.000Z"}).join(" "),/before the live test ends/);
  assert.ok(validateLiveSchedule({...schedule,startsAt:null}).length);
});

test("public result labels do not expose a full student name",()=>{
  assert.equal(anonymizeStudentName("Priya Sharma"),"Priya S.");
  assert.equal(anonymizeStudentName("Ritu"),"R•••");
});

test("migration enforces one live attempt and delayed result visibility",()=>{
  const sql=readFileSync(new URL("../supabase/migrations/202608190001_scheduled_live_tests.sql",import.meta.url),"utf8");
  assert.match(sql,/unique index[^;]*\(test_id, student_id\) where is_live_attempt/i);
  assert.match(sql,/now\(\) between t\.live_starts_at and t\.live_ends_at/i);
  assert.match(sql,/now\(\) >= t\.results_publish_at/i);
  assert.match(sql,/published_live_results/);
  assert.doesNotMatch(sql,/email|phone|result->>'typedText'/i);
});
