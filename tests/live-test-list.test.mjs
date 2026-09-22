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
  assert.match(page, /import \{ LiveTestList, type LiveTest \} from "\.\/live-test-list";/);
  assert.match(page, /<LiveTestList tests=\{entries\}\/>/);
  assert.doesNotMatch(page, /function LiveTestCard/);
});

test("LiveTestList groups tests by calendar day in IST, independent of the server process's own timezone", async () => {
  const list = await read("app/live-test/live-test-list.tsx");
  assert.match(list, /formatISTDate/);
  assert.match(list, /function dayKey/);
  assert.match(list, /function dayHeading/);
});

// Real reported request: hindi/english/stenography/efficiency tests were
// all mixed together with no way to tell them apart at a glance. An
// always-visible category tablist (unlike the language tabs, which only
// appear once there's more than one language) filters by Typing /
// Stenography / Efficiency, and each card also shows its category next to
// the LIVE badge so the grouping is visible even with the "All" tab active.
test("LiveTestList offers an always-visible category filter (Typing/Stenography/Efficiency) and shows the category on each card", async () => {
  const list = await read("app/live-test/live-test-list.tsx");
  assert.match(list, /const CATEGORY_TABS = \["Typing", "Stenography", "Efficiency"\] as const;/);
  assert.match(list, /aria-label="Filter by category"/);
  assert.doesNotMatch(list, /category\.length > 1/);
  assert.match(list, /\{test\.category\}/);
});

test("LiveTestList offers a status filter (anytime/upcoming/open/results-published/closed), a language filter, and a newest/oldest sort", async () => {
  const list = await read("app/live-test/live-test-list.tsx");
  assert.match(list, /const STATUS_TABS = \["anytime", "upcoming", "open", "results-published", "closed"\] as const;/);
  assert.match(list, /aria-label="Filter by language"/);
  assert.match(list, /languages\.length > 1/);
  assert.match(list, /<option value="newest">Newest first<\/option>/);
  assert.match(list, /<option value="oldest">Oldest first<\/option>/);
});

// Third reported follow-up, with a screenshot: fixed sm/lg/xl column
// breakpoints divide the FULL row width evenly among however many
// columns that breakpoint declares, regardless of how many cards
// actually exist. With only 2 cards but (say) 3 declared columns, each
// populated track was still stretched to its 1/3 share, so the capped-
// width, left-aligned card only occupied the front of its own wide
// track -- the unused remainder of that track read as a big gap between
// card 1 and card 2, even though no column was technically empty.
// auto-fill with a max-content ceiling sizes each track to its actual
// card instead of an even division of the row, so populated cards sit
// flush next to each other with only the grid gap between them, and it
// naturally yields four or five columns on a wide screen without any
// breakpoint tuning.
test("LiveTestList auto-fills columns sized to each card's own content, instead of dividing the full row evenly among a fixed column count", async () => {
  const list = await read("app/live-test/live-test-list.tsx");
  assert.match(list, /grid items-start justify-items-start gap-3 grid-cols-\[repeat\(auto-fill,minmax\(250px,max-content\)\)\]/);
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
  assert.match(list, /border-t border-slate-100 pt-2\.5">\s*<button type="button" onClick/);
});

// Second reported follow-up: on a wide screen with only a couple of live
// tests, the grid still divided its full width evenly between columns,
// so each mostly-empty card stretched wide and its badge/CTA -- pinned to
// the far right via justify-between -- left a big blank rectangle in the
// middle. A card should size to its own content, not to however wide an
// mostly-empty grid column happens to be.
test("a live-test card caps its own width instead of stretching to fill a wide, sparsely-populated grid column", async () => {
  const list = await read("app/live-test/live-test-list.tsx");
  assert.match(list, /className="relative w-full max-w-xs overflow-hidden rounded-xl/);
});

// Fourth reported follow-up: everything was crammed against the left
// edge with plain grey chips -- readable, but flat. A colored left
// accent bar (matching the status badge's color) gives an at-a-glance
// status cue the way a real dashboard card would, a slightly larger
// title establishes hierarchy, the language/duration/time metadata reads
// as one flowing line instead of three separate boxes, a divider
// separates that metadata from the action row, and the CTA is a solid
// filled button instead of a pale text-link-style pill.
test("the card layout gives a professional visual hierarchy: a status-colored accent bar, a divider before the action row, and a solid CTA button", async () => {
  const list = await read("app/live-test/live-test-list.tsx");
  assert.match(list, /const STATUS_ACCENT: Record<LiveTestState, string> = \{/);
  assert.match(list, /<span className=\{`absolute inset-y-0 left-0 w-1\.5 \$\{STATUS_ACCENT\[state\]\}`\} aria-hidden="true"\/>/);
  assert.match(list, /border-t border-slate-100 pt-2\.5/);
  assert.match(list, /bg-blue-600 text-white/);
});
