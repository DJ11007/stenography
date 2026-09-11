import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Reported: a student saw "TEST - 8, TEST - 7, ... TEST - 3, TEST - 4" (a
// newest-first date order, not numeric order) with badges 1-6 that didn't
// match any test's own number. Two fixes: default the picker (and every
// other "Newest/Oldest" catalogue) to oldest-first, and badge each card
// with the number embedded in its own title, not its position in the list.
test("the practice picker defaults to Oldest, not Newest", async () => {
  const navigator = await read("app/typing/practice/_components/practice-navigator.tsx");
  assert.match(navigator, /const sort = params\.sort === "newest" \? "newest" : "oldest";/);
  assert.match(navigator, /if \(forSort === "newest"\) query\.set\("sort", "newest"\);/);
  assert.match(navigator, /if \(targetSort === "newest"\) query\.set\("sort", "newest"\);/);
});

test("the Exam Simulator category exercise list also defaults to Oldest, not Newest", async () => {
  const page = await read("app/typing/exams/category/[slug]/[language]/page.tsx");
  assert.match(page, /const sort = query\.sort === "newest" \? "newest" : "oldest";/);
  assert.match(page, /if \(targetSort === "newest"\) params\.set\("sort", "newest"\);/);
});

test("the picker's badge is the test's own serial number parsed from its title, not its position in the current sort order", async () => {
  const navigator = await read("app/typing/practice/_components/practice-navigator.tsx");
  assert.match(navigator, /function serialFor\(title: string, fallbackPosition: number\): number \{/);
  assert.match(navigator, /\{serialFor\(item\.title, item\.index\)\}/);
});
