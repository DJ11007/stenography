import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real requested feature: students need a way to find past live-test
// results by date instead of only ever seeing the latest 30 overall.
// /live-test now reads ?date= from searchParams, defaults to the most
// recent day with a published result, and renders an always-visible
// (when any date has results) date tablist above the results ticker.
test("the /live-test page reads ?date= from searchParams and defaults to the most recent day with a published result", async () => {
  const page = await read("app/live-test/page.tsx");
  assert.match(page, /searchParams: Promise<\{ date\?: string \}>/);
  assert.match(page, /getPublishedLiveResultDates\(90\)/);
  assert.match(page, /const selectedDate = params\.date && resultDates\.includes\(params\.date\) \? params\.date : resultDates\[0\];/);
  assert.match(page, /getPublishedLiveResultsByDate\(selectedDate\)/);
});

test("the /live-test page renders LiveResultDateTabs above the results ticker, only when at least one date has results", async () => {
  const page = await read("app/live-test/page.tsx");
  assert.match(page, /import \{ LiveResultDateTabs \} from "\.\/live-result-date-tabs";/);
  assert.match(page, /\{resultDates\.length>0&&<LiveResultDateTabs dates=\{resultDates\} selected=\{selectedDate\}\/>\}/);
  assert.match(page, /id="results"/);
});

test("LiveResultDateTabs links to ?date=<date>#results with each date formatted in IST", async () => {
  const component = await read("app/live-test/live-result-date-tabs.tsx");
  assert.match(component, /href=\{`\/live-test\?date=\$\{date\}#results`\}/);
  assert.match(component, /formatISTDate\(date, \{ day: "numeric", month: "short" \}\)/);
});
