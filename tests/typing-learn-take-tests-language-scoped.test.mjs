import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Regression guard for a real reported bug: "Take Tests" under both the
// English and Hindi sections of /typing/learn pointed at the unscoped
// /typing/practice hub, which asks the student to choose English or Hindi
// again -- discarding the choice they'd already made by picking a section.
// "Learn Typing" already linked to the correctly scoped /typing/learn/
// {english,hindi}; "Take Tests" must do the same for /typing/practice.
test("Take Tests under each language section of /typing/learn links to that language's scoped practice catalogue, not the unscoped picker", async () => {
  const page = await read("app/typing/learn/page.tsx");
  assert.doesNotMatch(page, /href: "\/typing\/practice"/);
  const english = page.slice(page.indexOf("const english"), page.indexOf("const kruti"));
  assert.match(english, /label: "Take Tests", detail: "Measure speed and precision", href: "\/typing\/practice\/english"/);
  const kruti = page.slice(page.indexOf("const kruti"));
  assert.match(kruti, /label: "Take Tests", detail: "Kruti Dev speed practice", href: "\/typing\/practice\/hindi"/);
});
