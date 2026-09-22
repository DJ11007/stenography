import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported request: the English/Hindi podiums were side-by-side,
// squeezed inside a narrow parent column once Top Rankers nested into
// the "Your latest results" left column. Stacked into a single column
// instead, Hindi on top, English below.
test("LiveTestTopRankers stacks the two podiums in one column, Hindi above English", async () => {
  const component = await read("app/_components/live-test-top-rankers.tsx");
  assert.match(component, /<div className="grid gap-4">/);
  assert.doesNotMatch(component, /sm:grid-cols-2/);
  const hindiIndex = component.indexOf('<Podium language="Hindi"');
  const englishIndex = component.indexOf('<Podium language="English"');
  assert.ok(hindiIndex > 0 && englishIndex > hindiIndex, "Hindi podium must render before English");
});
