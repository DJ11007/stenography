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
