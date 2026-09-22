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

test("each Podium card stretches to its container's full height", async () => {
  const component = await read("app/_components/live-test-top-rankers.tsx");
  assert.match(component, /className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"/);
});

// Real reported follow-up: showing all 10 in a height-capped, scrollable
// list meant only ~6 were visible without scrolling, and centering the
// content (justify-center) inside a box that stretched to match whichever
// success-story slide happened to be showing made the rows visibly
// jump/re-center every time the carousel auto-rotated. Fixed: no more
// scroll cap or centering -- all up to 10 rows render in full, top to
// bottom, at this card's own natural (now carousel-rotation-independent)
// height. See student-success-carousel-photo-height.test.mjs for the
// matching fix on the success-story side.
test("shows crowns for ranks 1-3 and a numbered badge for ranks 4-10, with no scroll cap or centering -- all 10 rows render in full, top to bottom", async () => {
  const component = await read("app/_components/live-test-top-rankers.tsx");
  assert.doesNotMatch(component, /max-h-72/);
  assert.doesNotMatch(component, /overflow-y-auto/);
  assert.match(component, /<div className="mt-3 space-y-2">/);
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
