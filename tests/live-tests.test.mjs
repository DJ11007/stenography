import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { anonymizeStudentName, liveTestState, validateLiveSchedule } from "../lib/live-tests.ts";

const schedule={isLive:true,startsAt:"2026-08-19T04:00:00.000Z",endsAt:"2026-08-19T05:00:00.000Z",resultsPublishAt:"2026-08-20T04:00:00.000Z",resultsDelayMinutes:null};

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

// Real requested feature: a live test attemptable "any day, any time" (no
// fixed start/end window), where each student's OWN result unlocks a fixed
// delay after THEIR OWN submission instead of one shared reveal time for
// everyone. Selected per test via resultsDelayMinutes -- non-null switches
// the whole schedule into this "anytime" mode regardless of what the
// (unused, left null) startsAt/endsAt/resultsPublishAt fields hold.
test("a live test with resultsDelayMinutes set is always in \"anytime\" state, at any date, with no start/end window", () => {
  const anytimeSchedule = { isLive: true, startsAt: null, endsAt: null, resultsPublishAt: null, resultsDelayMinutes: 10 };
  assert.equal(liveTestState(anytimeSchedule, new Date("2020-01-01T00:00:00.000Z")), "anytime");
  assert.equal(liveTestState(anytimeSchedule, new Date("2099-01-01T00:00:00.000Z")), "anytime");
  // resultsDelayMinutes wins even if stray start/end/results values are
  // also present (shouldn't happen given the DB check constraint, but the
  // pure function itself should still behave predictably either way).
  assert.equal(liveTestState({ ...schedule, resultsDelayMinutes: 10 }, new Date("2026-08-19T03:00:00.000Z")), "anytime");
});

test("anytime mode validates the results delay instead of a start/end/results triple", () => {
  assert.deepEqual(validateLiveSchedule({ isLive: true, startsAt: null, endsAt: null, resultsPublishAt: null, resultsDelayMinutes: 10 }), []);
  assert.deepEqual(validateLiveSchedule({ isLive: true, startsAt: null, endsAt: null, resultsPublishAt: null, resultsDelayMinutes: 1440 }), []);
  assert.ok(validateLiveSchedule({ isLive: true, startsAt: null, endsAt: null, resultsPublishAt: null, resultsDelayMinutes: 0 }).length);
  assert.ok(validateLiveSchedule({ isLive: true, startsAt: null, endsAt: null, resultsPublishAt: null, resultsDelayMinutes: -5 }).length);
  assert.ok(validateLiveSchedule({ isLive: true, startsAt: null, endsAt: null, resultsPublishAt: null, resultsDelayMinutes: 1441 }).length);
  assert.ok(validateLiveSchedule({ isLive: true, startsAt: null, endsAt: null, resultsPublishAt: null, resultsDelayMinutes: 5.5 }).length);
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
