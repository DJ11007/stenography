import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported problem: once 100+ live tests pile up, the old
// one-card-per-test layout (always showing Starts/Ends/Duration/Results
// expanded, 2 per row) is slow to scan and mixes old closed tests in with
// what's actually coming up. The redesign groups tests by calendar day,
// adds status/language filters and a newest/oldest sort (mirroring the
// existing lesson catalogue and stenography task library patterns
// elsewhere in this app), renders a denser 4-column grid at desktop, and
// tucks the exact Ends/Results timestamps and description behind a
// per-card "Details" toggle instead of always showing them.
test("the live-test page delegates its list to the new LiveTestList component instead of an inline always-expanded grid", async () => {
  const page = await read("app/live-test/page.tsx");
  assert.match(page, /import \{ LiveTestList \} from "\.\/live-test-list";/);
  assert.match(page, /<LiveTestList tests=\{tests\}\/>/);
  assert.doesNotMatch(page, /function LiveTestCard/);
});

test("LiveTestList groups tests by calendar day in IST, independent of the server process's own timezone", async () => {
  const list = await read("app/live-test/live-test-list.tsx");
  assert.match(list, /formatISTDate/);
  assert.match(list, /function dayKey/);
  assert.match(list, /function dayHeading/);
});

test("LiveTestList offers a status filter (upcoming/open/results-published/closed), a language filter, and a newest/oldest sort", async () => {
  const list = await read("app/live-test/live-test-list.tsx");
  assert.match(list, /const STATUS_TABS = \["upcoming", "open", "results-published", "closed"\] as const;/);
  assert.match(list, /aria-label="Filter by language"/);
  assert.match(list, /languages\.length > 1/);
  assert.match(list, /<option value="newest">Newest first<\/option>/);
  assert.match(list, /<option value="oldest">Oldest first<\/option>/);
});

test("LiveTestList renders a 4-column grid at desktop (matching the breakpoints already used by the lesson catalogue and stenography library), and does not let a taller sibling card stretch a shorter one", async () => {
  const list = await read("app/live-test/live-test-list.tsx");
  assert.match(list, /grid items-start justify-items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4/);
});

// Real reported follow-up: the first compact card still had a big blank
// gap above the CTA button. Putting the "Details" toggle and the CTA on
// the same row (instead of the CTA as a separate full-width block below)
// removes that row entirely, and dropping the title's reserved two-line
// min-height stops a short one-line title from padding out empty space.
test("each live-test card hides Starts/Ends/Results and the description behind a collapsible Details toggle placed on the same row as the CTA, with no reserved title height", async () => {
  const list = await read("app/live-test/live-test-list.tsx");
  assert.match(list, /const \[open, setOpen\] = useState\(false\);/);
  assert.match(list, /aria-expanded=\{open\}/);
  assert.match(list, /\{open && \(/);
  assert.match(list, /formatISTTime\(test\.live_starts_at, \{ hour: "numeric", minute: "2-digit", hour12: true \}\)/);
  assert.doesNotMatch(list, /min-h-9/);
  assert.match(list, /<div className="mt-2 flex items-center gap-3">\s*<button type="button" onClick/);
});

// Second reported follow-up: on a wide screen with only a couple of live
// tests, the grid still divided its full width evenly between columns,
// so each mostly-empty card stretched wide and its badge/CTA -- pinned to
// the far right via justify-between -- left a big blank rectangle in the
// middle. A card should size to its own content, not to however wide an
// mostly-empty grid column happens to be.
test("a live-test card caps its own width and left-aligns its rows instead of stretching to fill a wide, sparsely-populated grid column", async () => {
  const list = await read("app/live-test/live-test-list.tsx");
  assert.match(list, /className="inline-flex w-full max-w-xs flex-col rounded-xl/);
  assert.doesNotMatch(list, /flex items-center justify-between gap-2">\s*<span className="rounded-full bg-red-100/);
});
