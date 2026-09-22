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
  assert.match(component, /<div className="grid gap-4 sm:grid-cols-2">/);
  const hindiIndex = component.indexOf('<Podium language="Hindi"');
  const englishIndex = component.indexOf('<Podium language="English"');
  assert.ok(hindiIndex > 0 && englishIndex > hindiIndex, "Hindi podium must render before English (left column)");
});
