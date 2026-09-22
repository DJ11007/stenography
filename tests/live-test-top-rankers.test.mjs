import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported follow-up: stacking the podiums in one column (an
// earlier fix for the nested "Your latest results" placement being too
// narrow) left a big unused strip of blank space beside each compact
// podium card once its own padding/spacing were tightened. Restored to a
// side-by-side grid -- Hindi left, English right -- which now fits fine
// at the tightened sizing, filling that space instead of leaving it
// blank.
test("LiveTestTopRankers arranges the two podiums side by side, Hindi left, English right", async () => {
  const component = await read("app/_components/live-test-top-rankers.tsx");
  assert.match(component, /<div className="grid h-full gap-4 sm:grid-cols-2">/);
  const hindiIndex = component.indexOf('<Podium language="Hindi"');
  const englishIndex = component.indexOf('<Podium language="English"');
  assert.ok(hindiIndex > 0 && englishIndex > hindiIndex, "Hindi podium must render before English (left column)");
});

// Real reported follow-up: once the two podiums grew a taller wrapping
// box (to balance the "Your latest results" columns), each podium's own
// fixed-height card left a blank gap below it inside that taller box.
// Both podiums now stretch to the box's full height (h-full) and center
// their own content, so the two cards stay equal height and fill the
// space instead of leaving a gap under one or both.
test("each Podium card stretches to its container's full height and centers its own rows", async () => {
  const component = await read("app/_components/live-test-top-rankers.tsx");
  assert.match(component, /className="flex h-full flex-col justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"/);
});

// Real requested feature: top 10 (was top 3) per language. Ranks 1-3 keep
// the crown/gradient treatment; 4-10 get a plain numbered badge instead
// of repeating the bronze crown ten times over. The rows list is height-
// capped with internal scrolling so both language cards stay the same
// size regardless of how many of the 10 slots are actually filled,
// instead of the whole section growing unbounded.
test("shows crowns for ranks 1-3 and a numbered badge for ranks 4-10, inside a height-capped, internally scrollable rows list", async () => {
  const component = await read("app/_components/live-test-top-rankers.tsx");
  assert.match(component, /max-h-72 space-y-2 overflow-y-auto/);
  assert.match(component, /\$\{i < 3 \? `bg-gradient-to-r \$\{TONE\[i\]\}` : "bg-slate-50 text-slate-700"\}/);
  assert.match(component, /i < 3 \? \(\s*\n\s*<span aria-hidden="true">\{CROWN\[i\]\}<\/span>/);
  assert.match(component, /<span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-\[11px\] text-slate-600">\{i \+ 1\}<\/span>/);
});

test("getLiveTestTopRankers defaults to the top 10 per language", async () => {
  const server = await read("lib/live-test-results-server.ts");
  assert.match(server, /export async function getLiveTestTopRankers\(language: string, limit = 10\): Promise<LiveTestTopRanker\[\]>/);
});

// Real bug found live: a long student name (e.g. "mahesh kumar bairwa")
// overflowed its row horizontally, triggering an unwanted horizontal
// scrollbar on the whole card -- a flex child doesn't shrink below its
// content's own intrinsic width without min-w-0, so `truncate` on the
// name span never got the chance to actually engage.
test("the name span has min-w-0 so truncate can actually engage, preventing horizontal overflow from a long name", async () => {
  const component = await read("app/_components/live-test-top-rankers.tsx");
  assert.match(component, /<span className="flex min-w-0 flex-1 items-center gap-2 font-black">/);
  assert.match(component, /<span className="truncate">\{r\.student_name\}<\/span>/);
});

// Real requested change: the shared header row above both columns (a
// "Top Rankers" label plus a leaderboard-naming heading) was removed
// from app/page.tsx entirely. "Top Rankers" now reads as the Hindi
// card's own heading (it sat visually above Hindi anyway); English keeps
// its plain "English" heading with no such text added.
test("Podium takes a separate heading prop -- the Hindi card's heading now carries the 'Top Rankers' wording, English stays plain", async () => {
  const component = await read("app/_components/live-test-top-rankers.tsx");
  assert.match(component, /function Podium\(\{ language, heading, rankers \}: \{ language: string; heading: string; rankers: LiveTestTopRanker\[\] \}\)/);
  assert.match(component, /<h3 className="text-xs font-black uppercase tracking-widest text-slate-500">\{heading\}<\/h3>/);
  assert.match(component, /<Podium language="Hindi" heading="Top Rankers — Hindi Live Test" rankers=\{hindi\} \/>/);
  assert.match(component, /<Podium language="English" heading="English" rankers=\{english\} \/>/);
});
