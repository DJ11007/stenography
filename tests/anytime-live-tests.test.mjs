import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real requested feature: alongside the existing scheduled live test (fixed
// start/end window, one shared results_publish_at for everyone), an admin
// can create an "anytime" live test -- a student can attempt it any day, at
// any time, one attempt each, but their OWN result unlocks a fixed delay
// (e.g. 10 minutes, admin-configurable) after THEIR OWN submission instead
// of one shared reveal time. Every file below is a piece of that one
// feature; each test asserts a different link in the chain.

test("migration adds results_delay_minutes, widens the check constraint to a third disjunct, and updates the insert/select policies and both RPCs", async () => {
  const sql = await read("supabase/migrations/202609170001_anytime_live_tests.sql");
  assert.match(sql, /alter table public\.tests add column if not exists results_delay_minutes integer;/);
  // The constraint's first two branches (not-live, and scheduled-live) are
  // untouched byte-for-byte from 202608190001 except for the added
  // "results_delay_minutes is null" requirement -- an existing scheduled
  // test (delay always null) must keep satisfying it unchanged.
  assert.match(sql, /\(not is_live and live_starts_at is null and live_ends_at is null and results_publish_at is null and results_delay_minutes is null\)/);
  assert.match(sql, /\(is_live and results_delay_minutes is null and visibility = 'public' and live_starts_at is not null and live_ends_at > live_starts_at and results_publish_at >= live_ends_at\)/);
  assert.match(sql, /\(is_live and results_delay_minutes is not null and results_delay_minutes > 0 and results_delay_minutes <= 1440 and visibility = 'public' and live_starts_at is null and live_ends_at is null and results_publish_at is null\)/);
  // Insert policy: anytime attempts skip the scheduled window check entirely.
  assert.match(sql, /is_live_attempt and t\.is_live and t\.results_delay_minutes is not null\)/);
  // Select policy: per-ATTEMPT gate (this row's own submitted_at), not the
  // scheduled shape's per-TEST shared results_publish_at gate.
  assert.match(sql, /t\.results_delay_minutes is not null and submitted_at is not null and now\(\) >= submitted_at \+ \(t\.results_delay_minutes \|\| ' minutes'\)::interval/);
  // save_scheduled_managed_test: reads results_delay_minutes from the
  // payload, validates it instead of the start/end/results triple when set,
  // and persists it while nulling the scheduled-only columns.
  assert.match(sql, /v_delay := nullif\(p_payload->>'results_delay_minutes',''\)::integer;/);
  assert.match(sql, /if v_delay <= 0 or v_delay > 1440 then raise exception 'invalid live schedule'; end if;/);
  assert.match(sql, /results_delay_minutes=case when v_is_live then v_delay else null end/);
  // published_live_results: anytime attempts join the same anonymized
  // ticker once their OWN delay has elapsed.
  assert.match(sql, /a\.submitted_at \+ \(t\.results_delay_minutes \|\| ' minutes'\)::interval <= now\(\)/);
});

test("lib/admin-tests.ts passes resultsDelayMinutes through to validateLiveSchedule", async () => {
  const source = await read("lib/admin-tests.ts");
  assert.match(source, /validateLiveSchedule\(\{ isLive: input\.isLive \?\? false, startsAt: input\.startsAt \?\? null, endsAt: input\.endsAt \?\? null, resultsPublishAt: input\.resultsPublishAt \?\? null, resultsDelayMinutes: input\.resultsDelayMinutes \?\? null \}\)/);
});

test("app/admin/tests/actions.ts reads liveMode/resultsDelayMinutes from the form, nulling the scheduled fields in anytime mode and vice versa", async () => {
  const source = await read("app/admin/tests/actions.ts");
  assert.match(source, /const liveMode = text\(formData, "liveMode"\) === "anytime" \? "anytime" : "scheduled";/);
  assert.match(source, /startsAt: isLive && liveMode === "scheduled" \? iso\("startsAt"\) : null,/);
  assert.match(source, /resultsDelayMinutes: isLive && liveMode === "anytime" \?/);
  assert.match(source, /results_delay_minutes: draft\.resultsDelayMinutes \?\? null/);
});

test("the admin test-manager form offers a Scheduled/Anytime mode selector and a results-delay-minutes field", async () => {
  const source = await read("app/admin/tests/test-manager.tsx");
  assert.match(source, /const \[liveMode,setLiveMode\] = useState<"scheduled"\|"anytime">\("scheduled"\);/);
  assert.match(source, /const \[resultsDelayMinutes,setResultsDelayMinutes\] = useState\(10\);/);
  assert.match(source, /setLiveMode\(test\?\.results_delay_minutes != null \? "anytime" : "scheduled"\);/);
  assert.match(source, /<input type="radio" name="liveMode" value="scheduled"/);
  assert.match(source, /<input type="radio" name="liveMode" value="anytime"/);
  assert.match(source, /name="resultsDelayMinutes" type="number" min=\{1\} max=\{1440\}/);
});

test("app/tests/actions.ts's recordManagedAttempt skips the scheduled window check for an anytime test, and returns resultsDelayMinutes/submittedAt instead of a shared resultsPublishAt", async () => {
  const source = await read("app/tests/actions.ts");
  assert.match(source, /results_delay_minutes"\)\.eq\("id", payload\.testId\)/);
  assert.match(source, /if \(test\.is_live && test\.results_delay_minutes == null\) \{/);
  assert.match(source, /status: "submitted" as const, resultsPublishAt: test\.results_publish_at, resultsDelayMinutes: test\.results_delay_minutes, submittedAt: test\.results_delay_minutes != null \? new Date\(\)\.toISOString\(\) : null/);
});

test("app/tests/[slug]/page.tsx never shows the upcoming/closed/results-published gate for an anytime test", async () => {
  const source = await read("app/tests/[slug]/page.tsx");
  assert.match(source, /resultsDelayMinutes:test\.results_delay_minutes\}/);
  assert.match(source, /if\(test\.is_live&&state!=="open"&&state!=="anytime"\)return <LiveTestGate/);
});

test("the live submission receipt shows a per-student unlock time for anytime tests instead of one shared release time", async () => {
  const source = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(source, /resultsDelayMinutes\?:number\|null/);
  assert.match(source, /const anytime = resultsDelayMinutes != null;/);
  assert.match(source, /Your result will unlock \$\{unlockAt \? `at \$\{unlockAt\}` : `\$\{resultsDelayMinutes\} minutes from now`\}/);
});

test("the public /live-test list recognizes the \"anytime\" state, pins anytime tests in their own top group, and shows a per-student unlock hint instead of Starts/Ends/Results", async () => {
  const source = await read("app/live-test/live-test-list.tsx");
  assert.match(source, /results_delay_minutes: number \| null;/);
  assert.match(source, /anytime: "Anytime",/);
  assert.match(source, /const STATUS_TABS = \["anytime", "upcoming", "open", "results-published", "closed"\] as const;/);
  assert.match(source, /return anytimeItems\.length \? \[\{ heading: "Available anytime", items: anytimeItems \}, \.\.\.dayGroups\] : dayGroups;/);
  assert.match(source, /your result unlocks \{test\.results_delay_minutes\} minutes after you submit/);
});
