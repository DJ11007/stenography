import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported redundancy: the Exam Simulator's category rules page showed
// a "Real tests" preview box (RealTestList, a handful of exercises + a "See
// all N exercises" link) directly above each "Start in English/Hindi"
// button -- but that Start button already goes to the exact same place
// ("See all" and "Start in English" both linked to
// /typing/exams/category/[slug]/[language], the full paginated Exercises
// catalogue), so the box was a redundant second way to reach a page you
// could already reach with Start. Removed entirely; "Start in
// English/Hindi" is now the only way forward from this rules page, same as
// it always was for reaching that catalogue.
test("the exam category rules page no longer shows a redundant Real tests preview box above Start in English/Hindi", async () => {
  const page = await read("app/typing/exams/category/[slug]/page.tsx");
  assert.doesNotMatch(page, /RealTestList/);
  assert.doesNotMatch(page, /getExamCategoryNavigator/);
  assert.doesNotMatch(page, /Real tests|वास्तविक टेस्ट/);
  assert.match(page, /Start in English/);
  assert.match(page, /हिंदी में शुरू करें \(Start in Hindi\)/);
  assert.match(page, /href=\{`\/typing\/exams\/category\/\$\{category\.slug\}\/english`\}/);
  assert.match(page, /href=\{`\/typing\/exams\/category\/\$\{category\.slug\}\/hindi`\}/);
});
