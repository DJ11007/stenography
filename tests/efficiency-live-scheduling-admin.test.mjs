import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real requested feature (continued): the admin Word/Excel Efficiency
// editors gain an optional live-scheduling fieldset (mirrors TestManager's
// "Free scheduled live test" checkbox + Starts/Ends/Publish results
// datetime fields exactly), and their save actions persist that schedule
// via the new set_word_efficiency_live_schedule/set_excel_efficiency_live_schedule
// RPCs as a second step right after the test content itself is saved --
// kept separate from save_word_efficiency_test/save_excel_efficiency_test
// (already large, heavily validated functions) rather than folded in.

for (const [label, pagePath, actionsPath, scheduleFn, testsSelect] of [
  ["Word Efficiency", "app/admin/word-efficiency-tests/page.tsx", "app/admin/word-efficiency-tests/actions.ts", "set_word_efficiency_live_schedule", "id,slug,title,language,status,current_version_id,current_version_number,updated_at,is_live,live_starts_at,live_ends_at,results_publish_at"],
  ["Excel Efficiency", "app/admin/excel-efficiency-tests/page.tsx", "app/admin/excel-efficiency-tests/actions.ts", "set_excel_efficiency_live_schedule", "id,slug,title,language,status,current_version_id,current_version_number,updated_at,is_live,live_starts_at,live_ends_at,results_publish_at"],
]) {
  test(`${label} admin page reads the live schedule columns and offers a Free scheduled live test fieldset`, async () => {
    const page = await read(pagePath);
    assert.match(page, new RegExp(testsSelect.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(page, /Free scheduled live test/);
    assert.match(page, /name="isLive"/);
    assert.match(page, /name="startsAt" type="datetime-local"/);
    assert.match(page, /name="endsAt" type="datetime-local"/);
    assert.match(page, /name="resultsPublishAt" type="datetime-local"/);
    assert.match(page, /test\.is_live && <span/);
  });

  test(`${label}'s save action persists the schedule via ${scheduleFn} as a step after saving test content`, async () => {
    const actions = await read(actionsPath);
    assert.match(actions, new RegExp(`rpc\\("${scheduleFn}", ?\\{ ?p_test_id: ?savedId`));
    assert.match(actions, /p_is_live: ?isLive/);
    assert.match(actions, /form\.get\("isLive"\) ?=== ?"on"/);
  });
}
